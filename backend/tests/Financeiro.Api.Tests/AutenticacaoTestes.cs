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
    public async Task AlterarNomeDevolveSessaoComONomeNovo()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna, Cenario.Senha, "Ana Souza");

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/nome"),
            FabricaDeApi.Json("{\"nome\":\"Ana Maria Souza\"}"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Equal("Ana Maria Souza", corpo.GetProperty("nome").GetString());

        // Token novo junto: o app troca a sessao inteira de uma vez, sem remendar
        // o nome por cima do registro antigo.
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("token").GetString()));

        // E o nome novo persiste: renovar depois traz o mesmo, nao o do cadastro.
        using var renovacao = await cliente.PostAsync(Cenario.Rota("/api/autenticacao/renovar"), content: null);
        var depois = await FabricaDeApi.LerAsync(renovacao);
        Assert.Equal("Ana Maria Souza", depois.GetProperty("nome").GetString());
    }

    [Fact]
    public async Task AlterarNomeVazioResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna, Cenario.Senha, "Ana Souza");

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/nome"),
            FabricaDeApi.Json("{\"nome\":\"   \"}"));

        // 400 e nao 401: o token esta bom, o dado e que nao — a tela precisa
        // mostrar o motivo no campo, nao mandar a pessoa entrar de novo.
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task AlterarNomeSemTokenResponde401()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/nome"),
            FabricaDeApi.Json("{\"nome\":\"Quem Quiser\"}"));

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [Fact]
    public async Task AlterarSenhaTrocaACredencialDeVerdade()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna, Cenario.Senha, "Ana Souza");

        using var troca = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/senha"),
            FabricaDeApi.Json("{\"senhaAtual\":\"" + Cenario.Senha + "\",\"senhaNova\":\"outra-senha-forte-9\"}"));

        Assert.Equal(HttpStatusCode.OK, troca.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace((await FabricaDeApi.LerAsync(troca)).GetProperty("token").GetString()));

        using var anonimo = fabrica.CreateClient();

        // A prova de que trocou: a antiga para de entrar e a nova entra.
        using var comAntiga = await anonimo.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\"}"));
        Assert.Equal(HttpStatusCode.Unauthorized, comAntiga.StatusCode);

        using var comNova = await anonimo.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"outra-senha-forte-9\"}"));
        Assert.Equal(HttpStatusCode.OK, comNova.StatusCode);
    }

    [Fact]
    public async Task AlterarSenhaComAtualErradaResponde400ENaoDerrubaASessao()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna, Cenario.Senha, "Ana Souza");

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/senha"),
            FabricaDeApi.Json("{\"senhaAtual\":\"chute-errado\",\"senhaNova\":\"outra-senha-forte-9\"}"));

        // 400 de propósito: com 401 o cliente derruba a sessao (ver o tratamento
        // de 401 em src/api/cliente.ts), e errar a digitacao de um campo
        // deslogaria a pessoa.
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Contains("atual", corpo.GetProperty("detalhes")[0].GetString(), StringComparison.OrdinalIgnoreCase);

        // A sessao continua de pe: o mesmo token ainda trabalha.
        using var renovacao = await cliente.PostAsync(Cenario.Rota("/api/autenticacao/renovar"), content: null);
        Assert.Equal(HttpStatusCode.OK, renovacao.StatusCode);
    }

    [Fact]
    public async Task AlterarSenhaParaAMesmaResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna, Cenario.Senha, "Ana Souza");

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/senha"),
            FabricaDeApi.Json("{\"senhaAtual\":\"" + Cenario.Senha + "\",\"senhaNova\":\"" + Cenario.Senha + "\"}"));

        // Sem isto a tela diria "senha alterada" sem nada ter mudado.
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task AlterarSenhaFracaResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna, Cenario.Senha, "Ana Souza");

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/senha"),
            FabricaDeApi.Json("{\"senhaAtual\":\"" + Cenario.Senha + "\",\"senhaNova\":\"123\"}"));

        // A politica do cadastro vale aqui igual: uma porta que aceita senha fraca
        // anula a regra da outra.
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task AlterarSenhaSemTokenResponde401()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/senha"),
            FabricaDeApi.Json("{\"senhaAtual\":\"seja-la\",\"senhaNova\":\"outra-senha-forte-9\"}"));

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
