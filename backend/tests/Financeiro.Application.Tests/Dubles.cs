using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Application.Tests;

// Relogio controlado. A regra inteira de sincronizacao e comparacao de carimbos:
// sem controlar o tempo, nenhum teste de conflito seria deterministico.
internal sealed class RelogioFixo : IRelogio
{
    public RelogioFixo(string iso) => Agora = Instante.Analisar(iso);

    public DateTimeOffset Agora { get; set; }
}

internal sealed class UnidadeDeTrabalhoFake : IUnidadeDeTrabalho
{
    public int Salvamentos { get; private set; }

    public int Transacoes { get; private set; }

    public Task SalvarAlteracoesAsync(CancellationToken cancellationToken)
    {
        Salvamentos++;
        return Task.CompletedTask;
    }

    public Task<T> ExecutarEmTransacaoAsync<T>(
        Func<CancellationToken, Task<T>> operacao,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(operacao);

        Transacoes++;
        return operacao(cancellationToken);
    }
}

// Implementa o contrato documentado na porta: escopo por usuario, sem DELETE,
// pull por chave composta (AtualizadoEm, Id) e excluidas incluidas no pull.
internal sealed class RepositorioEmMemoria : IRepositorioTransacoes
{
    private readonly List<Transacao> _itens = [];

    public IReadOnlyList<Transacao> Itens => _itens;

    public int Adicionadas { get; private set; }

    public int Atualizadas { get; private set; }

    public void Semear(params Transacao[] transacoes) => _itens.AddRange(transacoes);

    public Transacao? Buscar(TransacaoId id) => _itens.Find(t => t.Id == id);

    public Task<Transacao?> ObterAsync(UsuarioId usuario, TransacaoId id, CancellationToken cancellationToken)
        => Task.FromResult(_itens.Find(t => t.UsuarioId == usuario && t.Id == id));

    public Task<IReadOnlyList<Transacao>> ObterPorIdsAsync(
        UsuarioId usuario,
        IReadOnlyCollection<TransacaoId> ids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);

        IReadOnlyList<Transacao> encontradas = _itens
            .Where(t => t.UsuarioId == usuario && ids.Contains(t.Id))
            .ToList();

        return Task.FromResult(encontradas);
    }

    public Task<IReadOnlyList<Transacao>> ListarPorPeriodoAsync(
        UsuarioId usuario,
        DataMovimento inicio,
        DataMovimento fim,
        bool incluirExcluidas,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Transacao> encontradas = _itens
            .Where(t => t.UsuarioId == usuario)
            .Where(t => t.Data.EstaNoIntervalo(inicio, fim))
            .Where(t => incluirExcluidas || !t.EstaExcluida)
            .OrderBy(t => t.Data)
            .ThenBy(t => t.Id.ToString(), StringComparer.Ordinal)
            .ToList();

        return Task.FromResult(encontradas);
    }

    public Task<IReadOnlyList<Transacao>> ListarAlteradasDesdeAsync(
        UsuarioId usuario,
        DateTimeOffset? desde,
        TransacaoId? ultimoId,
        int limite,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Transacao> pagina = _itens
            .Where(t => t.UsuarioId == usuario)
            .Where(t => DepoisDoMarco(t, desde, ultimoId))
            .OrderBy(t => t.AtualizadoEm)
            .ThenBy(t => t.Id.ToString(), StringComparer.Ordinal)
            .Take(limite)
            .ToList();

        return Task.FromResult(pagina);
    }

    public Task AdicionarAsync(Transacao transacao, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(transacao);

        Adicionadas++;
        _itens.Add(transacao);
        return Task.CompletedTask;
    }

    public void Atualizar(Transacao transacao) => Atualizadas++;

    private static bool DepoisDoMarco(Transacao transacao, DateTimeOffset? desde, TransacaoId? ultimoId)
    {
        if (desde is null)
        {
            return true;
        }

        if (transacao.AtualizadoEm > desde.Value)
        {
            return true;
        }

        if (transacao.AtualizadoEm < desde.Value)
        {
            return false;
        }

        return ultimoId is null
            || string.CompareOrdinal(transacao.Id.ToString(), ultimoId.Value.ToString()) > 0;
    }
}
