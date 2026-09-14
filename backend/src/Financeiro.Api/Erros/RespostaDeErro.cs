namespace Financeiro.Api.Erros;

// Corpo unico de erro da API, em camelCase: { "erro": "...", "detalhes": [...] }.
//
// Vale para 400, 401, 404 e 500 — o cliente tem UM formato para tratar, e nao
// precisa adivinhar se aquele status devolveu ProblemDetails, texto puro ou nada.
// "detalhes" existe porque o Identity devolve varias mensagens de uma vez (senha
// curta, sem digito, sem maiuscula) e junta-las numa string so obrigaria o cliente
// a fatiar texto.
internal sealed record RespostaDeErro(string Erro, IReadOnlyList<string> Detalhes)
{
    public static RespostaDeErro De(string erro) => new(erro, []);

    public static RespostaDeErro De(string erro, IReadOnlyList<string> detalhes) => new(erro, detalhes);
}
