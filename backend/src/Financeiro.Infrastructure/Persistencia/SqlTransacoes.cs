using Financeiro.Infrastructure.Persistencia.Configuracoes;

namespace Financeiro.Infrastructure.Persistencia;

// As consultas ORDENADAS da tabela de transacoes, em SQL cru e constante.
//
// Por que SQL cru e nao LINQ:
//
// 1. O keyset compara a TUPLA (atualizado_em, id). Nao existe operador de
//    comparacao de tupla em LINQ, e reescrever como
//    "a > desde || (a == desde && id > ultimo)" exigiria comparar TransacaoId com
//    '>', que nao existe no tipo e cujo traducao dependeria do provedor.
//
// 2. A ordem do uuid precisa ser a do Postgres, e ela precisa ser a MESMA na
//    comparacao e na ordenacao. O Postgres ordena uuid comparando os 16 bytes na
//    ordem em que aparecem no texto.
//
//    Uma medicao vale mais que a lembranca aqui, e ela esta registrada em
//    OrdemDeGuidNoDotNetEmRelacaoAoPostgres (KeysetDoPullTestes): no .NET 10,
//    Guid.CompareTo COINCIDE com a ordem do Postgres — compara sem sinal, byte a
//    byte, big-endian. Quem diverge, e em cerca de metade dos pares, e a ordem de
//    bytes CRUA de Guid.ToByteArray(), que e little-endian nos tres primeiros
//    campos. Ou seja: a armadilha e real, mas mora na representacao em bytes (um
//    id mapeado para bytea, um comparador sobre byte[], um serializador), nao no
//    comparador padrao de hoje.
//
//    E exatamente por isso a comparacao fica no SQL: assim a corretude nao depende
//    de qual comparador do .NET por acaso concorda com o Postgres nesta versao. O
//    banco e a unica autoridade sobre a ordem do proprio tipo, e comparacao e
//    ordenacao acontecem no mesmo lugar, sobre o mesmo tipo, por construcao.
//
// Com SQL cru nao ha caminho para avaliacao em memoria porque nao ha expressao
// LINQ a ser traduzida.
//
// As strings sao 'const' e montadas so a partir de outras 'const': nao ha
// concatenacao de valor em tempo de execucao, entao nao ha superficie de injecao.
// Todo valor entra por parametro ({0}, {1}, ...), que o EF converte em parametro
// do Npgsql.
internal static class SqlTransacoes
{
    private const string Selecao =
        "SELECT " + EsquemaTransacoes.Colunas + " FROM " + EsquemaTransacoes.TabelaQualificada;

    private const string FiltroUsuario = " WHERE \"" + EsquemaTransacoes.UsuarioId + "\" = {0}";

    // ORDER BY do pull: os dois campos do keyset, na mesma ordem da comparacao e na
    // mesma ordem do indice ix_transacoes_usuario_atualizado_id.
    private const string OrdemKeyset =
        " ORDER BY \"" + EsquemaTransacoes.AtualizadoEm + "\", \"" + EsquemaTransacoes.Id + "\"";

    private const string OrdemPeriodo =
        " ORDER BY \"" + EsquemaTransacoes.Data + "\", \"" + EsquemaTransacoes.Id + "\"";

    // --- Pull do sync. Nenhuma das tres variantes filtra por excluido_em: o
    // aparelho offline descobre o que foi apagado justamente por essas linhas. ---

    // desde nulo -> do inicio de tudo.
    public const string PullDoInicio = Selecao + FiltroUsuario + OrdemKeyset + " LIMIT {1}";

    // desde sem ultimoId -> INCLUI as linhas com atualizado_em == desde. E '>=' de
    // proposito: reenviar uma linha ja conhecida e inofensivo (o cliente descarta
    // pela mesma regra de last-write-wins), enquanto usar '>' perderia toda linha
    // empatada exatamente no carimbo de corte.
    public const string PullInclusivo = Selecao + FiltroUsuario
        + " AND \"" + EsquemaTransacoes.AtualizadoEm + "\" >= {1}::timestamptz"
        + OrdemKeyset + " LIMIT {2}";

    // desde com ultimoId -> keyset estrito por comparacao de TUPLA.
    //
    // E aqui que a ordem do uuid tem que ser a do Postgres: a tupla e comparada
    // lexicograficamente, entao no empate de atualizado_em o desempate cai no
    // operador '>' do tipo uuid — o mesmo operador que o ORDER BY logo abaixo usa.
    // Comparacao e ordenacao coerentes entre si sao o que garante que a proxima
    // pagina comece exatamente onde a anterior parou, sem pular nem repetir.
    //
    // Sem OFFSET: OFFSET conta linhas, e a contagem muda quando alguem insere no
    // meio entre duas paginas.
    public const string PullKeyset = Selecao + FiltroUsuario
        + " AND (\"" + EsquemaTransacoes.AtualizadoEm + "\", \"" + EsquemaTransacoes.Id + "\")"
        + " > ({1}::timestamptz, {2}::uuid)"
        + OrdemKeyset + " LIMIT {3}";

    // --- Consulta por periodo, pela DATA DO LANCAMENTO (date, livre de colacao). ---

    public const string PeriodoComExcluidas = Selecao + FiltroUsuario
        + " AND \"" + EsquemaTransacoes.Data + "\" BETWEEN {1}::date AND {2}::date"
        + OrdemPeriodo;

    public const string PeriodoSemExcluidas = Selecao + FiltroUsuario
        + " AND \"" + EsquemaTransacoes.Data + "\" BETWEEN {1}::date AND {2}::date"
        + " AND \"" + EsquemaTransacoes.ExcluidoEm + "\" IS NULL"
        + OrdemPeriodo;

    // Lote inteiro numa ida so, com array de uuid em vez de N parametros: um lote
    // de 500 deltas viraria 500 consultas se fosse item a item.
    public const string PorIds = Selecao + FiltroUsuario
        + " AND \"" + EsquemaTransacoes.Id + "\" = ANY({1}::uuid[])";
}
