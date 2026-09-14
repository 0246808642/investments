using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Financeiro.Api.Openapi;

// Declara o esquema Bearer no documento para que a UI do Swagger tenha o botao
// "Authorize". Sem isso da para ler a lista de rotas, mas nao da para exercitar
// nenhuma rota autenticada — que sao todas as de dado.
internal sealed class TransformadorDeSegurancaBearer : IOpenApiDocumentTransformer
{
    public const string Nome = "Bearer";

    // Rotas que nao exigem token. Precisam ser declaradas explicitamente porque
    // a exigencia esta no nivel do documento e so uma lista vazia a cancela.
    private static readonly string[] CaminhosAnonimos =
    [
        "/saude",
        "/api/autenticacao/registrar",
        "/api/autenticacao/login",
    ];

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

        // Exigencia no nivel do documento: vale para toda operacao que nao a
        // sobrescreva. Como as rotas de dado sao a maioria, o default e exigir.
        document.Security ??= [];
        document.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference(Nome, document)] = [],
        });

        // E as anonimas se isentam com uma lista VAZIA. Sem isto o documento
        // afirma que /api/autenticacao/login precisa de token — circular, e um
        // cliente gerado a partir da spec nasceria impossivel de autenticar.
        // A protecao em si vem do RequireAuthorization no grupo /api; isto aqui
        // e o documento contando a verdade sobre ela.
        foreach (var caminho in CaminhosAnonimos)
        {
            if (!document.Paths.TryGetValue(caminho, out var item))
            {
                continue;
            }

            foreach (var operacao in item.Operations ?? [])
            {
                operacao.Value.Security = [];
            }
        }

        return Task.CompletedTask;
    }
}
