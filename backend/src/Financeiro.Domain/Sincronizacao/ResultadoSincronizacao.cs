namespace Financeiro.Domain.Sincronizacao;

// Desfecho de uma escrita. Descartar nao e falha: e o resultado normal de dois
// aparelhos offline editando a mesma linha. Por isso isto e valor de retorno, e
// nao excecao.
public enum ResultadoSincronizacao
{
    // A versao recebida virou o estado corrente.
    Aplicada,

    // A versao recebida e mais velha que a armazenada. Silenciosamente ignorada.
    DescartadaPorSerMaisAntiga,

    // Empate no carimbo de tempo e a regra de desempate deu vitoria ao local.
    DescartadaPorDesempate,

    // Mesmo carimbo e mesmo conteudo: reenvio do mesmo delta. Operacao idempotente.
    DescartadaPorSerIdentica,
}
