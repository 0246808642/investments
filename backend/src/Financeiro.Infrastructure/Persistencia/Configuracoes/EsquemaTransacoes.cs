namespace Financeiro.Infrastructure.Persistencia.Configuracoes;

// Nomes fisicos da tabela de transacoes, num lugar so.
//
// Existem como constantes porque o repositorio monta as consultas ordenadas em SQL
// cru (ver RepositorioTransacoes): se o mapeamento renomeasse uma coluna e o SQL
// nao acompanhasse, o erro apareceria em producao, nao no build. Com constantes
// compartilhadas, mapeamento e SQL nao tem como divergir.
internal static class EsquemaTransacoes
{
    public const string Esquema = "financeiro";

    public const string Tabela = "transacoes";

    public const string TabelaQualificada = "\"" + Esquema + "\".\"" + Tabela + "\"";

    public const string UsuarioId = "usuario_id";

    public const string Id = "id";

    public const string Tipo = "tipo";

    public const string Valor = "valor";

    public const string Data = "data";

    public const string CategoriaId = "categoria_id";

    public const string Descricao = "descricao";

    public const string ContaId = "conta_id";

    public const string AtualizadoEm = "atualizado_em";

    public const string ExcluidoEm = "excluido_em";

    // Lista de projecao do SELECT cru. A ordem nao importa para o EF (ele casa por
    // nome), mas todas as colunas mapeadas precisam estar presentes.
    public const string Colunas =
        "\"" + UsuarioId + "\", "
        + "\"" + Id + "\", "
        + "\"" + Tipo + "\", "
        + "\"" + Valor + "\", "
        + "\"" + Data + "\", "
        + "\"" + CategoriaId + "\", "
        + "\"" + Descricao + "\", "
        + "\"" + ContaId + "\", "
        + "\"" + AtualizadoEm + "\", "
        + "\"" + ExcluidoEm + "\"";

    // Indice que sustenta o keyset do pull.
    public const string IndiceSincronizacao = "ix_transacoes_usuario_atualizado_id";

    // Indice que sustenta a consulta por periodo.
    public const string IndicePeriodo = "ix_transacoes_usuario_data_id";

    // Gatilho que recusa DELETE fisico na tabela.
    public const string GatilhoSemDelete = "transacoes_sem_delete";
}
