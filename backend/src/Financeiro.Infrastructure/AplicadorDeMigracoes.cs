using Financeiro.Infrastructure.Identidade;
using Financeiro.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Financeiro.Infrastructure;

// Aplicacao das migrations dos dois contextos, na ordem.
//
// Existe para que a API (e os testes) nao precisem saber quais contextos a
// infraestrutura tem: acrescentar um terceiro amanha nao deve exigir edicao no
// Program.cs. Cada contexto tem tabela de historico propria, entao as duas
// chamadas sao independentes — nenhuma enxerga as migrations da outra.
public static class AplicadorDeMigracoes
{
    public static async Task AplicarAsync(
        IServiceProvider provedor,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(provedor);

        await using var escopo = provedor.CreateAsyncScope();

        await escopo.ServiceProvider
            .GetRequiredService<FinanceiroDbContext>()
            .Database.MigrateAsync(cancellationToken)
            .ConfigureAwait(false);

        await escopo.ServiceProvider
            .GetRequiredService<IdentidadeDbContext>()
            .Database.MigrateAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
