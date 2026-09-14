using Financeiro.Infrastructure.Identidade;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Financeiro.Infrastructure.Persistencia;

// Fabricas usadas SO pelo 'dotnet ef' na hora de gerar e aplicar migrations.
//
// Existem para que as migrations sejam geradas a partir deste projeto, sem
// depender do projeto de API como startup. A API esta sendo construida em
// paralelo; amarrar a geracao de migration ao estado de compilacao dela faria uma
// tarefa de infraestrutura falhar por um motivo que nao e dela.
internal static class ConexaoDeDesign
{
    // Variavel de ambiente tem precedencia; o fallback aponta para o Postgres do
    // docker-compose deste repositorio (porta 5433, credenciais de
    // desenvolvimento ja publicas no docker-compose.yml). Nao e, e nao deve virar,
    // caminho de producao.
    public const string VariavelDeAmbiente = "FINANCEIRO_CONEXAO";

    private const string PadraoDeDesenvolvimento =
        "Host=localhost;Port=5433;Database=financeiro;Username=financeiro;Password=financeiro_dev";

    public static string Obter()
    {
        var configurada = Environment.GetEnvironmentVariable(VariavelDeAmbiente);
        return string.IsNullOrWhiteSpace(configurada) ? PadraoDeDesenvolvimento : configurada;
    }
}

public sealed class FabricaDeDesignFinanceiro : IDesignTimeDbContextFactory<FinanceiroDbContext>
{
    public FinanceiroDbContext CreateDbContext(string[] args)
    {
        var opcoes = new DbContextOptionsBuilder<FinanceiroDbContext>()
            .UseNpgsql(ConexaoDeDesign.Obter(), npgsql => npgsql.MigrationsHistoryTable(
                FinanceiroDbContext.TabelaDeHistorico,
                FinanceiroDbContext.Esquema))
            .Options;

        return new FinanceiroDbContext(opcoes);
    }
}

public sealed class FabricaDeDesignIdentidade : IDesignTimeDbContextFactory<IdentidadeDbContext>
{
    public IdentidadeDbContext CreateDbContext(string[] args)
    {
        var opcoes = new DbContextOptionsBuilder<IdentidadeDbContext>()
            .UseNpgsql(ConexaoDeDesign.Obter(), npgsql => npgsql.MigrationsHistoryTable(
                IdentidadeDbContext.TabelaDeHistorico,
                IdentidadeDbContext.Esquema))
            .Options;

        return new IdentidadeDbContext(opcoes);
    }
}
