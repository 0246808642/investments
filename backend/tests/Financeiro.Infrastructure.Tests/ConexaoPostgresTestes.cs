using Financeiro.Infrastructure.Persistencia;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Financeiro.Infrastructure.Tests;

// A conversao de DATABASE_URL e a unica coisa entre o app e o banco em producao.
// Errar aqui nao da erro de compilacao nem falha de teste em outro lugar: da
// "senha invalida" no primeiro deploy, com a senha certa configurada.
public sealed class ConexaoPostgresTestes
{
    private const string UrlDoProvedor =
        "postgres://neondb_owner:npg_Ab3xY@ep-cool-name-123-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

    [Fact]
    public void ConverteUrlDoProvedorParaPalavrasChave()
    {
        var construtor = new NpgsqlConnectionStringBuilder(ConexaoPostgres.ConverterUrl(UrlDoProvedor));

        Assert.Equal("ep-cool-name-123-pooler.us-east-1.aws.neon.tech", construtor.Host);
        Assert.Equal("neondb", construtor.Database);
        Assert.Equal("neondb_owner", construtor.Username);
        Assert.Equal("npg_Ab3xY", construtor.Password);
        Assert.Equal(SslMode.Require, construtor.SslMode);
    }

    [Fact]
    public void UsaPortaPadraoQuandoUrlNaoTrazPorta()
    {
        // uri.Port devolve -1 quando a porta esta ausente. Passar isso adiante
        // produziria "Port=-1", que so falha na hora de conectar.
        var construtor = new NpgsqlConnectionStringBuilder(ConexaoPostgres.ConverterUrl(UrlDoProvedor));

        Assert.Equal(5432, construtor.Port);
    }

    [Fact]
    public void RespeitaPortaExplicita()
    {
        var construtor = new NpgsqlConnectionStringBuilder(
            ConexaoPostgres.ConverterUrl("postgresql://u:s@servidor:6543/banco"));

        Assert.Equal(6543, construtor.Port);
    }

    [Fact]
    public void DecodificaSenhaComCaractereEspecial()
    {
        // Senha gerada por provedor traz '@', '/' e '%' com frequencia, e eles
        // viajam percent-encoded. Sem decodificar, a autenticacao falha com uma
        // senha que parece certa em qualquer log.
        var construtor = new NpgsqlConnectionStringBuilder(
            ConexaoPostgres.ConverterUrl("postgres://usuario:s%40nha%2Fcom%25sinal@servidor/banco"));

        Assert.Equal("s@nha/com%sinal", construtor.Password);
    }

    [Fact]
    public void LimitaOPoolParaAmbienteServerless()
    {
        var construtor = new NpgsqlConnectionStringBuilder(ConexaoPostgres.ConverterUrl(UrlDoProvedor));

        Assert.Equal(5, construtor.MaxPoolSize);
    }

    [Theory]
    [InlineData("disable", SslMode.Disable)]
    [InlineData("prefer", SslMode.Prefer)]
    [InlineData("verify-full", SslMode.VerifyFull)]
    public void MapeiaSslModeDaQuery(string valor, SslMode esperado)
    {
        var construtor = new NpgsqlConnectionStringBuilder(
            ConexaoPostgres.ConverterUrl("postgres://u:s@servidor/banco?sslmode=" + valor));

        Assert.Equal(esperado, construtor.SslMode);
    }

    [Fact]
    public void ExigeSslQuandoAQueryNaoDizNada()
    {
        // Banco gerenciado trafega pela internet publica. Assumir texto claro seria
        // a escolha errada justamente no caso em que o parametro foi esquecido.
        var construtor = new NpgsqlConnectionStringBuilder(
            ConexaoPostgres.ConverterUrl("postgres://u:s@servidor/banco"));

        Assert.Equal(SslMode.Require, construtor.SslMode);
    }

    [Theory]
    [InlineData("mysql://u:s@servidor/banco")]
    [InlineData("nao-e-uma-url")]
    [InlineData("postgres://u:s@servidor")]
    public void RecusaUrlForaDoFormato(string url)
    {
        Assert.Throws<InvalidOperationException>(() => ConexaoPostgres.ConverterUrl(url));
    }

    [Fact]
    public void PreferConnectionStringsSobreDatabaseUrl()
    {
        // Em desenvolvimento as duas podem existir ao mesmo tempo (um .env herdado,
        // uma variavel exportada no shell). A explicita ganha: senao o dev editaria
        // o appsettings e continuaria falando com outro banco.
        var configuracao = Configuracao(
            ("ConnectionStrings:Financeiro", "Host=local;Database=dev;Username=u;Password=s"),
            ("DATABASE_URL", UrlDoProvedor));

        Assert.Contains("Host=local", ConexaoPostgres.Resolver(configuracao), StringComparison.Ordinal);
    }

    [Fact]
    public void CaiParaDatabaseUrlQuandoNaoHaConnectionString()
    {
        var configuracao = Configuracao(("DATABASE_URL", UrlDoProvedor));

        Assert.Contains("neon.tech", ConexaoPostgres.Resolver(configuracao), StringComparison.Ordinal);
    }

    [Fact]
    public void FalhaQuandoNenhumaDasDuasExiste()
    {
        // Sem conexao nao ha como decidir em qual banco escrever, e um default
        // silencioso apontaria a aplicacao para o banco errado.
        Assert.Throws<InvalidOperationException>(() => ConexaoPostgres.Resolver(Configuracao()));
    }

    private static IConfiguration Configuracao(params (string Chave, string Valor)[] valores)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(valores.Select(par => new KeyValuePair<string, string?>(par.Chave, par.Valor)))
            .Build();
}
