using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;
using Microsoft.EntityFrameworkCore;

namespace Financeiro.Infrastructure.Persistencia;

// Implementacao da porta IRepositorioTransacoes.
//
// Tres regras atravessam a classe inteira:
//
// 1. Toda consulta filtra por usuario_id, e a PK e (UsuarioId, Id). Nao existe
//    caminho aqui que enderece uma linha sem o dono.
// 2. Nao existe Remove/DELETE. A unica forma de excluir e a agregada preencher
//    ExcluidoEm — e o banco reforca isso com um gatilho que recusa DELETE.
// 3. As consultas ordenadas rodam em SQL cru para que comparacao e ordenacao de
//    uuid aconteçam no Postgres. Ver SqlTransacoes.
public sealed class RepositorioTransacoes : IRepositorioTransacoes
{
    private readonly FinanceiroDbContext _contexto;

    public RepositorioTransacoes(FinanceiroDbContext contexto) => _contexto = contexto;

    public Task<Transacao?> ObterAsync(UsuarioId usuario, TransacaoId id, CancellationToken cancellationToken)
        => _contexto.Transacoes
            .FirstOrDefaultAsync(
                transacao => transacao.UsuarioId == usuario && transacao.Id == id,
                cancellationToken);

    public async Task<IReadOnlyList<Transacao>> ObterPorIdsAsync(
        UsuarioId usuario,
        IReadOnlyCollection<TransacaoId> ids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);

        if (ids.Count == 0)
        {
            return [];
        }

        var brutos = new Guid[ids.Count];
        var posicao = 0;
        foreach (var id in ids)
        {
            brutos[posicao] = id.Valor;
            posicao++;
        }

        return await _contexto.Transacoes
            .FromSqlRaw(SqlTransacoes.PorIds, usuario.Valor, brutos)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<Transacao>> ListarPorPeriodoAsync(
        UsuarioId usuario,
        DataMovimento inicio,
        DataMovimento fim,
        bool incluirExcluidas,
        CancellationToken cancellationToken)
    {
        // Intervalo fechado nos dois lados: BETWEEN do Postgres ja e inclusivo.
        // A comparacao e sobre 'date', nao sobre texto, entao nao depende de colacao.
        var sql = incluirExcluidas
            ? SqlTransacoes.PeriodoComExcluidas
            : SqlTransacoes.PeriodoSemExcluidas;

        return await _contexto.Transacoes
            .FromSqlRaw(sql, usuario.Valor, inicio.Valor, fim.Valor)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    // O pull. INCLUI as excluidas — sem elas o aparelho que estava offline nunca
    // fica sabendo do que sumiu.
    public async Task<IReadOnlyList<Transacao>> ListarAlteradasDesdeAsync(
        UsuarioId usuario,
        DateTimeOffset? desde,
        TransacaoId? ultimoId,
        int limite,
        CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(limite);

        // O carimbo de corte passa pela mesma normalizacao do dominio (UTC truncado
        // em milissegundo). Sem isso, um 'desde' com 7 casas vindo de fora nunca
        // empataria com o carimbo de 3 casas gravado, e a fronteira inclusiva do
        // segundo caso deixaria de incluir o que deveria.
        var corte = Instante.Normalizar(desde);

        var consulta = (corte, ultimoId) switch
        {
            (null, _) => _contexto.Transacoes.FromSqlRaw(
                SqlTransacoes.PullDoInicio,
                usuario.Valor,
                limite),

            ({ } inicio, null) => _contexto.Transacoes.FromSqlRaw(
                SqlTransacoes.PullInclusivo,
                usuario.Valor,
                inicio,
                limite),

            ({ } inicio, { } ultimo) => _contexto.Transacoes.FromSqlRaw(
                SqlTransacoes.PullKeyset,
                usuario.Valor,
                inicio,
                ultimo.Valor,
                limite),
        };

        // Nenhum operador LINQ depois do FromSqlRaw: compor aqui faria o EF
        // embrulhar o SQL numa subconsulta, e ORDER BY dentro de subconsulta nao e
        // garantido pelo padrao. A ordem que chega e a que o Postgres produziu.
        return await consulta.ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task AdicionarAsync(Transacao transacao, CancellationToken cancellationToken)
        => await _contexto.Transacoes.AddAsync(transacao, cancellationToken).ConfigureAwait(false);

    // No-op: o change tracker do EF ja sabe que a agregada carregada mudou. A porta
    // declara o metodo para nao presumir rastreamento em outra implementacao.
    public void Atualizar(Transacao transacao)
    {
        ArgumentNullException.ThrowIfNull(transacao);
    }
}
