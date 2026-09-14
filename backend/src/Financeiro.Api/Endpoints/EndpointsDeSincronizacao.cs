using Financeiro.Api.Erros;
using Financeiro.Api.Seguranca;
using Financeiro.Application.Transacoes.CasosDeUso;
using Financeiro.Application.Transacoes.Dtos;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Financeiro.Api.Endpoints;

// O endpoint central do app offline-first: push e pull na MESMA chamada.
//
// O aparelho manda o lote de deltas que acumulou e recebe de volta tudo que mudou
// desde o marco que ele guardou. Duas rotas separadas dariam duas transacoes e uma
// janela em que o pull nao enxerga o proprio push que acabou de acontecer.
internal static class EndpointsDeSincronizacao
{
    public static RouteGroupBuilder MapearSincronizacao(this RouteGroupBuilder grupo)
    {
        ArgumentNullException.ThrowIfNull(grupo);

        grupo.MapPost("/sincronizacao", SincronizarAsync)
            .WithName("Sincronizar")
            .WithSummary("Envia o lote de deltas e recebe o que mudou desde o marco informado.")
            .Produces<RespostaSincronizacaoDto>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status400BadRequest)
            .Produces<RespostaDeErro>(StatusCodes.Status401Unauthorized);

        return grupo;
    }

    private static async Task<IResult> SincronizarAsync(
        RequisicaoSincronizacaoDto? requisicao,
        HttpContext contexto,
        SincronizarTransacoes caso,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(contexto);
        ArgumentNullException.ThrowIfNull(caso);

        // O dono do lote e quem o token diz que e. Qualquer usuarioId que venha no
        // corpo e simplesmente ignorado pelo desserializador — o DTO nao tem esse
        // campo, e e por isso que ele nao tem.
        if (!UsuarioAutenticado.TentarObter(contexto.User, out var usuario))
        {
            return ResultadosDeErro.NaoAutenticado();
        }

        if (requisicao is null)
        {
            return ResultadosDeErro.Invalido(ResultadosDeErro.MensagemCorpoAusente);
        }

        // 200 mesmo com item rejeitado no lote. O caso de uso devolve cada item com
        // sua situacao e motivo; derrubar o lote inteiro por causa de uma linha
        // torta travaria a sincronizacao daquele aparelho para sempre, porque ele
        // reenviaria o mesmo lote ruim em todo ciclo e nenhuma linha boa passaria.
        var resposta = await caso.ExecutarAsync(usuario, requisicao, cancellationToken).ConfigureAwait(false);
        return Results.Ok(resposta);
    }
}
