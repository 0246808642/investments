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
    public const string OrigemPadraoDeDesenvolvimento = "http://localhost:5173";

    public static string[] LerOrigens(IConfiguration configuracao)
    {
        ArgumentNullException.ThrowIfNull(configuracao);

        var origens = configuracao.GetSection(Secao).Get<string[]>();
        return origens is null || origens.Length == 0
            ? [OrigemPadraoDeDesenvolvimento]
            : origens;
    }
}
