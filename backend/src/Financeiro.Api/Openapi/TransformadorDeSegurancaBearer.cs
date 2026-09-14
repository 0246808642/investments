using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Financeiro.Api.Openapi;

// Declara o esquema Bearer no documento para que a UI do Swagger tenha o botao
// "Authorize". Sem isso da para ler a lista de rotas, mas nao da para exercitar
// nenhuma rota autenticada — que sao todas as de dado.
internal sealed class TransformadorDeSegurancaBearer : IOpenApiDocumentTransformer
{
    public const string Nome = "Bearer";

    public Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(document);

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>(StringComparer.Ordinal);
        document.Components.SecuritySchemes[Nome] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Cole so o token devolvido por /api/autenticacao/login; o prefixo \"Bearer \" a UI poe sozinha.",
        };

        document.Security ??= [];
        document.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference(Nome, document)] = [],
        });

        return Task.CompletedTask;
    }
}
