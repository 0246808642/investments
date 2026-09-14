using Financeiro.Api.Erros;
using Financeiro.Application.Abstracoes;
using Financeiro.Domain.Comum;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Financeiro.Api.Endpoints;

internal static class EndpointsDeAutenticacao
{
    public const string MensagemCredenciaisObrigatorias =
        "Informe email e senha.";

    // Mensagem UNICA para "email nao existe" e "senha errada". Diferenciar as duas
    // transforma o login num verificador de cadastro: quem tem a lista de e-mails
    // descobre quais sao clientes sem acertar nenhuma senha.
    public const string MensagemCredenciaisInvalidas =
        "Email ou senha invalidos.";

    public static RouteGroupBuilder MapearAutenticacao(this RouteGroupBuilder grupo)
    {
        ArgumentNullException.ThrowIfNull(grupo);

        grupo.MapPost("/registrar", RegistrarAsync)
            .WithName("Registrar")
            .WithSummary("Cria a conta e ja devolve o token.")
            .Produces<RespostaDeToken>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status400BadRequest);

        grupo.MapPost("/login", AutenticarAsync)
            .WithName("Login")
            .WithSummary("Troca email e senha por um token Bearer.")
            .Produces<RespostaDeToken>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status400BadRequest)
            .Produces<RespostaDeErro>(StatusCodes.Status401Unauthorized);

        return grupo;
    }

    private static async Task<IResult> RegistrarAsync(
        RequisicaoDeCredenciais? requisicao,
        IServicoDeIdentidade identidade,
        CancellationToken cancellationToken)
    {
        if (!TentarLerCredenciais(requisicao, out var email, out var senha))
        {
            return ResultadosDeErro.Invalido(MensagemCredenciaisObrigatorias);
        }

        var resultado = await identidade.RegistrarAsync(email, senha, cancellationToken).ConfigureAwait(false);

        // Registro que falha e erro do dado enviado (senha fraca, email em uso):
        // 400 com a lista inteira de motivos, para a tela mostrar todos de uma vez
        // em vez de o usuario descobrir um por tentativa.
        return resultado.Sucesso
            ? Responder(resultado)
            : ResultadosDeErro.Invalido("Nao foi possivel criar a conta.", resultado.Erros);
    }

    private static async Task<IResult> AutenticarAsync(
        RequisicaoDeCredenciais? requisicao,
        IServicoDeIdentidade identidade,
        CancellationToken cancellationToken)
    {
        if (!TentarLerCredenciais(requisicao, out var email, out var senha))
        {
            return ResultadosDeErro.Invalido(MensagemCredenciaisObrigatorias);
        }

        var resultado = await identidade.AutenticarAsync(email, senha, cancellationToken).ConfigureAwait(false);

        return resultado.Sucesso
            ? Responder(resultado)
            : ResultadosDeErro.NaoAutenticado(MensagemCredenciaisInvalidas);
    }

    private static bool TentarLerCredenciais(
        RequisicaoDeCredenciais? requisicao,
        out string email,
        out string senha)
    {
        email = string.Empty;
        senha = string.Empty;

        if (requisicao is null
            || string.IsNullOrWhiteSpace(requisicao.Email)
            || string.IsNullOrEmpty(requisicao.Senha))
        {
            return false;
        }

        email = requisicao.Email.Trim();
        senha = requisicao.Senha;
        return true;
    }

    // Sucesso sem token seria um contrato quebrado do lado da identidade; vira 500
    // pelo tratador global em vez de devolver 200 com token nulo, que o cliente
    // guardaria e usaria em toda chamada seguinte.
    private static IResult Responder(ResultadoIdentidade resultado)
        => resultado is { Token: { } token, ExpiraEm: { } expiraEm }
            ? Results.Ok(new RespostaDeToken(token, Instante.ParaTexto(expiraEm)))
            : throw new InvalidOperationException(
                "IServicoDeIdentidade devolveu sucesso sem token ou sem expiracao.");
}
