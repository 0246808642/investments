using System.Globalization;
using System.Security.Cryptography;
using Financeiro.Infrastructure;
using Financeiro.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Financeiro.Infrastructure.Tests;

// Banco real, nao InMemory.
//
// O provedor InMemory nao tem chave primaria composta com semantica de banco, nao
// tem comparacao de tupla, nao tem tipo uuid e nao tem colacao — que e exatamente
// o conjunto de coisas que esta fatia precisa provar. Um teste verde contra
// InMemory aqui seria um teste que nao testa nada.
//
// Isolamento: cada execucao cria um BANCO descartavel proprio e aplica as
// migrations de verdade nele (as mesmas que vao para producao), e o derruba no
// fim. Assim nao existe "banco sujo" — e, de quebra, as migrations sao exercitadas
// a cada rodada em vez de so na hora de subir.
//
// Dentro da execucao, cada teste usa UsuarioId proprio. Como toda consulta do
// repositorio e escopada por usuario, isso ja da isolamento total entre testes sem
// precisar apagar linha nenhuma — o que e conveniente, porque apagar linha e
// justamente o que o banco proibe.
public sealed class BancoDeTestes : IAsyncLifetime
{
    private const string Servidor = "Host=localhost;Port=5433;Username=financeiro;Password=financeiro_dev";

    private const string ConexaoAdministrativa = Servidor + ";Database=postgres";

    private ServiceProvider? _provedor;

    public BancoDeTestes()
    {
        NomeDoBanco = "financeiro_testes_"
            + DateTime.UtcNow.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture)
            + "_"
            + Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture)[..8];

        Conexao = Servidor + ";Database=" + NomeDoBanco;

        // Segredo de JWT gerado na hora. Nao ha chave de teste fixa no codigo: um
        // valor escrito aqui seria o candidato obvio a virar o valor de producao
        // por copia e cola.
        ChaveDeAssinatura = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    }

    public string NomeDoBanco { get; }

    public string Conexao { get; }

    public string ChaveDeAssinatura { get; }

    public string Emissor { get; } = "financeiro-testes";

    public string Audiencia { get; } = "financeiro-clientes-testes";

    public IServiceProvider Provedor => _provedor
        ?? throw new InvalidOperationException("BancoDeTestes usado antes de InitializeAsync.");

    public async Task InitializeAsync()
    {
        await ExecutarNoServidorAsync("CREATE DATABASE \"" + NomeDoBanco + "\"").ConfigureAwait(false);

        var colecao = new ServiceCollection();

        // Exatamente o mesmo ponto de entrada que a API usa. Se o registro estiver
        // incompleto, quebra aqui antes de quebrar na API.
        colecao.AdicionarInfraestrutura(Configuracao());
        _provedor = colecao.BuildServiceProvider();

        await AplicadorDeMigracoes.AplicarAsync(_provedor).ConfigureAwait(false);
    }

    public async Task DisposeAsync()
    {
        if (_provedor is not null)
        {
            await _provedor.DisposeAsync().ConfigureAwait(false);
        }

        // Sem limpar os pools, o DROP falha com "banco em uso" por causa de conexoes
        // ociosas que o Npgsql ainda segura.
        NpgsqlConnection.ClearAllPools();

        await ExecutarNoServidorAsync(
            "DROP DATABASE IF EXISTS \"" + NomeDoBanco + "\" WITH (FORCE)").ConfigureAwait(false);
    }

    public IConfiguration Configuracao() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["ConnectionStrings:" + InjecaoDeDependencia.NomeDaConexao] = Conexao,
            ["Jwt:Chave"] = ChaveDeAssinatura,
            ["Jwt:Emissor"] = Emissor,
            ["Jwt:Audiencia"] = Audiencia,
            ["Jwt:MinutosDeValidade"] = "30",
        })
        .Build();

    public AsyncServiceScope CriarEscopo() => Provedor.CreateAsyncScope();

    // Contexto avulso que registra todo comando enviado ao Postgres. E como os
    // testes provam que a comparacao do keyset vai para o banco, e nao acontece em
    // memoria: o que se inspeciona e o SQL que realmente foi executado.
    public FinanceiroDbContext CriarContextoComCapturaDeSql(ICollection<string> comandos)
    {
        ArgumentNullException.ThrowIfNull(comandos);

        var opcoes = new DbContextOptionsBuilder<FinanceiroDbContext>()
            .UseNpgsql(Conexao)
            .LogTo(
                comandos.Add,
                [DbLoggerCategory.Database.Command.Name],
                Microsoft.Extensions.Logging.LogLevel.Information)
            .Options;

        return new FinanceiroDbContext(opcoes);
    }

    private static async Task ExecutarNoServidorAsync(string comando)
    {
        await using var conexao = new NpgsqlConnection(ConexaoAdministrativa);
        await conexao.OpenAsync().ConfigureAwait(false);
        await using var cmd = new NpgsqlCommand(comando, conexao);
        await cmd.ExecuteNonQueryAsync().ConfigureAwait(false);
    }
}

// Uma unica instancia do banco descartavel para toda a suite: criar e migrar um
// banco por classe de teste custaria segundos a cada classe sem comprar
// isolamento nenhum que o UsuarioId por teste ja nao de.
[CollectionDefinition(Nome)]
public sealed class ColecaoDeBanco : ICollectionFixture<BancoDeTestes>
{
    public const string Nome = "postgres-real";
}
