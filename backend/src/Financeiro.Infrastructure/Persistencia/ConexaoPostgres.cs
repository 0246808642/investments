using System.Globalization;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Financeiro.Infrastructure.Persistencia;

// De onde sai a connection string, e em que formato.
//
// Sao duas procedencias com formatos diferentes:
//
//   desenvolvimento  ConnectionStrings:Financeiro, ja no formato de palavras-chave
//                    do Npgsql (appsettings.Development.json)
//   producao         DATABASE_URL, no formato URI que a Vercel injeta quando o
//                    banco Neon e conectado ao projeto
//
// Ler a URI em vez de exigir que alguem copie a connection string para uma segunda
// variavel nao e comodidade: a variavel da Vercel e marcada como Sensitive, ou
// seja, nunca mais pode ser lida depois de criada. Uma copia manual nasceria
// desatualizada no dia em que a senha do banco fosse rotacionada — e o app cairia
// com "senha invalida" sem ninguem ter mexido em nada.
public static class ConexaoPostgres
{
    public const string NomeDaConexao = "Financeiro";

    public const string VariavelDeUrl = "DATABASE_URL";

    // Serverless: cada instancia do container vive pouco e varias sobem ao mesmo
    // tempo sob carga. Pool grande em muitas instancias estoura o max_connections
    // do Postgres antes de qualquer uma delas chegar perto de usar o que reservou.
    private const int TamanhoMaximoDoPool = 5;

    public static string Resolver(IConfiguration configuracao)
    {
        ArgumentNullException.ThrowIfNull(configuracao);

        var direta = configuracao.GetConnectionString(NomeDaConexao);
        if (!string.IsNullOrWhiteSpace(direta))
        {
            return direta;
        }

        var url = configuracao[VariavelDeUrl];
        if (!string.IsNullOrWhiteSpace(url))
        {
            return ConverterUrl(url);
        }

        throw new InvalidOperationException(
            "Nenhuma conexao configurada. Defina ConnectionStrings:"
            + NomeDaConexao
            + " (desenvolvimento) ou "
            + VariavelDeUrl
            + " (producao). Sem ela nao ha como decidir em qual banco escrever, e um "
            + "default silencioso apontaria a aplicacao para o banco errado.");
    }

    // "host/banco", sem usuario e sem senha. Serve para o comando de manutencao
    // dizer em voz alta em qual banco ele vai mexer antes de mexer: a mesma
    // maquina alcanca o Postgres do docker e o de producao, e "achei que estava
    // apontando para o outro" e o erro que nao da para desfazer.
    public static string Descrever(string conexao)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(conexao);

        var construtor = new NpgsqlConnectionStringBuilder(conexao);
        return construtor.Host + "/" + construtor.Database;
    }

    // postgres://usuario:senha@host/banco?sslmode=require
    //   -> Host=host;Port=5432;Database=banco;Username=usuario;Password=senha;SSL Mode=Require
    public static string ConverterUrl(string url)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(url);

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != "postgres" && uri.Scheme != "postgresql"))
        {
            throw new InvalidOperationException(
                "DATABASE_URL fora do formato esperado (postgres://usuario:senha@host/banco).");
        }

        // UnescapeDataString e obrigatorio: senha gerada por provedor tem '%', '@' e
        // '/' com frequencia, e eles viajam percent-encoded na URI. Sem decodificar,
        // a autenticacao falha com uma senha que "parece" certa no log.
        var credenciais = uri.UserInfo.Split(':', 2);
        var usuario = Uri.UnescapeDataString(credenciais[0]);
        var senha = credenciais.Length > 1 ? Uri.UnescapeDataString(credenciais[1]) : string.Empty;

        var banco = uri.AbsolutePath.Trim('/');
        if (banco.Length == 0)
        {
            throw new InvalidOperationException("DATABASE_URL nao nomeia um banco de dados.");
        }

        var construtor = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            // uri.Port vem -1 quando a URL nao traz porta, que e o caso comum.
            Port = uri.IsDefaultPort ? 5432 : uri.Port,
            Database = banco,
            Username = usuario,
            Password = senha,
            SslMode = LerModoSsl(uri.Query),
            MaxPoolSize = TamanhoMaximoDoPool,
        };

        return construtor.ConnectionString;
    }

    // O provedor manda sslmode na query. Require e o padrao na ausencia dele: banco
    // gerenciado trafega pela internet publica, e assumir texto claro seria a
    // escolha errada justamente no caso em que o parametro foi esquecido.
    private static SslMode LerModoSsl(string query)
    {
        var valor = LerParametro(query, "sslmode");
        if (string.IsNullOrWhiteSpace(valor))
        {
            return SslMode.Require;
        }

        return valor.ToLower(CultureInfo.InvariantCulture) switch
        {
            "disable" => SslMode.Disable,
            "allow" => SslMode.Allow,
            "prefer" => SslMode.Prefer,
            "require" => SslMode.Require,
            "verify-ca" => SslMode.VerifyCA,
            "verify-full" => SslMode.VerifyFull,
            _ => SslMode.Require,
        };
    }

    // Leitura manual da query em vez de HttpUtility: esta e a unica coisa que se
    // precisa dela aqui, e o assembly System.Web nao faz parte do runtime base.
    private static string? LerParametro(string query, string nome)
    {
        foreach (var par in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var separador = par.IndexOf('=', StringComparison.Ordinal);
            if (separador < 0)
            {
                continue;
            }

            if (par.AsSpan(0, separador).Equals(nome, StringComparison.OrdinalIgnoreCase))
            {
                return Uri.UnescapeDataString(par[(separador + 1)..]);
            }
        }

        return null;
    }
}
