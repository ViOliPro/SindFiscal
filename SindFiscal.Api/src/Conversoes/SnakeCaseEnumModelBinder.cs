using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace SindFiscal.Conversoes;

/// <summary>
/// O model binder padrão do ASP.NET Core para enums em [FromQuery]/[FromRoute]
/// só aceita o nome do membro C# (ex.: "EmAnalise"), via Enum.TryParse. Mas a
/// convenção de wire format desta API — usada no corpo JSON via
/// JsonStringEnumConverter(SnakeCaseLower), ver Program.cs — é snake_case
/// (ex.: "em_analise"). Sem este binder, qualquer parâmetro de enum em
/// query/rota rejeita silenciosamente a mesma casing que o front manda em
/// todo o resto da API, e o [ApiController] transforma isso num 400
/// automático antes até de a action rodar.
///
/// Reaproveita <see cref="SnakeCaseEnumConverter.ToPascalCase"/> — a mesma
/// conversão já usada pelo EF Core para colunas enum — para não ter duas
/// implementações de "snake_case para PascalCase" divergindo com o tempo
/// (RNF12).
/// </summary>
public class SnakeCaseEnumModelBinder : IModelBinder
{
    public Task BindModelAsync(ModelBindingContext bindingContext)
    {
        ArgumentNullException.ThrowIfNull(bindingContext);

        var valueProviderResult = bindingContext.ValueProvider.GetValue(bindingContext.ModelName);
        if (valueProviderResult == ValueProviderResult.None)
            return Task.CompletedTask; // nada informado — deixa opcional/default como está

        bindingContext.ModelState.SetModelValue(bindingContext.ModelName, valueProviderResult);
        var valor = valueProviderResult.FirstValue;

        if (string.IsNullOrWhiteSpace(valor))
        {
            bindingContext.Result = ModelBindingResult.Success(null);
            return Task.CompletedTask;
        }

        var enumType = Nullable.GetUnderlyingType(bindingContext.ModelType) ?? bindingContext.ModelType;

        // Aceita tanto snake_case ("em_analise") quanto o nome C# direto
        // ("EmAnalise"), para não quebrar nenhum chamador existente.
        if (
            Enum.TryParse(enumType, SnakeCaseEnumConverter.ToPascalCase(valor), ignoreCase: true, out var resultado)
            || Enum.TryParse(enumType, valor, ignoreCase: true, out resultado)
        )
        {
            bindingContext.Result = ModelBindingResult.Success(resultado);
            return Task.CompletedTask;
        }

        bindingContext.ModelState.TryAddModelError(
            bindingContext.ModelName,
            $"O valor '{valor}' não é válido para {enumType.Name}."
        );
        return Task.CompletedTask;
    }
}

/// <summary>Registrado em Program.cs via options.ModelBinderProviders.Insert(0, ...).</summary>
public class SnakeCaseEnumModelBinderProvider : IModelBinderProvider
{
    public IModelBinder? GetBinder(ModelBinderProviderContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var type = Nullable.GetUnderlyingType(context.Metadata.ModelType) ?? context.Metadata.ModelType;
        return type.IsEnum ? new SnakeCaseEnumModelBinder() : null;
    }
}
