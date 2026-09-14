using System.Security.Claims;
using Financeiro.Domain.Comum;
using Financeiro.Infrastructure.Identidade;

namespace Financeiro.Api.Seguranca;

// O UNICO lugar da API que decide de quem e a requisicao.
//
// O UsuarioId sai do token e de mais lugar nenhum. Se um endpoint aceitasse
// usuarioId do corpo ou da query, qualquer usuario autenticado leria a base de
// qualquer outro trocando um campo — nao e detalhe de implementacao, e vazamento
// de dados entre contas.
//
// Claim ausente ou malformada e 401 (o chamador refaz o login), nunca excecao nao
// tratada: 500 aqui esconderia um token quebrado atras de "erro do servidor".
internal static class UsuarioAutenticado
{
    public const string ClaimSub = "sub";

    // Ordem de preferencia. A primeira e a constante publicada pela Infrastructure
    // (usuario_id) — nao um literal copiado, porque adivinhar o nome da claim e
    // como um endpoint passa a escopar consulta pelo usuario errado. As demais sao
    // rede de seguranca para token emitido com o mapa de claims ligado; nenhuma
    // afrouxa nada, todas exigem um UUID valido do mesmo jeito.
    private static readonly string[] TiposAceitos =
    [
        ClaimsFinanceiro.UsuarioId,
        ClaimSub,
        ClaimTypes.NameIdentifier,
        "nameid",
    ];

    public static bool TentarObter(ClaimsPrincipal? principal, out UsuarioId usuario)
    {
        usuario = default;

        if (principal?.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        foreach (var tipo in TiposAceitos)
        {
            if (UsuarioId.TentarAnalisar(principal.FindFirst(tipo)?.Value, out var analisado))
            {
                usuario = analisado;
                return true;
            }
        }

        return false;
    }
}
