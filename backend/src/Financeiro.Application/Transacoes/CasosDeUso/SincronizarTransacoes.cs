using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes.Dtos;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Application.Transacoes.CasosDeUso;

// O caso de uso central: recebe um lote de deltas do aparelho (push) e devolve o
// que mudou no servidor desde o marco que o aparelho informou (pull), tudo numa
// transacao so.
//
// Decisao de protocolo: um item malformado NAO derruba o lote. Ele volta como
// "rejeitada" com motivo e os outros entram. Derrubar o lote inteiro travaria a
// sincronizacao do aparelho para sempre — ele reenviaria o mesmo lote ruim em todo
// ciclo e nenhuma das linhas boas passaria nunca.
public sealed class SincronizarTransacoes
{
    public const int LimitePadrao = 500;

    public const int LimiteMaximo = 1000;

    private readonly IRepositorioTransacoes _repositorio;
    private readonly IUnidadeDeTrabalho _unidadeDeTrabalho;
    private readonly IRelogio _relogio;

    public SincronizarTransacoes(
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

    public Task<RespostaSincronizacaoDto> ExecutarAsync(
        UsuarioId usuario,
        RequisicaoSincronizacaoDto requisicao,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(requisicao);

        if (usuario.EhVazio)
        {
            throw new ErroDeDominioException("Sincronizacao exige usuario autenticado");
        }

        var marco = LerMarco(requisicao);
        var limite = NormalizarLimite(requisicao.Limite);

        return _unidadeDeTrabalho.ExecutarEmTransacaoAsync(
            token => ExecutarNaTransacaoAsync(usuario, requisicao, marco, limite, token),
            cancellationToken);
    }

    private static (DateTimeOffset? Desde, TransacaoId? UltimoId) LerMarco(RequisicaoSincronizacaoDto requisicao)
    {
        DateTimeOffset? desde = null;
        if (requisicao.Desde is not null)
        {
            if (!Instante.TentarAnalisar(requisicao.Desde, out var analisado))
            {
                // Marco invalido e erro de protocolo, nao conflito: o valor saiu de
                // uma resposta anterior deste mesmo servidor. Se aceitassemos "do
                // inicio" calados, o aparelho baixaria a base inteira de novo sem
                // ninguem entender por que.
                throw new ErroDeDominioException(
                    "Marco \"desde\" invalido, esperado ISO-8601 com fuso: \"" + requisicao.Desde + "\"");
            }

            desde = analisado;
        }

        TransacaoId? ultimoId = null;
        if (requisicao.UltimoId is not null)
        {
            if (!TransacaoId.TentarAnalisar(requisicao.UltimoId, out var analisado))
            {
                throw new ErroDeDominioException(
                    "Marco \"ultimoId\" invalido, esperado UUID: \"" + requisicao.UltimoId + "\"");
            }

            ultimoId = analisado;
        }

        // ultimoId sem desde nao e um marco: o par e indivisivel.
        return desde is null ? (null, null) : (desde, ultimoId);
    }

    private static int NormalizarLimite(int? limite) => limite switch
    {
        null or < 1 => LimitePadrao,
        > LimiteMaximo => LimiteMaximo,
        _ => limite.Value,
    };

    private async Task<RespostaSincronizacaoDto> ExecutarNaTransacaoAsync(
        UsuarioId usuario,
        RequisicaoSincronizacaoDto requisicao,
        (DateTimeOffset? Desde, TransacaoId? UltimoId) marco,
        int limite,
        CancellationToken cancellationToken)
    {
        var resultados = await AplicarLoteAsync(usuario, requisicao.Transacoes, cancellationToken)
            .ConfigureAwait(false);

        var alteradas = await _repositorio.ListarAlteradasDesdeAsync(
            usuario,
            marco.Desde,
            marco.UltimoId,
            limite,
            cancellationToken).ConfigureAwait(false);

        var temMais = alteradas.Count >= limite;
        var ultima = alteradas.Count == 0 ? null : alteradas[^1];

        return new RespostaSincronizacaoDto(
            Transacoes: MapeadorTransacao.ParaDtos(alteradas),
            Resultados: resultados,
            // Sem linha nenhuma na pagina, o marco anterior continua valendo — e
            // devolver null faria o aparelho recomecar do zero na proxima chamada.
            ProximoDesde: ultima is null
                ? (marco.Desde is null ? null : Instante.ParaTexto(marco.Desde.Value))
                : Instante.ParaTexto(ultima.AtualizadoEm),
            ProximoUltimoId: ultima is null ? marco.UltimoId?.ToString() : ultima.Id.ToString(),
            TemMais: temMais,
            ServidorEm: Instante.ParaTexto(_relogio.Agora));
    }

    private async Task<IReadOnlyList<ResultadoItemDto>> AplicarLoteAsync(
        UsuarioId usuario,
        IReadOnlyList<TransacaoEntradaDto>? entradas,
        CancellationToken cancellationToken)
    {
        var resultados = new List<ResultadoItemDto>();
        if (entradas is null || entradas.Count == 0)
        {
            return resultados;
        }

        var validados = new List<(TransacaoEntradaDto? Entrada, TransacaoValidada? Delta, string? Motivo)>();
        var ids = new HashSet<TransacaoId>();

        foreach (var entrada in entradas)
        {
            if (MapeadorTransacao.TentarValidar(entrada, out var delta, out var motivo))
            {
                validados.Add((entrada, delta, null));
                ids.Add(delta.Id);
            }
            else
            {
                validados.Add((entrada, null, motivo));
            }
        }

        IReadOnlyList<Transacao> existentes = ids.Count == 0
            ? []
            : await _repositorio.ObterPorIdsAsync(usuario, ids, cancellationToken).ConfigureAwait(false);

        // Conjunto de trabalho: o mesmo id pode aparecer duas vezes no lote (dois
        // deltas da mesma linha). A segunda ocorrencia precisa disputar contra o
        // resultado da primeira, e nao contra o que estava no banco.
        var emTrabalho = new Dictionary<TransacaoId, Transacao>();
        foreach (var existente in existentes)
        {
            emTrabalho[existente.Id] = existente;
        }

        foreach (var (entrada, delta, motivo) in validados)
        {
            if (delta is null)
            {
                resultados.Add(new ResultadoItemDto(entrada?.Id ?? string.Empty, SituacaoItem.Rejeitada.ParaTexto(), motivo));
                continue;
            }

            emTrabalho.TryGetValue(delta.Id, out var atual);

            try
            {
                var aplicacao = AplicadorDeltaTransacao.Aplicar(usuario, delta, atual);
                emTrabalho[delta.Id] = aplicacao.Transacao;

                if (aplicacao.EhNova)
                {
                    await _repositorio.AdicionarAsync(aplicacao.Transacao, cancellationToken).ConfigureAwait(false);
                }
                else if (aplicacao.Situacao == SituacaoItem.Atualizada)
                {
                    _repositorio.Atualizar(aplicacao.Transacao);
                }

                resultados.Add(new ResultadoItemDto(delta.Id.ToString(), aplicacao.Situacao.ParaTexto(), null));
            }
            catch (ErroDeDominioException erro)
            {
                // Invariante ferida (valor nao positivo, descricao gigante...). So
                // este item cai. A agregada valida antes de mudar qualquer campo,
                // entao o estado em memoria continua integro.
                resultados.Add(new ResultadoItemDto(delta.Id.ToString(), SituacaoItem.Rejeitada.ParaTexto(), erro.Message));
            }
        }

        await _unidadeDeTrabalho.SalvarAlteracoesAsync(cancellationToken).ConfigureAwait(false);
        return resultados;
    }
}
