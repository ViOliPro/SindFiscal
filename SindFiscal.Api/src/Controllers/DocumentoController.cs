using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>
/// RF20 — nesta fase, sem upload/anexo de arquivo: apenas uma referência
/// textual (nº da nota fiscal, descrição do comprovante, nº da ata) vinculada
/// a um registro específico. Documento não tem CondominioId próprio (é uma
/// associação polimórfica por EntidadeTipo+EntidadeId) — {condominioId} na
/// rota serve para a checagem de permissão do módulo 8 e para validar que a
/// entidade referenciada realmente pertence a este condomínio (ou, no caso
/// de Fornecedor, a este síndico — RN04).
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/documentos")]
[RequerPermissao(Modulos.Documentos)]
public class DocumentoController : ControllerBase
{
    private readonly AppDbContext _db;

    public DocumentoController(AppDbContext db) => _db = db;

    /// <summary>Lista os documentos de uma entidade específica (ex.: todos os anexos de uma Necessidade).</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DocumentoResponse>>> Listar(
        Guid condominioId,
        [FromQuery] EntidadeDocumento entidadeTipo,
        [FromQuery] Guid entidadeId,
        CancellationToken ct
    )
    {
        if (!await EntidadePertenceAoCondominioAsync(entidadeTipo, entidadeId, condominioId, ct))
            return NotFound("Entidade referenciada não encontrada neste condomínio.");

        var documentos = await _db
            .Documentos.Where(d => d.EntidadeTipo == entidadeTipo && d.EntidadeId == entidadeId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new DocumentoResponse(
                d.Id,
                d.EntidadeTipo,
                d.EntidadeId,
                d.TipoDocumento,
                d.ReferenciaTexto
            ))
            .ToListAsync(ct);

        return Ok(documentos);
    }

    /// <summary>RF20 — registra a referência textual (sem upload real nesta versão).</summary>
    [HttpPost]
    [RequerPermissao(Modulos.Documentos, NivelPermissao.Editar)]
    public async Task<ActionResult<DocumentoResponse>> Registrar(
        Guid condominioId,
        RegistrarDocumentoRequest request,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.TipoDocumento))
            return BadRequest("Tipo de documento é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.ReferenciaTexto))
            return BadRequest("Referência textual é obrigatória.");

        if (
            !await EntidadePertenceAoCondominioAsync(
                request.EntidadeTipo,
                request.EntidadeId,
                condominioId,
                ct
            )
        )
            return BadRequest("Entidade referenciada não encontrada neste condomínio.");

        var documento = new Documento
        {
            Id = Guid.NewGuid(),
            EntidadeTipo = request.EntidadeTipo,
            EntidadeId = request.EntidadeId,
            TipoDocumento = request.TipoDocumento.Trim(),
            ReferenciaTexto = request.ReferenciaTexto.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Documentos.Add(documento);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(Listar),
            new { condominioId, entidadeTipo = documento.EntidadeTipo, entidadeId = documento.EntidadeId },
            new DocumentoResponse(
                documento.Id,
                documento.EntidadeTipo,
                documento.EntidadeId,
                documento.TipoDocumento,
                documento.ReferenciaTexto
            )
        );
    }

    /// <summary>Corrige o texto de um documento já registrado (ex.: número da NF digitado errado).</summary>
    [HttpPut("{documentoId:guid}")]
    [RequerPermissao(Modulos.Documentos, NivelPermissao.Editar)]
    public async Task<ActionResult<DocumentoResponse>> Atualizar(
        Guid condominioId,
        Guid documentoId,
        AtualizarDocumentoRequest request,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.TipoDocumento))
            return BadRequest("Tipo de documento é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.ReferenciaTexto))
            return BadRequest("Referência textual é obrigatória.");

        var documento = await _db.Documentos.FirstOrDefaultAsync(d => d.Id == documentoId, ct);
        if (documento is null)
            return NotFound("Documento não encontrado.");

        if (
            !await EntidadePertenceAoCondominioAsync(
                documento.EntidadeTipo,
                documento.EntidadeId,
                condominioId,
                ct
            )
        )
            return NotFound("Documento não encontrado neste condomínio.");

        documento.TipoDocumento = request.TipoDocumento.Trim();
        documento.ReferenciaTexto = request.ReferenciaTexto.Trim();
        documento.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(
            new DocumentoResponse(
                documento.Id,
                documento.EntidadeTipo,
                documento.EntidadeId,
                documento.TipoDocumento,
                documento.ReferenciaTexto
            )
        );
    }

    /// <summary>
    /// RN04 — Fornecedor é do síndico, não de um condomínio específico, então
    /// sua checagem é feita via SindicoId do condomínio da rota, igual ao
    /// FornecedorController/CotacaoController.
    /// </summary>
    private async Task<bool> EntidadePertenceAoCondominioAsync(
        EntidadeDocumento tipo,
        Guid entidadeId,
        Guid condominioId,
        CancellationToken ct
    )
    {
        switch (tipo)
        {
            case EntidadeDocumento.Necessidade:
                return await _db.Necessidades.AnyAsync(
                    n => n.Id == entidadeId && n.CondominioId == condominioId,
                    ct
                );
            case EntidadeDocumento.CompromissoFinanceiro:
                return await _db.CompromissosFinanceiros.AnyAsync(
                    c => c.Id == entidadeId && c.CondominioId == condominioId,
                    ct
                );
            case EntidadeDocumento.Pagamento:
                return await _db.Pagamentos.AnyAsync(
                    p => p.Id == entidadeId && p.Compromisso.CondominioId == condominioId,
                    ct
                );
            case EntidadeDocumento.Decisao:
                return await _db.Decisoes.AnyAsync(
                    d => d.Id == entidadeId && d.Necessidade.CondominioId == condominioId,
                    ct
                );
            case EntidadeDocumento.Fornecedor:
                var condominio = await _db.Condominios.FindAsync(new object[] { condominioId }, ct);
                if (condominio is null)
                    return false;
                return await _db.Fornecedores.AnyAsync(
                    f => f.Id == entidadeId && f.SindicoId == condominio.SindicoId,
                    ct
                );
            default:
                return false;
        }
    }
}
