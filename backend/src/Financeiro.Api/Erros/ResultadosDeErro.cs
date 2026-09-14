using Microsoft.AspNetCore.Http;

namespace Financeiro.Api.Erros;

// Fabrica dos erros que os endpoints devolvem por decisao propria (sem excecao).
// Centralizada para que todos saiam com o mesmo corpo e o mesmo status.
internal static class ResultadosDeErro
{
    public const string MensagemSemUsuario =
        "Token sem identificacao de usuario valida; refaca o login.";

    public const string MensagemCorpoAusente =
        "Corpo da requisicao ausente ou nulo; envie um objeto JSON.";

    public static IResult NaoAutenticado(string erro = MensagemSemUsuario)
        => Results.Json(RespostaDeErro.De(erro), statusCode: StatusCodes.Status401Unauthorized);

    public static IResult Invalido(string erro)
        => Results.Json(RespostaDeErro.De(erro), statusCode: StatusCodes.Status400BadRequest);

    public static IResult Invalido(string erro, IReadOnlyList<string> detalhes)
        => Results.Json(RespostaDeErro.De(erro, detalhes), statusCode: StatusCodes.Status400BadRequest);

    public static IResult NaoEncontrado(string erro)
        => Results.Json(RespostaDeErro.De(erro), statusCode: StatusCodes.Status404NotFound);
}
