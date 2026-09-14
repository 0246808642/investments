namespace Financeiro.Infrastructure.Identidade;

// Nomes das claims que o token carrega. Sao constantes publicas porque a API
// precisa ler exatamente estas — adivinhar o nome da claim de usuario e como um
// endpoint passa a escopar consulta pelo usuario errado.
public static class ClaimsFinanceiro
{
    // A claim que carrega o UsuarioId do dominio, em formato UUID 8-4-4-4-12.
    //
    // E um nome proprio, e nao 'sub', porque o handler de JWT Bearer do ASP.NET
    // reescreve as claims registradas do JWT para as URIs longas do WS-Federation
    // quando MapInboundClaims esta ligado (o padrao): 'sub' chega no
    // ClaimsPrincipal como ClaimTypes.NameIdentifier. 'usuario_id' nao esta no mapa
    // de entrada, entao atravessa intacto com qualquer configuracao. O 'sub'
    // continua sendo emitido com o mesmo valor, para quem preferir le-lo.
    public const string UsuarioId = "usuario_id";
}
