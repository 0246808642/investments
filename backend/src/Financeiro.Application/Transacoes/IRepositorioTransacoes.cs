using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Application.Transacoes;

// Porta do repositorio. Regras que a implementacao NAO pode quebrar:
//
// 1. Toda consulta e escopada por UsuarioId. A chave primaria da tabela deve ser
//    (UsuarioId, Id) e nao Id sozinho: assim um id repetido entre usuarios e
//    estruturalmente incapaz de vazar linha de um para o outro.
// 2. Nao existe DELETE. Exclusao e ExcluidoEm preenchido, e a linha continua
//    trafegando para propagar a exclusao aos outros aparelhos.
// 3. ListarAlteradasDesdeAsync INCLUI excluidas — sem isso, o aparelho que estava
//    offline nunca fica sabendo do que foi apagado.
public interface IRepositorioTransacoes
{
    Task<Transacao?> ObterAsync(UsuarioId usuario, TransacaoId id, CancellationToken cancellationToken);

    // Carrega o lote inteiro de uma vez. Uma consulta por item transformaria um
    // lote de 500 deltas em 500 idas ao banco.
    Task<IReadOnlyList<Transacao>> ObterPorIdsAsync(
        UsuarioId usuario,
        IReadOnlyCollection<TransacaoId> ids,
        CancellationToken cancellationToken);

    // Intervalo fechado nos dois lados, por DATA DO LANCAMENTO (nao por carimbo de
    // atualizacao). Ordenado por Data e, em empate, por Id.
    Task<IReadOnlyList<Transacao>> ListarPorPeriodoAsync(
        UsuarioId usuario,
        DataMovimento inicio,
        DataMovimento fim,
        bool incluirExcluidas,
        CancellationToken cancellationToken);

    // O pull do sync. Paginacao por chave composta, nao por OFFSET:
    //
    //   WHERE (AtualizadoEm, Id) > (desde, ultimoId)
    //   ORDER BY AtualizadoEm, Id
    //   LIMIT limite
    //
    // Comparar so AtualizadoEm > desde perderia linhas silenciosamente quando
    // varias caem no mesmo milissegundo e a fronteira da pagina cai no meio delas —
    // e linha perdida no pull e dado que nunca mais chega no aparelho.
    //
    // ATENCAO ao implementar: a comparacao e a ordenacao do Id precisam ser as do
    // banco (uuid do Postgres), no mesmo lugar. Reordenar em memoria com
    // Guid.CompareTo do .NET usa outra ordem de bytes e volta a perder linhas na
    // fronteira.
    //
    // Fronteira, exatamente:
    //   desde nulo                -> do inicio de tudo;
    //   desde sem ultimoId        -> INCLUI as linhas com AtualizadoEm == desde
    //                                (reenvio inofensivo, o cliente descarta pela
    //                                mesma regra de LWW; excluir seria arriscar
    //                                perder linha);
    //   desde com ultimoId        -> keyset estrito, (AtualizadoEm, Id) > (desde, ultimoId).
    Task<IReadOnlyList<Transacao>> ListarAlteradasDesdeAsync(
        UsuarioId usuario,
        DateTimeOffset? desde,
        TransacaoId? ultimoId,
        int limite,
        CancellationToken cancellationToken);

    Task AdicionarAsync(Transacao transacao, CancellationToken cancellationToken);

    // Marca uma agregada ja carregada como suja. Com EF Core e no-op (o change
    // tracker ja sabe); existe para que a porta nao presuma rastreamento.
    void Atualizar(Transacao transacao);
}
