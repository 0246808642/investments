using Financeiro.Application.Transacoes.Dtos;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Sincronizacao;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Application.Transacoes;

public readonly record struct AplicacaoDelta(Transacao Transacao, SituacaoItem Situacao, bool EhNova);

// Aplica um delta validado sobre o estado local. E funcao pura: sem repositorio,
// sem relogio, sem banco — recebe o que existe hoje e devolve o que passa a
// existir. O caso de uso cuida do IO em volta.
//
// Fica aqui, e nao na agregada, so a parte que e "novo ou existente"; a decisao de
// quem vence e sempre da agregada.
public static class AplicadorDeltaTransacao
{
    public static AplicacaoDelta Aplicar(UsuarioId usuario, TransacaoValidada delta, Transacao? existente)
    {
        ArgumentNullException.ThrowIfNull(delta);

        if (existente is null)
        {
            // Linha desconhecida pelo servidor. Pode chegar ja excluida: o aparelho
            // criou e apagou offline, antes de qualquer sincronizacao. Reconstituir
            // preserva os dois carimbos como vieram.
            var nova = Transacao.Reconstituir(
                delta.Id,
                usuario,
                delta.Dados,
                delta.AtualizadoEm,
                delta.ExcluidoEm);

            return new AplicacaoDelta(nova, SituacaoItem.Criada, EhNova: true);
        }

        var resultado = existente.AplicarAtualizacaoRemota(delta.Dados, delta.AtualizadoEm, delta.ExcluidoEm);

        var situacao = resultado == ResultadoSincronizacao.Aplicada
            ? SituacaoItem.Atualizada
            : SituacaoItem.Descartada;

        return new AplicacaoDelta(existente, situacao, EhNova: false);
    }
}
