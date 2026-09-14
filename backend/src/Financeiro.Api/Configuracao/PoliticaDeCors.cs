using Microsoft.Extensions.Configuration;

namespace Financeiro.Api.Configuracao;

// Origens liberadas para o frontend. Vem de configuracao (nunca "*"), porque
// AllowAnyOrigin junto com credenciais e um erro que o navegador so denuncia em
// producao.
internal static class PoliticaDeCors
{
    public const string Nome = "frontend";

    public const string Secao = "Cors:OrigensPermitidas";

    // Vite de desenvolvimento. Fica como fallback para que um clone novo do repo
    // suba funcionando; nao e segredo nem endereco de producao.
    //
    // Sao DUAS portas porque o Vite anda: quando a 5173 ja esta ocupada — outra
    // instancia, outro projeto — ele sobe na 5174 sem avisar, e o login passa a
    // falhar com "nao foi possivel falar com o servidor", que e exatamente a
    // mensagem que NAO aponta para CORS.
    public static readonly string[] OrigensPadraoDeDesenvolvimento =
        ["http://localhost:5173", "http://localhost:5174"];

    public static string[] LerOrigens(IConfiguration configuracao)
    {
        ArgumentNullException.ThrowIfNull(configuracao);

        var origens = configuracao.GetSection(Secao).Get<string[]>();
        return origens is null || origens.Length == 0
            ? OrigensPadraoDeDesenvolvimento
            : origens;
    }
}
