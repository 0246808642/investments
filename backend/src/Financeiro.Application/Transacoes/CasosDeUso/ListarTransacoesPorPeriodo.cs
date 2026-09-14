using Financeiro.Application.Transacoes.Dtos;
using Financeiro.Domain.Comum;

namespace Financeiro.Application.Transacoes.CasosDeUso;

// Consulta por periodo de COMPETENCIA (data do lancamento), que e o que a tela de
// mes do cliente pede. Nao confundir com o pull do sync, que filtra por carimbo de
// atualizacao: sao dois eixos de tempo diferentes e trocar um pelo outro devolve a
// lista errada sem erro nenhum.
public sealed class ListarTransacoesPorPeriodo
{
    private readonly IRepositorioTransacoes _repositorio;

    public ListarTransacoesPorPeriodo(IRepositorioTransacoes repositorio)
    {
        ArgumentNullException.ThrowIfNull(repositorio);

        _repositorio = repositorio;
    }

    public async Task<IReadOnlyList<TransacaoDto>> ExecutarAsync(
        UsuarioId usuario,
        string inicio,
        string fim,
        bool incluirExcluidas,
        CancellationToken cancellationToken)
    {
        if (usuario.EhVazio)
        {
            throw new ErroDeDominioException("Listagem exige usuario autenticado");
        }

        // Consulta nao tem "item rejeitado": parametro invalido e erro do chamador e
        // sobe como ErroDeDominioException para a API virar 400.
        var dataInicio = DataMovimento.Analisar(inicio);
        var dataFim = DataMovimento.Analisar(fim);

        if (dataInicio > dataFim)
        {
            throw new ErroDeDominioException(
                "Periodo invertido: inicio " + dataInicio.ToString() + " e posterior ao fim " + dataFim.ToString());
        }

        var transacoes = await _repositorio.ListarPorPeriodoAsync(
            usuario,
            dataInicio,
            dataFim,
            incluirExcluidas,
            cancellationToken).ConfigureAwait(false);

        return MapeadorTransacao.ParaDtos(transacoes);
    }
}
