using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes.Dtos;
using Financeiro.Domain.Comum;

namespace Financeiro.Application.Transacoes.CasosDeUso;

// Upsert de uma transacao vinda do cliente (o endpoint de linha unica, para quando
// o aparelho esta online e nao quer esperar o proximo ciclo de sincronizacao).
//
// E a MESMA semantica do lote: o id vem de fora, "ja existe" e caso normal, e
// versao mais velha e descartada em silencio. Usa o mesmo aplicador de delta de
// proposito — duas portas de entrada com regras diferentes seria como o dado
// diverge entre um aparelho que sincroniza e outro que salva direto.
public sealed class RegistrarTransacao
{
    private readonly IRepositorioTransacoes _repositorio;
    private readonly IUnidadeDeTrabalho _unidadeDeTrabalho;

    public RegistrarTransacao(IRepositorioTransacoes repositorio, IUnidadeDeTrabalho unidadeDeTrabalho)
    {
        ArgumentNullException.ThrowIfNull(repositorio);
        ArgumentNullException.ThrowIfNull(unidadeDeTrabalho);

        _repositorio = repositorio;
        _unidadeDeTrabalho = unidadeDeTrabalho;
    }

    public async Task<ResultadoItemDto> ExecutarAsync(
        UsuarioId usuario,
        TransacaoEntradaDto entrada,
        CancellationToken cancellationToken)
    {
        if (usuario.EhVazio)
        {
            throw new ErroDeDominioException("Registrar transacao exige usuario autenticado");
        }

        if (!MapeadorTransacao.TentarValidar(entrada, out var delta, out var motivo))
        {
            return new ResultadoItemDto(entrada?.Id ?? string.Empty, SituacaoItem.Rejeitada.ParaTexto(), motivo);
        }

        var existente = await _repositorio.ObterAsync(usuario, delta.Id, cancellationToken).ConfigureAwait(false);

        ResultadoItemDto resultado;
        try
        {
            var aplicacao = AplicadorDeltaTransacao.Aplicar(usuario, delta, existente);

            if (aplicacao.EhNova)
            {
                await _repositorio.AdicionarAsync(aplicacao.Transacao, cancellationToken).ConfigureAwait(false);
            }
            else if (aplicacao.Situacao == SituacaoItem.Atualizada)
            {
                _repositorio.Atualizar(aplicacao.Transacao);
            }

            resultado = new ResultadoItemDto(delta.Id.ToString(), aplicacao.Situacao.ParaTexto(), null);
        }
        catch (ErroDeDominioException erro)
        {
            return new ResultadoItemDto(delta.Id.ToString(), SituacaoItem.Rejeitada.ParaTexto(), erro.Message);
        }

        await _unidadeDeTrabalho.SalvarAlteracoesAsync(cancellationToken).ConfigureAwait(false);
        return resultado;
    }
}
