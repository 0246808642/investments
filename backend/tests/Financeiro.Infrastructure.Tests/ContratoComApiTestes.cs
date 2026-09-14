using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes;
using Financeiro.Infrastructure.Identidade;
using Financeiro.Infrastructure.Persistencia;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Financeiro.Infrastructure.Tests;

// O outro agente registra a infraestrutura chamando AdicionarInfraestrutura e mais
// nada. Estes testes sao o contrato: se um registro sumir daqui, quebra neste
// projeto e nao na API dele.
[Collection(ColecaoDeBanco.Nome)]
public sealed class ContratoComApiTestes
{
    private readonly BancoDeTestes _banco;

    public ContratoComApiTestes(BancoDeTestes banco) => _banco = banco;

    [Theory]
    [InlineData(typeof(IRepositorioTransacoes))]
    [InlineData(typeof(IUnidadeDeTrabalho))]
    [InlineData(typeof(IRelogio))]
    [InlineData(typeof(IServicoDeIdentidade))]
    [InlineData(typeof(FinanceiroDbContext))]
    [InlineData(typeof(IdentidadeDbContext))]
    public void UmaUnicaChamadaResolveTudoQueAApiPrecisa(Type servico)
    {
        using var escopo = _banco.Provedor.CreateScope();

        Assert.NotNull(escopo.ServiceProvider.GetRequiredService(servico));
    }

    // O relogio devolve UTC ja normalizado em milissegundo — a mesma precisao que o
    // cliente produz e que o last-write-wins compara.
    [Fact]
    public void RelogioDevolveUtcTruncadoEmMilissegundo()
    {
        var relogio = _banco.Provedor.GetRequiredService<IRelogio>();

        var agora = relogio.Agora;

        Assert.Equal(TimeSpan.Zero, agora.Offset);
        Assert.Equal(0, agora.Ticks % TimeSpan.TicksPerMillisecond);
    }

    // Sem connection string a aplicacao nao sobe. Um default silencioso apontaria
    // para o banco errado e ninguem perceberia ate os dados estarem no lugar errado.
    [Fact]
    public void SemConnectionStringAFalhaEhImediataEExplicita()
    {
        var configuracao = new ConfigurationBuilder().Build();

        var erro = Assert.Throws<InvalidOperationException>(
            () => new ServiceCollection().AdicionarInfraestrutura(configuracao));

        Assert.Contains(InjecaoDeDependencia.NomeDaConexao, erro.Message, StringComparison.Ordinal);
    }

    // Segredo de JWT ausente ou curto derruba na primeira resolucao, em vez de
    // assinar token com chave fraca.
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("curta-demais")]
    public void ChaveDeJwtAusenteOuCurtaEhRecusada(string? chave)
    {
        var configuracao = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["ConnectionStrings:" + InjecaoDeDependencia.NomeDaConexao] = _banco.Conexao,
                ["Jwt:Chave"] = chave,
                ["Jwt:Emissor"] = "financeiro",
                ["Jwt:Audiencia"] = "financeiro",
            })
            .Build();

        var provedor = new ServiceCollection()
            .AdicionarInfraestrutura(configuracao)
            .BuildServiceProvider();

        using var escopo = provedor.CreateScope();

        Assert.ThrowsAny<Exception>(
            () => escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>());
    }

    // A API precisa dos parametros de validacao ANTES de o container existir (o
    // AddJwtBearer roda no builder). Este e o caminho publico que ela usa.
    [Fact]
    public void ApiObtemOsParametrosDeValidacaoSemPrecisarDoContainer()
    {
        var opcoes = OpcoesJwt.Carregar(_banco.Configuracao());

        Assert.Null(opcoes.PrimeiroErro());

        var parametros = opcoes.ParametrosDeValidacao();

        Assert.True(parametros.ValidateIssuer);
        Assert.True(parametros.ValidateAudience);
        Assert.True(parametros.ValidateIssuerSigningKey);
        Assert.True(parametros.ValidateLifetime);
        Assert.Equal(_banco.Emissor, parametros.ValidIssuer);
        Assert.Equal(_banco.Audiencia, parametros.ValidAudience);
        Assert.Equal(ClaimsFinanceiro.UsuarioId, parametros.NameClaimType);
    }

    // Os dois contextos tem tabela de historico propria, cada uma no seu schema. E
    // isso que faz a separacao valer para o EF, e nao so na intencao: nenhum dos
    // dois enxerga as migrations do outro.
    [Fact]
    public void CadaContextoTemHistoricoDeMigrationsProprio()
    {
        Assert.NotEqual(FinanceiroDbContext.Esquema, IdentidadeDbContext.Esquema);
    }
}
