using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;

namespace Financeiro.Api.Erros;

// Recusa corpo que nao seja JSON ANTES da ligacao de parametros.
//
// Precisa ser middleware, e nao IEndpointFilter: filtro de endpoint roda depois da
// ligacao, e a ligacao ja teria respondido 415 com corpo vazio — o cliente sabe que
// falhou e nao sabe por que. Aqui a resposta e 400 com o mesmo { erro, detalhes }
// do resto da API e diz qual tipo chegou.
//
// Roda DEPOIS da autorizacao de proposito: requisicao sem token e 401, e nao um 400
// de formato que revelaria que a rota existe e o que ela aceita.
internal sealed class MiddlewareDeTipoDeConteudo
{
    public const string TipoEsperado = "application/json";

    private readonly RequestDelegate _proximo;

    public MiddlewareDeTipoDeConteudo(RequestDelegate proximo)
    {
        ArgumentNullException.ThrowIfNull(proximo);

        _proximo = proximo;
    }

    public Task InvokeAsync(HttpContext contexto)
    {
        ArgumentNullException.ThrowIfNull(contexto);

        var requisicao = contexto.Request;

        return TemCorpo(requisicao) && !EhJson(requisicao.ContentType)
            ? ResultadosDeErro
                .Invalido(
                    "Content-Type invalido: esperado "
                    + TipoEsperado
                    + ", recebido \""
                    + (string.IsNullOrWhiteSpace(requisicao.ContentType) ? "(ausente)" : requisicao.ContentType)
                    + "\".")
                .ExecuteAsync(contexto)
            : _proximo(contexto);
    }

    private static bool TemCorpo(HttpRequest requisicao)
        => (HttpMethods.IsPost(requisicao.Method)
                || HttpMethods.IsPut(requisicao.Method)
                || HttpMethods.IsPatch(requisicao.Method))
            && (requisicao.ContentLength > 0 || !string.IsNullOrEmpty(requisicao.ContentType));

    // Aceita application/json e os sufixos +json (application/merge-patch+json e
    // afins), com ou sem charset. Comparar a string inteira recusaria
    // "application/json; charset=utf-8", que e o que fetch() manda por padrao.
    private static bool EhJson(string? tipoDeConteudo)
        => MediaTypeHeaderValue.TryParse(tipoDeConteudo, out var tipo)
            && (tipo.MatchesMediaType(TipoEsperado) || tipo.Suffix.Equals("json", StringComparison.OrdinalIgnoreCase));
}
