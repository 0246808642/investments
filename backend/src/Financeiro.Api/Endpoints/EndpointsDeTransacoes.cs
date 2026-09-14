using Financeiro.Api.Erros;
using Financeiro.Api.Seguranca;
using Financeiro.Application.Transacoes.CasosDeUso;
using Financeiro.Application.Transacoes.Dtos;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Financeiro.Api.Endpoints;

// As portas de linha unica, para quando o aparelho esta online e nao quer esperar
// o proximo ciclo de sincronizacao. Mesma semantica do lote (o caso de uso usa o
// mesmo aplicador de delta), so que uma linha por vez.
internal static class EndpointsDeTransacoes
{
    public static RouteGroupBuilder MapearTransacoes(this RouteGroupBuilder grupo)
    {
        ArgumentNullException.ThrowIfNull(grupo);

        grupo.MapPost("/transacoes", RegistrarAsync)
            .WithName("RegistrarTransacao")
            .WithSummary("Grava ou atualiza uma transacao (upsert por id do cliente).")
            .Produces<ResultadoItemDto>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status400BadRequest)
            .Produces<RespostaDeErro>(StatusCodes.Status401Unauthorized);

        grupo.MapGet("/transacoes", ListarAsync)
            .WithName("ListarTransacoes")
            .WithSummary("Lista por periodo de competencia (data do lancamento), inclusivo nas duas pontas.")
            .Produces<IReadOnlyList<TransacaoDto>>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status400BadRequest)
            .Produces<RespostaDeErro>(StatusCodes.Status401Unauthorized);

        grupo.MapDelete("/transacoes/{id}", ExcluirAsync)
            .WithName("ExcluirTransacao")
            .WithSummary("Exclusao logica: marca deletedAt e continua propagando pelo sync.")
            .Produces<TransacaoDto>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status400BadRequest)
            .Produces<RespostaDeErro>(StatusCodes.Status401Unauthorized)
            .Produces<RespostaDeErro>(StatusCodes.Status404NotFound);

        return grupo;
    }

    private static async Task<IResult> RegistrarAsync(
        TransacaoEntradaDto? entrada,
        HttpContext contexto,
        RegistrarTransacao caso,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(contexto);
        ArgumentNullException.ThrowIfNull(caso);

        if (!UsuarioAutenticado.TentarObter(contexto.User, out var usuario))
        {
            return ResultadosDeErro.NaoAutenticado();
        }

        if (entrada is null)
        {
            return ResultadosDeErro.Invalido(ResultadosDeErro.MensagemCorpoAusente);
        }

        var resultado = await caso.ExecutarAsync(usuario, entrada, cancellationToken).ConfigureAwait(false);

        // Aqui NAO ha lote para proteger: a requisicao inteira e uma linha so, e uma
        // linha rejeitada e erro do chamador. No sync e o contrario, e de proposito.
        return string.Equals(resultado.Situacao, SituacaoItem.Rejeitada.ParaTexto(), StringComparison.Ordinal)
            ? ResultadosDeErro.Invalido(resultado.Motivo ?? "Transacao rejeitada.")
            : Results.Ok(resultado);
    }

    private static async Task<IResult> ListarAsync(
        HttpContext contexto,
        ListarTransacoesPorPeriodo caso,
        string inicio,
        string fim,
        CancellationToken cancellationToken,
        bool incluirExcluidas = false)
    {
        ArgumentNullException.ThrowIfNull(contexto);
        ArgumentNullException.ThrowIfNull(caso);

        if (!UsuarioAutenticado.TentarObter(contexto.User, out var usuario))
        {
            return ResultadosDeErro.NaoAutenticado();
        }

        // Data invalida ou periodo invertido sobem como ErroDeDominioException e o
        // tratador global transforma em 400: consulta nao tem "item rejeitado".
        var transacoes = await caso
            .ExecutarAsync(usuario, inicio, fim, incluirExcluidas, cancellationToken)
            .ConfigureAwait(false);

        return Results.Ok(transacoes);
    }

    private static async Task<IResult> ExcluirAsync(
        string id,
        HttpContext contexto,
        ExcluirTransacao caso,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(contexto);
        ArgumentNullException.ThrowIfNull(caso);

        if (!UsuarioAutenticado.TentarObter(contexto.User, out var usuario))
        {
            return ResultadosDeErro.NaoAutenticado();
        }

        var transacao = await caso.ExecutarAsync(usuario, id, cancellationToken).ConfigureAwait(false);

        // Linha de outro usuario cai aqui como "nao existe" — o repositorio escopa
        // por usuario, entao 404 e a verdade desta conta. Devolver 403 confirmaria
        // que o id existe na base de outra pessoa.
        return transacao is null
            ? ResultadosDeErro.NaoEncontrado("Transacao \"" + id + "\" nao encontrada.")
            : Results.Ok(transacao);
    }
}
