using Financeiro.Api.Erros;
using Financeiro.Api.Seguranca;
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

    public const string MensagemNomeObrigatorio =
        "Informe o nome.";

    public const string MensagemSenhasObrigatorias =
        "Informe a senha atual e a nova.";

    public const string MensagemSenhaIgual =
        "A senha nova precisa ser diferente da atual.";

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

    // Mapeadas FORA de MapearAutenticacao porque aquele grupo e AllowAnonymous e
    // estas rotas sao o oposto: so entra quem ja tem token valido. Grupo proprio,
    // com RequireAuthorization, em vez de um AllowAnonymous no grupo brigando com
    // um RequireAuthorization no endpoint — briga que se resolve por ordem de
    // metadado, e ordem de metadado nao e lugar de guardar uma regra de acesso.
    public static RouteGroupBuilder MapearContaAutenticada(this RouteGroupBuilder grupo)
    {
        ArgumentNullException.ThrowIfNull(grupo);

        grupo.MapPost("/renovar", RenovarAsync)
            .WithName("Renovar")
            .WithSummary("Troca um token valido por outro com prazo novo.")
            .Produces<RespostaDeToken>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status401Unauthorized);

        grupo.MapPost("/nome", AlterarNomeAsync)
            .WithName("AlterarNome")
            .WithSummary("Troca o nome de exibicao e devolve a sessao atualizada.")
            .Produces<RespostaDeToken>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status400BadRequest)
            .Produces<RespostaDeErro>(StatusCodes.Status401Unauthorized);

        grupo.MapPost("/senha", AlterarSenhaAsync)
            .WithName("AlterarSenha")
            .WithSummary("Troca a senha, conferindo a atual, e devolve a sessao atualizada.")
            .Produces<RespostaDeToken>(StatusCodes.Status200OK)
            .Produces<RespostaDeErro>(StatusCodes.Status400BadRequest)
            .Produces<RespostaDeErro>(StatusCodes.Status401Unauthorized);

        return grupo;
    }

    private static async Task<IResult> AlterarNomeAsync(
        RequisicaoDeNome? requisicao,
        HttpContext contexto,
        IServicoDeIdentidade identidade,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(contexto);

        if (!UsuarioAutenticado.TentarObter(contexto.User, out var usuario))
        {
            return ResultadosDeErro.NaoAutenticado(MensagemCredenciaisInvalidas);
        }

        if (requisicao is null || string.IsNullOrWhiteSpace(requisicao.Nome))
        {
            return ResultadosDeErro.Invalido(MensagemNomeObrigatorio);
        }

        var resultado = await identidade
            .AlterarNomeAsync(usuario, requisicao.Nome, cancellationToken)
            .ConfigureAwait(false);

        // 400 e nao 401: quem chegou ate aqui tem token valido, entao a falha e do
        // dado enviado (nome curto, nome longo demais) e a tela precisa mostrar o
        // motivo no formulario, nao mandar a pessoa entrar de novo.
        return resultado.Sucesso
            ? Responder(resultado)
            : ResultadosDeErro.Invalido("Nao foi possivel alterar o nome.", resultado.Erros);
    }

    private static async Task<IResult> AlterarSenhaAsync(
        RequisicaoDeSenha? requisicao,
        HttpContext contexto,
        IServicoDeIdentidade identidade,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(contexto);

        if (!UsuarioAutenticado.TentarObter(contexto.User, out var usuario))
        {
            return ResultadosDeErro.NaoAutenticado(MensagemCredenciaisInvalidas);
        }

        if (requisicao is null
            || string.IsNullOrEmpty(requisicao.SenhaAtual)
            || string.IsNullOrEmpty(requisicao.SenhaNova))
        {
            return ResultadosDeErro.Invalido(MensagemSenhasObrigatorias);
        }

        // Barrado aqui e nao no servico: o Identity aceitaria trocar uma senha por
        // ela mesma sem reclamar, e a tela diria "senha alterada" sem nada ter
        // mudado — a pessoa sairia achando que trocou.
        if (string.Equals(requisicao.SenhaAtual, requisicao.SenhaNova, StringComparison.Ordinal))
        {
            return ResultadosDeErro.Invalido(MensagemSenhaIgual);
        }

        var resultado = await identidade
            .AlterarSenhaAsync(usuario, requisicao.SenhaAtual, requisicao.SenhaNova, cancellationToken)
            .ConfigureAwait(false);

        // Senha atual errada tambem e 400, e nao 401: 401 faz o cliente derrubar a
        // sessao (ver o tratamento de 401 em src/api/cliente.ts), e quem so errou a
        // digitacao do campo seria deslogado por causa de um erro de formulario.
        return resultado.Sucesso
            ? Responder(resultado)
            : ResultadosDeErro.Invalido("Nao foi possivel alterar a senha.", resultado.Erros);
    }

    private static async Task<IResult> RenovarAsync(
        HttpContext contexto,
        IServicoDeIdentidade identidade,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(contexto);

        // Nao le usuario do corpo nem da query: quem esta renovando sai do token,
        // igual a todo endpoint de dados. Aceitar um id de fora aqui seria emitir
        // token de qualquer conta para quem tivesse um token de qualquer outra.
        if (!UsuarioAutenticado.TentarObter(contexto.User, out var usuario))
        {
            return ResultadosDeErro.NaoAutenticado(MensagemCredenciaisInvalidas);
        }

        var resultado = await identidade.RenovarAsync(usuario, cancellationToken).ConfigureAwait(false);

        // 401 e nao 400: renovacao que falha significa que este token nao vale mais
        // (conta apagada), e a acao do cliente e a mesma do token vencido — entrar
        // de novo. Um 400 mandaria o app tratar como erro de formulario.
        return resultado.Sucesso
            ? Responder(resultado)
            : ResultadosDeErro.NaoAutenticado(MensagemCredenciaisInvalidas);
    }

    private static async Task<IResult> RegistrarAsync(
        RequisicaoDeRegistro? requisicao,
        IServicoDeIdentidade identidade,
        CancellationToken cancellationToken)
    {
        if (requisicao is null
            || !TentarLerCredenciais(
                new RequisicaoDeCredenciais(requisicao.Email, requisicao.Senha),
                out var email,
                out var senha))
        {
            return ResultadosDeErro.Invalido(MensagemCredenciaisObrigatorias);
        }

        // Ausencia do campo e erro de formulario e para aqui; o TAMANHO do nome e
        // regra de identidade e fica no servico, junto das outras. Duplicar a regra
        // de tamanho aqui criaria dois limites para manter iguais.
        if (string.IsNullOrWhiteSpace(requisicao.Nome))
        {
            return ResultadosDeErro.Invalido(MensagemNomeObrigatorio);
        }

        var resultado = await identidade
            .RegistrarAsync(email, senha, requisicao.Nome, cancellationToken)
            .ConfigureAwait(false);

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
            ? Results.Ok(new RespostaDeToken(token, Instante.ParaTexto(expiraEm), resultado.Nome))
            : throw new InvalidOperationException(
                "IServicoDeIdentidade devolveu sucesso sem token ou sem expiracao.");
}
