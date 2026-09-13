using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>
/// RF06 — necessidade/previsão, com ciclo de vida único (módulo 2:
/// necessidades_cotacoes_fornecedores).
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/necessidades")]
[RequerPermissao(Modulos.NecessidadesCotacoesFornecedores)]
public class NecessidadeController : ControllerBase
{
    private readonly AppDbContext _db;

    public NecessidadeController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NecessidadeResponse>>> Listar(
        Guid condominioId,
        [FromQuery] SituacaoNecessidade? situacao,
        CancellationToken ct
    )
    {
        var query = _db.Necessidades.Where(n => n.CondominioId == condominioId);
        if (situacao is SituacaoNecessidade s)
            query = query.Where(n => n.Situacao == s);

        var necessidades = await query
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NecessidadeResponse(
                n.Id,
                n.Descricao,
                n.Categoria,
                n.Prioridade,
                n.EscopoTexto,
                n.Situacao,
                n.ResponsavelId
            ))
            .ToListAsync(ct);

        return Ok(necessidades);
    }

    [HttpGet("{necessidadeId:guid}")]
    public async Task<ActionResult<NecessidadeResponse>> ObterPorId(
        Guid condominioId,
        Guid necessidadeId,
        CancellationToken ct
    )
    {
        var n = await _db.Necessidades.FirstOrDefaultAsync(
            x => x.Id == necessidadeId && x.CondominioId == condominioId,
            ct
        );
        if (n is null)
            return NotFound("Necessidade não encontrada neste condomínio.");

        return Ok(
            new NecessidadeResponse(
                n.Id,
                n.Descricao,
                n.Categoria,
                n.Prioridade,
                n.EscopoTexto,
                n.Situacao,
                n.ResponsavelId
            )
        );
    }

    /// <summary>RF06 — registra uma necessidade/previsão em EmAnalise.</summary>
    [HttpPost]
    [RequerPermissao(Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar)]
    public async Task<ActionResult<NecessidadeResponse>> Criar(
        Guid condominioId,
        CriarNecessidadeRequest request,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.Descricao))
            return BadRequest("Descrição é obrigatória.");
        if (string.IsNullOrWhiteSpace(request.Categoria))
            return BadRequest("Categoria é obrigatória.");

        if (request.ResponsavelId is Guid responsavelId)
        {
            var responsavelValido = await ResponsavelPodeSerAtribuido(
                condominioId,
                responsavelId,
                ct
            );
            if (!responsavelValido)
                return BadRequest("Responsável informado não tem acesso a este condomínio.");
        }

        var necessidade = new Necessidade
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            ResponsavelId = request.ResponsavelId,
            Descricao = request.Descricao.Trim(),
            Categoria = request.Categoria.Trim(),
            Prioridade = request.Prioridade,
            EscopoTexto = request.EscopoTexto,
            Situacao = SituacaoNecessidade.EmAnalise,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Necessidades.Add(necessidade);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(ObterPorId),
            new { condominioId, necessidadeId = necessidade.Id },
            new NecessidadeResponse(
                necessidade.Id,
                necessidade.Descricao,
                necessidade.Categoria,
                necessidade.Prioridade,
                necessidade.EscopoTexto,
                necessidade.Situacao,
                necessidade.ResponsavelId
            )
        );
    }

    /// <summary>
    /// Atualiza descrição/categoria/prioridade/escopo — só permitido antes de
    /// uma decisão (RN09: escopo pós-aprovação deve virar novo registro de
    /// decisão, não edição silenciosa da necessidade original).
    /// </summary>
    [HttpPut("{necessidadeId:guid}")]
    [RequerPermissao(Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar)]
    public async Task<ActionResult<NecessidadeResponse>> Atualizar(
        Guid condominioId,
        Guid necessidadeId,
        AtualizarNecessidadeRequest request,
        CancellationToken ct
    )
    {
        var n = await _db.Necessidades.FirstOrDefaultAsync(
            x => x.Id == necessidadeId && x.CondominioId == condominioId,
            ct
        );
        if (n is null)
            return NotFound("Necessidade não encontrada neste condomínio.");

        if (n.Situacao is not (SituacaoNecessidade.EmAnalise or SituacaoNecessidade.EmOrcamento))
            return Conflict(
                "Necessidade já decidida — alterações de escopo devem ser feitas via novo registro de decisão (RN09)."
            );

        if (string.IsNullOrWhiteSpace(request.Descricao))
            return BadRequest("Descrição é obrigatória.");
        if (string.IsNullOrWhiteSpace(request.Categoria))
            return BadRequest("Categoria é obrigatória.");

        if (request.ResponsavelId is Guid responsavelId)
        {
            var responsavelValido = await ResponsavelPodeSerAtribuido(
                condominioId,
                responsavelId,
                ct
            );
            if (!responsavelValido)
                return BadRequest("Responsável informado não tem acesso a este condomínio.");
        }

        n.Descricao = request.Descricao.Trim();
        n.Categoria = request.Categoria.Trim();
        n.Prioridade = request.Prioridade;
        n.EscopoTexto = request.EscopoTexto;
        n.ResponsavelId = request.ResponsavelId;
        n.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(
            new NecessidadeResponse(
                n.Id,
                n.Descricao,
                n.Categoria,
                n.Prioridade,
                n.EscopoTexto,
                n.Situacao,
                n.ResponsavelId
            )
        );
    }

    /// <summary>
    /// Transição manual de situação (ex.: EmAnalise → EmOrcamento assim que a
    /// primeira cotação chega — normalmente feito automaticamente pelo
    /// CotacaoController, mas exposto aqui para ajuste manual quando
    /// necessário). Transições para Aprovado/Reprovado/Adiado devem passar
    /// pelo DecisaoController (RF09), não por aqui.
    /// </summary>
    [HttpPatch("{necessidadeId:guid}/situacao")]
    [RequerPermissao(Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar)]
    public async Task<ActionResult<NecessidadeResponse>> AtualizarSituacao(
        Guid condominioId,
        Guid necessidadeId,
        AtualizarSituacaoNecessidadeRequest request,
        CancellationToken ct
    )
    {
        if (
            request.Situacao
            is SituacaoNecessidade.Aprovado
                or SituacaoNecessidade.Reprovado
                or SituacaoNecessidade.Adiado
        )
        {
            return BadRequest(
                "Transições de aprovação/reprovação/adiamento devem ser registradas via Decisão (RF09), não diretamente na necessidade."
            );
        }

        var n = await _db.Necessidades.FirstOrDefaultAsync(
            x => x.Id == necessidadeId && x.CondominioId == condominioId,
            ct
        );
        if (n is null)
            return NotFound("Necessidade não encontrada neste condomínio.");

        n.Situacao = request.Situacao;
        n.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(
            new NecessidadeResponse(
                n.Id,
                n.Descricao,
                n.Categoria,
                n.Prioridade,
                n.EscopoTexto,
                n.Situacao,
                n.ResponsavelId
            )
        );
    }

    private async Task<bool> ResponsavelPodeSerAtribuido(
        Guid condominioId,
        Guid responsavelId,
        CancellationToken ct
    )
    {
        var responsavel = await _db.Usuarios.FindAsync(new object[] { responsavelId }, ct);
        if (responsavel is null || !responsavel.Ativo)
            return false;

        if (responsavel.Papel == PapelUsuario.Sindico)
            return await _db.Condominios.AnyAsync(
                c => c.Id == condominioId && c.SindicoId == responsavelId,
                ct
            );

        return await _db.Permissoes.AnyAsync(
            p => p.UsuarioId == responsavelId && p.CondominioId == condominioId,
            ct
        );
    }
}
