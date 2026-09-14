using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes.Dtos;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Sincronizacao;

namespace Financeiro.Application.Transacoes.CasosDeUso;

// Exclusao logica pedida direto ao servidor. Nunca DELETE: a linha fica com
// ExcluidoEm preenchido e continua sendo devolvida pelo pull, que e como os outros
// aparelhos ficam sabendo que ela sumiu.
//
// O carimbo vem do relogio do servidor, nao do cliente: quem apaga online esta
// dizendo "agora", e "agora" aqui e a hora do servidor.
public sealed class ExcluirTransacao
{
    private readonly IRepositorioTransacoes _repositorio;
    private readonly IUnidadeDeTrabalho _unidadeDeTrabalho;
    private readonly IRelogio _relogio;

    public ExcluirTransacao(
        IRepositorioTransacoes repositorio,
        IUnidadeDeTrabalho unidadeDeTrabalho,
        IRelogio relogio)
    {
        ArgumentNullException.ThrowIfNull(repositorio);
        ArgumentNullException.ThrowIfNull(unidadeDeTrabalho);
        ArgumentNullException.ThrowIfNull(relogio);

        _repositorio = repositorio;
        _unidadeDeTrabalho = unidadeDeTrabalho;
        _relogio = relogio;
    }

    // Devolve null quando a linha nao existe para este usuario (a API responde 404).
    public async Task<TransacaoDto?> ExecutarAsync(
        UsuarioId usuario,
        string id,
        CancellationToken cancellationToken)
    {
        if (usuario.EhVazio)
        {
            throw new ErroDeDominioException("Exclusao exige usuario autenticado");
        }

        var transacaoId = TransacaoId.Analisar(id);
        var transacao = await _repositorio.ObterAsync(usuario, transacaoId, cancellationToken).ConfigureAwait(false);
        if (transacao is null)
        {
            return null;
        }

        // Excluir de novo e no-op idempotente: a resposta e a mesma, sem remarcar o
        // carimbo, entao um retry do cliente nao muda quem vence o proximo conflito.
        if (transacao.MarcarExcluida(_relogio.Agora) == ResultadoSincronizacao.Aplicada)
        {
            _repositorio.Atualizar(transacao);
            await _unidadeDeTrabalho.SalvarAlteracoesAsync(cancellationToken).ConfigureAwait(false);
        }

        return MapeadorTransacao.ParaDto(transacao);
    }
}
