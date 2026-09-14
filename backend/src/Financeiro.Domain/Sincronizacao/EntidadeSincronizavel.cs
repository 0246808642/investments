using Financeiro.Domain.Comum;

namespace Financeiro.Domain.Sincronizacao;

// Espelha o BaseEntity do cliente (id, updatedAt, deletedAt) e concentra a
// politica de last-write-wins. Categoria e Conta herdam daqui depois sem
// reescrever a resolucao de conflito — que e o unico lugar do sistema onde um
// erro sutil apaga dado do usuario sem ninguem perceber.
public abstract class EntidadeSincronizavel<TId>
    where TId : struct
{
    protected EntidadeSincronizavel(
        TId id,
        UsuarioId usuarioId,
        DateTimeOffset atualizadoEm,
        DateTimeOffset? excluidoEm)
    {
        if (usuarioId.EhVazio)
        {
            throw new ErroDeDominioException("UsuarioId e obrigatorio: registro sem dono vazaria entre contas");
        }

        Id = id;
        UsuarioId = usuarioId;
        AtualizadoEm = Instante.Normalizar(atualizadoEm);
        ExcluidoEm = Instante.Normalizar(excluidoEm);
    }

    // Construtor sem argumentos para materializacao por ORM. O estado real vem dos
    // campos mapeados, nunca de um caminho de negocio.
    protected EntidadeSincronizavel()
    {
        Id = default;
        UsuarioId = default;
        AtualizadoEm = default;
        ExcluidoEm = null;
    }

    public TId Id { get; private set; }

    // Escopo multiusuario: toda consulta filtra por aqui, inclusive a de sync.
    public UsuarioId UsuarioId { get; private set; }

    // Sempre UTC, truncado em milissegundos (ver Instante).
    public DateTimeOffset AtualizadoEm { get; private set; }

    // Exclusao logica. Nunca existe DELETE: a linha some da UI, mas continua
    // trafegando para propagar a exclusao para os outros aparelhos.
    public DateTimeOffset? ExcluidoEm { get; private set; }

    public bool EstaExcluida => ExcluidoEm is not null;

    // Texto deterministico do conteudo proprio da agregada, usado so para
    // desempatar carimbos iguais. Nao entra em nenhuma outra decisao.
    protected abstract string Assinatura { get; }

    // O coracao do sistema. Decide, sem tocar no estado, se a versao que chegou
    // vence a armazenada.
    //
    // 1. Carimbo remoto maior  -> vence (last-write-wins puro).
    // 2. Carimbo remoto menor  -> descartado em silencio.
    // 3. Empate exato de carimbo -> regra de desempate deterministica:
    //    3a. exclusao vence atualizacao (tombstone wins);
    //    3b. persistindo o empate, vence a maior chave ordinal (conteudo + carimbo
    //        de exclusao). E uma ordem total que nao depende da ordem de chegada,
    //        entao dois aparelhos que reenviarem o mesmo par de deltas em ordens
    //        diferentes convergem para o mesmo estado;
    //    3c. chaves iguais -> e o mesmo delta de novo, no-op idempotente.
    protected ResultadoSincronizacao DecidirAplicacaoRemota(
        DateTimeOffset remotoAtualizadoEm,
        DateTimeOffset? remotoExcluidoEm,
        string remotoAssinatura)
    {
        var remoto = Instante.Normalizar(remotoAtualizadoEm);

        if (remoto > AtualizadoEm)
        {
            return ResultadoSincronizacao.Aplicada;
        }

        if (remoto < AtualizadoEm)
        {
            return ResultadoSincronizacao.DescartadaPorSerMaisAntiga;
        }

        var remotoExcluido = remotoExcluidoEm is not null;
        if (remotoExcluido != EstaExcluida)
        {
            return remotoExcluido
                ? ResultadoSincronizacao.Aplicada
                : ResultadoSincronizacao.DescartadaPorDesempate;
        }

        var comparacao = string.CompareOrdinal(
            MontarChaveDesempate(remotoAssinatura, remotoExcluidoEm),
            MontarChaveDesempate(Assinatura, ExcluidoEm));

        if (comparacao > 0)
        {
            return ResultadoSincronizacao.Aplicada;
        }

        return comparacao < 0
            ? ResultadoSincronizacao.DescartadaPorDesempate
            : ResultadoSincronizacao.DescartadaPorSerIdentica;
    }

    protected void DefinirCarimbos(DateTimeOffset atualizadoEm, DateTimeOffset? excluidoEm)
    {
        AtualizadoEm = Instante.Normalizar(atualizadoEm);
        ExcluidoEm = Instante.Normalizar(excluidoEm);
    }

    // Escrita local (a que acontece agora, no servidor) precisa de carimbo
    // monotonico: relogio andando para tras aqui e defeito de infraestrutura, nao
    // conflito de sincronizacao, e calar isso produziria uma linha que nunca mais
    // sincroniza.
    protected void GarantirCarimboMonotonico(DateTimeOffset instante)
    {
        if (Instante.Normalizar(instante) < AtualizadoEm)
        {
            throw new ErroDeDominioException(
                "Carimbo de escrita local anterior ao ultimo carimbo conhecido: "
                + Instante.ParaTexto(instante)
                + " < "
                + Instante.ParaTexto(AtualizadoEm));
        }
    }

    private static string MontarChaveDesempate(string assinatura, DateTimeOffset? excluidoEm)
        => assinatura + "|" + (excluidoEm is null ? string.Empty : Instante.ParaTexto(excluidoEm.Value));
}
