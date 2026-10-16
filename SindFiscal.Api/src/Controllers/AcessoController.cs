using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>
/// RF03 — gestão de acessos (módulo 11, exclusivo síndico): visão geral, matriz por
/// colaborador (condomínios × módulos) e modelos de acesso reutilizáveis.
///
/// A tabela permissao continua sendo a única fonte de verdade da checagem
/// ([RequerPermissao]). Modelos e "copiar de outro condomínio" são atalhos que
/// preenchem essa tabela — por isso o front monta tudo em rascunho e salva de uma vez
/// no PUT acessos/usuarios/{id}.
/// </summary>
[ApiController]
[Route("api")]
public class AcessoController : ControllerBase
{
    private readonly AppDbContext _db;

    public AcessoController(AppDbContext db) => _db = db;

    // ================================================================ VISÃO GERAL

    /// <summary>
    /// Quantos colaboradores/condomínios existem e quem está SEM acesso nenhum
    /// (criou o usuário e esqueceu de conceder permissões).
    /// </summary>
    [HttpGet("acessos/resumo")]
    public async Task<ActionResult<AcessoResumoResponse>> Resumo(CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var condominios = await _db.Condominios
            .Where(c => c.SindicoId == sindicoId)
            .Select(c => new { c.Id, c.Ativo })
            .ToListAsync(ct);
        var todosIds = condominios.Select(c => c.Id).ToList();
        var ativosIds = condominios.Where(c => c.Ativo).Select(c => c.Id).ToList();

        // Quem tem alguma permissão em qualquer condomínio do síndico (inclusive inativos)
        var comPermissaoIds = await _db.Permissoes
            .Where(p => todosIds.Contains(p.CondominioId))
            .Select(p => p.UsuarioId)
            .Distinct()
            .ToListAsync(ct);

        // Em quantos condomínios ATIVOS cada um tem acesso
        var contagens = await _db.Permissoes
            .Where(p => ativosIds.Contains(p.CondominioId))
            .GroupBy(p => p.UsuarioId)
            .Select(g => new
            {
                UsuarioId = g.Key,
                Condominios = g.Select(x => x.CondominioId).Distinct().Count(),
            })
            .ToListAsync(ct);
        var porUsuario = contagens.ToDictionary(x => x.UsuarioId, x => x.Condominios);

        // Colaboradores/conselheiros do síndico + recém-criados sem nenhuma permissão
        var usuarios = await _db.Usuarios
            .Where(u => u.Papel != PapelUsuario.Sindico
                && (comPermissaoIds.Contains(u.Id)
                    || (u.Ativo && !_db.Permissoes.Any(p => p.UsuarioId == u.Id))))
            .OrderBy(u => u.Nome)
            .ToListAsync(ct);

        var lista = usuarios
            .Select(u => new AcessoColaboradorResumo(
                u.Id, u.Nome, u.Email, u.Papel, u.Ativo,
                porUsuario.TryGetValue(u.Id, out var n) ? n : 0))
            .ToList();

        return Ok(new AcessoResumoResponse(
            TotalColaboradores: lista.Count,
            TotalCondominios: ativosIds.Count,
            SemAcesso: lista.Count(x => x.Ativo && x.CondominiosComAcesso == 0),
            Colaboradores: lista));
    }

    // ================================================================ MATRIZ POR COLABORADOR

    [HttpGet("acessos/usuarios/{usuarioId:guid}")]
    public async Task<ActionResult<AcessoUsuarioResponse>> ObterUsuario(
        Guid usuarioId, CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var usuario = await _db.Usuarios.FindAsync(new object[] { usuarioId }, ct);
        if (usuario is null || usuario.Papel == PapelUsuario.Sindico) return NotFound();

        return Ok(await Montar(usuario, sindicoId.Value, ct));
    }

