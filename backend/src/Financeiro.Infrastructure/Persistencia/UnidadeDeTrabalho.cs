using Financeiro.Application.Abstracoes;
using Microsoft.EntityFrameworkCore;

namespace Financeiro.Infrastructure.Persistencia;

// Transacao de banco do lote de sincronizacao.
//
// Nao ha retry automatico (EnableRetryOnFailure) de proposito: o EF reexecutaria o
// delegate com o change tracker ja sujo da tentativa anterior, e um lote de sync
// parcialmente aplicado duas vezes e pior do que um lote que falha inteiro e o
// cliente reenvia.
public sealed class UnidadeDeTrabalho : IUnidadeDeTrabalho
{
    private readonly FinanceiroDbContext _contexto;

    public UnidadeDeTrabalho(FinanceiroDbContext contexto) => _contexto = contexto;

    public Task SalvarAlteracoesAsync(CancellationToken cancellationToken)
        => _contexto.SaveChangesAsync(cancellationToken);

    public async Task<T> ExecutarEmTransacaoAsync<T>(
        Func<CancellationToken, Task<T>> operacao,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(operacao);

        // Reentrancia: se ja existe transacao aberta (caso de uso chamando outro),
        // participar dela em vez de abrir uma aninhada. Commit interno prematuro
        // publicaria metade do lote.
        if (_contexto.Database.CurrentTransaction is not null)
        {
            return await operacao(cancellationToken).ConfigureAwait(false);
        }

        await using var transacao = await _contexto.Database
            .BeginTransactionAsync(cancellationToken)
            .ConfigureAwait(false);

        var resultado = await operacao(cancellationToken).ConfigureAwait(false);

        await _contexto.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transacao.CommitAsync(cancellationToken).ConfigureAwait(false);

        return resultado;
    }
}
