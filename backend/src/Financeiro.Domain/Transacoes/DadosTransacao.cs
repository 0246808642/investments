using Financeiro.Domain.Comum;

namespace Financeiro.Domain.Transacoes;

// O conteudo editavel de uma Transacao, separado dos campos de sincronizacao.
// Existe para que Criar e AplicarAtualizacaoRemota tenham a mesma assinatura de
// conteudo: uma versao remota e, literalmente, "estes dados com estes carimbos".
//
// E um carregador, nao um objeto validado: quem valida e a agregada, toda vez que
// escreve. Assim nao ha dois lugares onde a invariante possa divergir.
public sealed record DadosTransacao(
    TipoMovimento Tipo,
    Centavos Valor,
    DataMovimento Data,
    CategoriaId CategoriaId,
    string Descricao,
    ContaId? ContaId);
