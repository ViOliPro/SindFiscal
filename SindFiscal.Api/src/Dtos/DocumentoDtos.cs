using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record DocumentoResponse(
    Guid Id,
    EntidadeDocumento EntidadeTipo,
    Guid EntidadeId,
    string TipoDocumento,
    string ReferenciaTexto
);

/// <summary>RF20 — apenas referência textual nesta versão (nº da NF, descrição do comprovante etc.), sem upload real.</summary>
public record RegistrarDocumentoRequest(
    EntidadeDocumento EntidadeTipo,
    Guid EntidadeId,
    string TipoDocumento,
    string ReferenciaTexto
);
