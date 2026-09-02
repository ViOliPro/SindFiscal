using System.Text;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace SindFiscal.Api.src.Conversoes;

/// <summary>
/// Converte um enum C# (ex.: <c>FundoTrabalho</c>) para o texto usado nas colunas
/// varchar + CHECK constraint do schema.sql (ex.: <c>fundo_trabalho</c>) e vice-versa.
/// Usado no AppDbContext para todos os campos "enum fechado de negócio" (ver
/// comentário de convenções no topo de database/schema.sql).
/// </summary>
public static class SnakeCaseEnumConverter
{
    public static ValueConverter<TEnum, string> Create<TEnum>()
        where TEnum : struct, Enum
    {
        return new ValueConverter<TEnum, string>(
            paraBanco => ToSnakeCase(paraBanco.ToString()),
            doBanco => (TEnum)Enum.Parse(typeof(TEnum), ToPascalCase(doBanco), ignoreCase: true)
        );
    }

    public static string ToSnakeCase(string pascalCase)
    {
        var sb = new StringBuilder();
        for (var i = 0; i < pascalCase.Length; i++)
        {
            var c = pascalCase[i];
            if (char.IsUpper(c))
            {
                if (i > 0)
                    sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }

    public static string ToPascalCase(string snakeCase)
    {
        var partes = snakeCase.Split('_', StringSplitOptions.RemoveEmptyEntries);
        var sb = new StringBuilder();
        foreach (var parte in partes)
        {
            sb.Append(char.ToUpperInvariant(parte[0]));
            if (parte.Length > 1)
                sb.Append(parte[1..]);
        }
        return sb.ToString();
    }
}
