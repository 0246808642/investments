using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes;
using Financeiro.Infrastructure.Identidade;
using Financeiro.Infrastructure.Persistencia;
using Financeiro.Infrastructure.Tempo;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Financeiro.Infrastructure;

// Ponto de encontro unico com a API.
//
// A API chama AdicionarInfraestrutura e nao registra mais nada de infraestrutura
// na mao: DbContexts, repositorios, relogio, unidade de trabalho, Identity e
// servico de identidade saem todos daqui. Registro espalhado entre camadas e como
// um servico deixa de ser substituivel sem ninguem perceber.
//
// A unica coisa que a API precisa alem desta chamada sao os parametros de
// validacao do token, porque AddAuthentication roda antes do container existir.
// Estao em OpcoesJwt.Carregar(configuracao).ParametrosDeValidacao().
public static class InjecaoDeDependencia
{
    // Nome da connection string em ConnectionStrings.
    public const string NomeDaConexao = "Financeiro";

    public static IServiceCollection AdicionarInfraestrutura(
        this IServiceCollection services,
        IConfiguration configuracao)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuracao);

        var conexao = configuracao.GetConnectionString(NomeDaConexao);
        if (string.IsNullOrWhiteSpace(conexao))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:" + NomeDaConexao + " nao configurada. "
                + "Sem ela nao ha como decidir em qual banco escrever, e um default silencioso "
                + "apontaria a aplicacao para o banco errado.");
        }

        // Dependencias que o Identity assume existirem. Chamar aqui torna a
        // biblioteca autossuficiente (util nos testes de integracao); em um host
        // ASP.NET as duas chamadas sao idempotentes.
        services.AddOptions();
        services.AddLogging();

        RegistrarOpcoesDoToken(services, configuracao);
        RegistrarPersistencia(services, conexao);
        RegistrarIdentidade(services, conexao);

        return services;
    }

    private static void RegistrarOpcoesDoToken(IServiceCollection services, IConfiguration configuracao)
    {
        services
            .AddOptions<OpcoesJwt>()
            .Bind(configuracao.GetSection(OpcoesJwt.Secao))
            // Validacao na primeira resolucao: chave ausente ou curta vira excecao
            // com mensagem explicita, nao token assinado com segredo vazio.
            .Validate(opcoes => opcoes.PrimeiroErro() is null, "Configuracao de JWT invalida.");
    }

    private static void RegistrarPersistencia(IServiceCollection services, string conexao)
    {
        services.AddDbContext<FinanceiroDbContext>(opcoes =>
            opcoes.UseNpgsql(conexao, npgsql => npgsql.MigrationsHistoryTable(
                FinanceiroDbContext.TabelaDeHistorico,
                FinanceiroDbContext.Esquema)));

        services.AddScoped<IRepositorioTransacoes, RepositorioTransacoes>();
        services.AddScoped<IUnidadeDeTrabalho, UnidadeDeTrabalho>();

        // Sem estado e sem dependencia: uma instancia basta.
        services.AddSingleton<IRelogio, Relogio>();
    }

    private static void RegistrarIdentidade(IServiceCollection services, string conexao)
    {
        // Historico de migrations proprio, no schema proprio: e isto que faz a
        // separacao dos dois contextos valer para o EF, e nao so na intencao.
        services.AddDbContext<IdentidadeDbContext>(opcoes =>
            opcoes.UseNpgsql(conexao, npgsql => npgsql.MigrationsHistoryTable(
                IdentidadeDbContext.TabelaDeHistorico,
                IdentidadeDbContext.Esquema)));

        // AddIdentityCore e nao AddIdentity: AddIdentity traz cookie, SignInManager
        // e esquema de autenticacao proprio, que brigariam com o JWT Bearer da API.
        services
            .AddIdentityCore<UsuarioDaAplicacao>(opcoes =>
            {
                // Um e-mail, uma conta. Sem isto, o Identity aceitaria dois cadastros
                // com o mesmo e-mail e o login passaria a ser ambiguo.
                opcoes.User.RequireUniqueEmail = true;

                opcoes.Password.RequiredLength = 8;
                opcoes.Password.RequireDigit = true;
                opcoes.Password.RequireLowercase = true;
                opcoes.Password.RequireUppercase = true;

                // Comprimento e variedade de caixa ja carregam a entropia; exigir
                // simbolo empurra o usuario para a senha memorizavel de sempre com um
                // '!' no fim.
                opcoes.Password.RequireNonAlphanumeric = false;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<IdentidadeDbContext>();

        services.AddScoped<IServicoDeIdentidade, ServicoDeIdentidade>();
    }
}
