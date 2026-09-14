using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Financeiro.Api.Endpoints;

internal static class EndpointsDeSaude
{
    // Anonimo de proposito: quem consulta e o orquestrador de container, que nao
    // tem credencial e nao pode ficar sem saber se o processo esta de pe.
    public static IEndpointRouteBuilder MapearSaude(this IEndpointRouteBuilder rotas)
    {
        ArgumentNullException.ThrowIfNull(rotas);

        rotas.MapGet("/saude", () => Results.Ok(new { status = "ok" }))
            .AllowAnonymous()
            .WithName("Saude")
            .WithTags("Saude");

        return rotas;
    }
}
