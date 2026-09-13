using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>
/// RF09, RN07-RN10 — decisão como evento histórico. Se Resultado = Aprovado,
/// também cria o CompromissoFinanceiro (RF10) na mesma operação.
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/necessidades/{necessidadeId:guid}/decisoes")]
[RequerPermissao(Modulos.DecisoesCompromissos)]
public class DecisaoController : ControllerBase
{
    private readonly AppDbContext _db;

    public DecisaoController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DecisaoResponse>>> Listar(
        Guid condominioId,
        Guid necessidadeId,
        CancellationToken ct
    )
    {
        var decisoes = await _db
            .Decisoes.Where(d =>
                d.NecessidadeId == necessidadeId && d.Necessidade.CondominioId == condominioId
            )
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new DecisaoResponse(
                d.Id,
                d.NecessidadeId,
                d.CotacaoEscolhidaId,
                d.ResponsavelId,
                d.Data,
                d.Resultado,
                d.Justificativa,
                d.ReferenciaRespaldo
            ))
            .ToListAsync(ct);
        return Ok(decisoes);
    }

    /// <summary>
    /// RN09 — sempre cria um NOVO registro (histórico imutável), mesmo que já
    /// exista uma decisão anterior para a mesma necessidade (ex.: reversão de
    /// uma decisão adiada, ou alteração de escopo pós-aprovação).
    /// </summary>
    [HttpPost]
    [RequerPermissao(Modulos.DecisoesCompromissos, NivelPermissao.Editar)]
    public async Task<ActionResult<DecisaoResponse>> Registrar(
        Guid condominioId,
        Guid necessidadeId,
        RegistrarDecisaoRequest request,
        CancellationToken ct
    )
    {
        var necessidade = await _db.Necessidades.FirstOrDefaultAsync(
            n => n.Id == necessidadeId && n.CondominioId == condominioId,
            ct
        );
        if (necessidade is null)
            return NotFound("Necessidade não encontrada neste condomínio.");

        decimal valorAprovado = 0m;
        if (request.CotacaoEscolhidaId is Guid cotacaoId)
        {
            // RN06 — a cotação escolhida precisa pertencer à mesma necessidade,
            // nunca a uma cotação de outra necessidade (id "emprestado" por engano).
            var cotacao = await _db.Cotacoes.FirstOrDefaultAsync(
                c => c.Id == cotacaoId && c.NecessidadeId == necessidadeId,
                ct
            );
            if (cotacao is null)
                return BadRequest("Cotação informada não pertence a esta necessidade.");
            valorAprovado = cotacao.Valor;
        }
        else if (request.Resultado == ResultadoDecisao.Aprovado)
        {
            // RN08 — despesa emergencial pode pular a etapa de cotação prévia;
            // quando aprovada sem cotação, o valor vem no próprio compromisso avulso depois.
            valorAprovado = 0m;
        }

        var responsavelId = HttpContext.UsuarioIdAutenticado();
        var decisao = new Decisao
        {
            Id = Guid.NewGuid(),
            NecessidadeId = necessidadeId,
            CotacaoEscolhidaId = request.CotacaoEscolhidaId,
            ResponsavelId = responsavelId,
            Data = request.Data,
            Resultado = request.Resultado,
            Justificativa = request.Justificativa,
            ReferenciaRespaldo = request.ReferenciaRespaldo,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Decisoes.Add(decisao);

        necessidade.Situacao = request.Resultado switch
        {
            ResultadoDecisao.Aprovado => SituacaoNecessidade.Aprovado,
            ResultadoDecisao.Reprovado => SituacaoNecessidade.Reprovado,
            ResultadoDecisao.Adiado => SituacaoNecessidade.Adiado,
            _ => necessidade.Situacao,
        };
        necessidade.UpdatedAt = DateTimeOffset.UtcNow;

        // RF10 — decisão de aprovação gera automaticamente o compromisso financeiro.
        if (request.Resultado == ResultadoDecisao.Aprovado)
        {
            _db.CompromissosFinanceiros.Add(
                new CompromissoFinanceiro
                {
                    Id = Guid.NewGuid(),
                    CondominioId = condominioId,
                    NecessidadeId = necessidadeId,
                    Categoria = necessidade.Categoria,
                    ValorAprovado = valorAprovado,
                    Status = StatusCompromisso.AguardandoExecucao,
                    CreatedAt = DateTimeOffset.UtcNow,
                }
            );
        }

        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(
            nameof(Listar),
            new { condominioId, necessidadeId },
            new DecisaoResponse(
                decisao.Id,
                decisao.NecessidadeId,
                decisao.CotacaoEscolhidaId,
                decisao.ResponsavelId,
                decisao.Data,
                decisao.Resultado,
                decisao.Justificativa,
                decisao.ReferenciaRespaldo
            )
        );
    }
}
