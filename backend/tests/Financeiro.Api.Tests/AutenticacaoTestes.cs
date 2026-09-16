using System.Net;

namespace Financeiro.Api.Tests;

public class AutenticacaoTestes
{
    [Fact]
    public async Task SaudeRespondeSemToken()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.GetAsync(Cenario.Rota("/saude"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Equal("ok", corpo.GetProperty("status").GetString());
    }

    [Fact]
    public async Task RegistrarDevolveTokenEExpiracaoIso()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/registrar"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\",\"nome\":\"Ana Souza\"}"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("token").GetString()));

        // Mesmo formato de instante de updatedAt/deletedAt: um so no contrato.
        Assert.Equal("2026-09-20T11:00:00.000Z", corpo.GetProperty("expiraEm").GetString());
    }

    [Fact]
    public async Task RenovarDevolveTokenNovoParaQuemJaTemUmValido()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna, Cenario.Senha, "Ana Souza");

        using var resposta = await cliente.PostAsync(Cenario.Rota("/api/autenticacao/renovar"), content: null);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("token").GetString()));
        Assert.Equal("2026-09-20T11:00:00.000Z", corpo.GetProperty("expiraEm").GetString());

        // O nome volta junto: o app guarda a sessao inteira de novo depois de
        // renovar, e sem o nome o cabecalho passaria a mostrar o e-mail.
        Assert.Equal("Ana Souza", corpo.GetProperty("nome").GetString());
    }

    [Fact]
    public async Task RenovarSemTokenResponde401()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.PostAsync(Cenario.Rota("/api/autenticacao/renovar"), content: null);

        // O que prova que a rota nao herdou o AllowAnonymous do grupo de login:
        // um 200 aqui seria uma fabrica de tokens aberta a internet.
        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [Fact]
    public async Task RenovarComTokenSemClaimDeUsuarioResponde401()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.ClienteComToken(fabrica.Identidade.TokenSemClaimDeUsuario());

        using var resposta = await cliente.PostAsync(Cenario.Rota("/api/autenticacao/renovar"), content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [Fact]
    public async Task RegistrarComSenhaFracaResponde400ComTodosOsMotivos()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/registrar"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"123\",\"nome\":\"Ana Souza\"}"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);

        // Todos os motivos de uma vez: a tela mostra a lista inteira em vez de o
        // usuario descobrir um por tentativa.
        Assert.Equal(2, corpo.GetProperty("detalhes").GetArrayLength());
    }

    [Fact]
    public async Task LoginComCredenciaisCorretasDevolveTokenUsavel()
    {
        using var fabrica = new FabricaDeApi();
        fabrica.Identidade.Cadastrar(Cenario.EmailDeAna, Cenario.Senha);

        using var cliente = fabrica.CreateClient();
        using var login = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\",\"nome\":\"Ana Souza\"}"));

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var token = (await FabricaDeApi.LerAsync(login)).GetProperty("token").GetString();
        using var autenticado = fabrica.ClienteComToken(token ?? string.Empty);

        using var resposta = await autenticado.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson()));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
    }

    [Fact]
    public async Task LoginComSenhaErradaResponde401SemDizerSeOEmailExiste()
    {
        using var fabrica = new FabricaDeApi();
        fabrica.Identidade.Cadastrar(Cenario.EmailDeAna, Cenario.Senha);

        using var cliente = fabrica.CreateClient();

        using var senhaErrada = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"outra-coisa\"}"));

        using var emailInexistente = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"ninguem@exemplo.com\",\"senha\":\"outra-coisa\"}"));

        Assert.Equal(HttpStatusCode.Unauthorized, senhaErrada.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, emailInexistente.StatusCode);

        // Mensagem IDENTICA nos dois casos. Diferenciar transformaria o login num
        // verificador de cadastro: com a lista de e-mails da para descobrir quem e
        // cliente sem acertar nenhuma senha.
        var umaMensagem = (await FabricaDeApi.LerAsync(senhaErrada)).GetProperty("erro").GetString();
        var outraMensagem = (await FabricaDeApi.LerAsync(emailInexistente)).GetProperty("erro").GetString();
        Assert.Equal(umaMensagem, outraMensagem);
    }

    [Fact]
    public async Task LoginSemCredenciaisResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"\",\"senha\":\"\"}"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task RegistrarEmailJaUsadoResponde400()
    {
        using var fabrica = new FabricaDeApi();
        fabrica.Identidade.Cadastrar(Cenario.EmailDeAna, Cenario.Senha);

        using var cliente = fabrica.CreateClient();
        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/registrar"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\",\"nome\":\"Ana Souza\"}"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task RegistrarDevolveONomeParaAUiExibir()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/registrar"),
            FabricaDeApi.Json(
                "{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\",\"nome\":\"Ana Souza\"}"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Equal("Ana Souza", corpo.GetProperty("nome").GetString());
    }

    [Fact]
    public async Task RegistrarSemNomeResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/registrar"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\"}"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task LoginDevolveONomeDaContaJaCriada()
    {
        // O nome nao viaja no token: ele e dado de apresentacao, e o token e
        // credencial que vai em todo cabecalho Authorization. Entao o login precisa
        // devolve-lo no corpo, senao quem volta ao app depois de fechar a janela
        // veria o e-mail de novo.
        using var fabrica = new FabricaDeApi();
        fabrica.Identidade.Cadastrar(Cenario.EmailDeAna, Cenario.Senha, "Ana Souza");

        using var cliente = fabrica.CreateClient();
        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json(
                "{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\"}"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Equal("Ana Souza", corpo.GetProperty("nome").GetString());
    }
}