    /// <summary>
    /// Aplica um LOTE de alterações (várias células da matriz) numa única gravação.
    /// Nivel = null remove a permissão. Valida tudo antes de gravar: se qualquer item
    /// for inválido, nada é salvo.
    /// </summary>
    [HttpPut("acessos/usuarios/{usuarioId:guid}")]
    public async Task<ActionResult<AcessoUsuarioResponse>> Salvar(
        Guid usuarioId, SalvarAcessosRequest request, CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var usuario = await _db.Usuarios.FindAsync(new object[] { usuarioId }, ct);
        if (usuario is null || usuario.Papel == PapelUsuario.Sindico) return NotFound();
        if (!usuario.Ativo)
            return BadRequest(new { message = "Usuário inativo não pode receber acessos." });

        var alteracoes = request.Alteracoes ?? Array.Empty<AlteracaoAcesso>();

        var condominiosIds = await _db.Condominios
            .Where(c => c.SindicoId == sindicoId && c.Ativo)
            .Select(c => c.Id)
            .ToListAsync(ct);

        foreach (var a in alteracoes)
        {
            if (!condominiosIds.Contains(a.CondominioId))
                return BadRequest(new { message = "Condomínio inválido para este síndico." });

            var erro = a.Nivel is null
                ? (Modulos.EhDelegavel(a.Modulo) ? null : $"Módulo \"{a.Modulo}\" inválido.")
                : RegrasAcesso.Validar(a.Modulo, a.Nivel.Value, usuario.Papel);
            if (erro is not null) return BadRequest(new { message = erro });
        }

        // Se a mesma célula vier repetida, vale a última.
        var finais = alteracoes
            .GroupBy(a => (a.CondominioId, a.Modulo))
            .Select(g => g.Last())
            .ToList();

        var existentes = await _db.Permissoes
            .Where(p => p.UsuarioId == usuarioId && condominiosIds.Contains(p.CondominioId))
            .ToListAsync(ct);

        var agora = DateTimeOffset.UtcNow;
        foreach (var a in finais)
        {
            var atual = existentes.FirstOrDefault(
                p => p.CondominioId == a.CondominioId && p.Modulo == a.Modulo);

            if (a.Nivel is null)
            {
                if (atual is not null) _db.Permissoes.Remove(atual);
                continue;
            }

            if (atual is null)
            {
                _db.Permissoes.Add(new Permissao
                {
                    Id = Guid.NewGuid(),
                    UsuarioId = usuarioId,
                    CondominioId = a.CondominioId,
                    Modulo = a.Modulo,
                    Nivel = a.Nivel.Value,
                    CreatedAt = agora,
                });
            }
            else if (atual.Nivel != a.Nivel.Value)
            {
                atual.Nivel = a.Nivel.Value;
                atual.UpdatedAt = agora;
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok(await Montar(usuario, sindicoId.Value, ct));
    }

    // ================================================================ MODELOS DE ACESSO

    [HttpGet("modelos-acesso")]
    public async Task<ActionResult<IReadOnlyList<ModeloAcessoResponse>>> ListarModelos(
        CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        return Ok(await CarregarModelos(sindicoId.Value, ct));
    }

    [HttpPost("modelos-acesso")]
    public async Task<ActionResult<ModeloAcessoResponse>> CriarModelo(
        SalvarModeloAcessoRequest request, CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var erro = ValidarModelo(request, out var nome, out var itens);
        if (erro is not null) return BadRequest(new { message = erro });

        if (await NomeModeloEmUso(sindicoId.Value, nome, null, ct))
            return Conflict(new { message = "Já existe um modelo com esse nome." });

        var modelo = new ModeloAcesso
        {
            Id = Guid.NewGuid(),
            SindicoId = sindicoId.Value,
            Nome = nome,
            Descricao = LimparDescricao(request.Descricao),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        foreach (var i in itens)
            modelo.Itens.Add(new ModeloAcessoItem
            {
                Id = Guid.NewGuid(),
                ModeloAcessoId = modelo.Id,
                Modulo = i.Modulo,
                Nivel = i.Nivel,
            });

        _db.ModelosAcesso.Add(modelo);
        await _db.SaveChangesAsync(ct);
        return Ok(ParaResponse(modelo));
    }

    [HttpPut("modelos-acesso/{modeloId:guid}")]
    public async Task<ActionResult<ModeloAcessoResponse>> AtualizarModelo(
        Guid modeloId, SalvarModeloAcessoRequest request, CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var modelo = await _db.ModelosAcesso
            .Include(m => m.Itens)
            .FirstOrDefaultAsync(m => m.Id == modeloId && m.SindicoId == sindicoId, ct);
        if (modelo is null) return NotFound();

        var erro = ValidarModelo(request, out var nome, out var itens);
        if (erro is not null) return BadRequest(new { message = erro });

        if (await NomeModeloEmUso(sindicoId.Value, nome, modeloId, ct))
            return Conflict(new { message = "Já existe um modelo com esse nome." });

        modelo.Nome = nome;
        modelo.Descricao = LimparDescricao(request.Descricao);
        modelo.UpdatedAt = DateTimeOffset.UtcNow;

        // Diff (em vez de apagar tudo e recriar) para não esbarrar no índice único
        // (modelo, módulo) dentro do mesmo SaveChanges.
        foreach (var existente in modelo.Itens.ToList())
        {
            var novo = itens.FirstOrDefault(i => i.Modulo == existente.Modulo);
            if (novo is null) _db.Remove(existente);
            else existente.Nivel = novo.Nivel;
        }
        foreach (var novo in itens.Where(i => modelo.Itens.All(e => e.Modulo != i.Modulo)))
            _db.Add(new ModeloAcessoItem
            {
                Id = Guid.NewGuid(),
                ModeloAcessoId = modelo.Id,
                Modulo = novo.Modulo,
                Nivel = novo.Nivel,
            });

        await _db.SaveChangesAsync(ct);

        var atualizado = await CarregarModelos(sindicoId.Value, ct);
        return Ok(atualizado.First(m => m.Id == modeloId));
    }

    /// <summary>Excluir um modelo NÃO remove permissões já concedidas com ele (são cópias).</summary>
    [HttpDelete("modelos-acesso/{modeloId:guid}")]
    public async Task<IActionResult> ExcluirModelo(Guid modeloId, CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var modelo = await _db.ModelosAcesso
            .FirstOrDefaultAsync(m => m.Id == modeloId && m.SindicoId == sindicoId, ct);
        if (modelo is null) return NotFound();

        _db.ModelosAcesso.Remove(modelo);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Cria Consulta/Operacional/Gestor (os que ainda não existirem) como ponto de partida.</summary>
    [HttpPost("modelos-acesso/padrao")]
    public async Task<ActionResult<IReadOnlyList<ModeloAcessoResponse>>> CriarModelosPadrao(
        CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var nomesExistentes = (await _db.ModelosAcesso
                .Where(m => m.SindicoId == sindicoId)
                .Select(m => m.Nome)
                .ToListAsync(ct))
            .Select(n => n.ToLowerInvariant())
            .ToHashSet();

        var agora = DateTimeOffset.UtcNow;
        foreach (var padrao in RegrasAcesso.ModelosPadrao)
        {
            if (nomesExistentes.Contains(padrao.Nome.ToLowerInvariant())) continue;

            var modelo = new ModeloAcesso
            {
                Id = Guid.NewGuid(),
                SindicoId = sindicoId.Value,
                Nome = padrao.Nome,
                Descricao = padrao.Descricao,
                CreatedAt = agora,
            };
            foreach (var (modulo, nivel) in padrao.Itens)
                modelo.Itens.Add(new ModeloAcessoItem
                {
                    Id = Guid.NewGuid(),
                    ModeloAcessoId = modelo.Id,
                    Modulo = modulo,
                    Nivel = nivel,
                });
            _db.ModelosAcesso.Add(modelo);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(await CarregarModelos(sindicoId.Value, ct));
    }

    // ================================================================ helpers

    private async Task<AcessoUsuarioResponse> Montar(
        Usuario usuario, Guid sindicoId, CancellationToken ct)
    {
        var condominios = await _db.Condominios
            .Where(c => c.SindicoId == sindicoId && c.Ativo)
            .OrderBy(c => c.Nome)
            .Select(c => new CondominioResumoResponse(c.Id, c.Nome))
            .ToListAsync(ct);
        var ids = condominios.Select(c => c.Id).ToList();

        var permissoes = await _db.Permissoes
            .Where(p => p.UsuarioId == usuario.Id && ids.Contains(p.CondominioId))
            .Select(p => new AcessoPermissaoItem(p.CondominioId, p.Modulo, p.Nivel))
            .ToListAsync(ct);

        return new AcessoUsuarioResponse(
            new UsuarioResponse(usuario.Id, usuario.Nome, usuario.Email, usuario.Papel, usuario.Ativo),
            condominios,
            permissoes);
    }

    private async Task<List<ModeloAcessoResponse>> CarregarModelos(
        Guid sindicoId, CancellationToken ct)
    {
        var modelos = await _db.ModelosAcesso
            .Include(m => m.Itens)
            .Where(m => m.SindicoId == sindicoId)
            .OrderBy(m => m.Nome)
            .ToListAsync(ct);
        return modelos.Select(ParaResponse).ToList();
    }

    private static ModeloAcessoResponse ParaResponse(ModeloAcesso m) =>
        new(
            m.Id,
            m.Nome,
            m.Descricao,
            m.Itens.OrderBy(i => i.Modulo).Select(i => new ModeloAcessoItemDto(i.Modulo, i.Nivel)).ToList());

    private Task<bool> NomeModeloEmUso(Guid sindicoId, string nome, Guid? ignorarId, CancellationToken ct)
    {
        var minusculo = nome.ToLower();
        return _db.ModelosAcesso.AnyAsync(
            m => m.SindicoId == sindicoId && m.Id != ignorarId && m.Nome.ToLower() == minusculo, ct);
    }

    private static string? ValidarModelo(
        SalvarModeloAcessoRequest request,
        out string nome,
        out List<ModeloAcessoItemDto> itens)
    {
        nome = request.Nome?.Trim() ?? "";
        itens = new List<ModeloAcessoItemDto>();

        if (nome.Length < 2 || nome.Length > 60)
            return "Nome do modelo deve ter entre 2 e 60 caracteres.";

        // Mesma regra de qualquer concessão (aqui assume colaborador, o caso comum).
        foreach (var i in request.Itens ?? Array.Empty<ModeloAcessoItemDto>())
        {
            var erro = RegrasAcesso.Validar(i.Modulo, i.Nivel, PapelUsuario.Colaborador);
            if (erro is not null) return erro;
        }

        // Módulo repetido: vale o último.
        itens = (request.Itens ?? Array.Empty<ModeloAcessoItemDto>())
            .GroupBy(i => i.Modulo)
            .Select(g => g.Last())
            .ToList();

        if (itens.Count == 0)
            return "Um modelo precisa ter pelo menos um módulo com acesso.";

        return null;
    }

    private static string? LimparDescricao(string? descricao)
    {
        var d = descricao?.Trim();
        if (string.IsNullOrEmpty(d)) return null;
        return d.Length > 200 ? d[..200] : d;
    }

    private async Task<Guid?> GarantirSindico(CancellationToken ct)
    {
        var claim = User.FindFirst("usuario_id")?.Value;
        if (claim is null || !Guid.TryParse(claim, out var id)) return null;
        var u = await _db.Usuarios.FindAsync(new object[] { id }, ct);
        if (u is null || u.Papel != PapelUsuario.Sindico || !u.Ativo) return null;
        return id;
    }
}
