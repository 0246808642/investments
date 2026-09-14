using System.Net;

namespace Financeiro.Api.Tests;

public class TransacoesTestes
{
    [Fact]
    public async Task RegistrarGravaEDevolveSituacaoCriada()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaTransacoes),
            FabricaDeApi.Json(Cenario.EntradaJson()));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Equal("criada", corpo.GetProperty("situacao").GetString());
        Assert.Equal(Cenario.IdA, corpo.GetProperty("id").GetString());
        Assert.Single(fabrica.Repositorio.Itens);
    }

    [Fact]
    public async Task RegistrarComVersaoMaisVelhaDescartaSemErro()
    {
        using var fabrica = new FabricaDeApi();

        var ana = fabrica.Identidade.Cadastrar(Cenario.EmailDeAna, Cenario.Senha);
        fabrica.Repositorio.Semear(Cenario.Transacao(ana, atualizadoEm: "2026-09-20T09:00:00.000Z"));

        using var cliente = fabrica.CreateClient();
        using var login = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\"}"));
        var token = (await FabricaDeApi.LerAsync(login)).GetProperty("token").GetString();

        using var autenticado = fabrica.ClienteComToken(token ?? string.Empty);
        using var resposta = await autenticado.PostAsync(
            Cenario.Rota(Cenario.RotaTransacoes),
            FabricaDeApi.Json(Cenario.EntradaJson(updatedAt: "2026-09-14T12:00:00.000Z")));

        // Versao velha perdendo o last-write-wins e o desfecho NORMAL de dois
        // aparelhos offline, nao erro: 200 com "descartada".
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Equal("descartada", corpo.GetProperty("situacao").GetString());
    }

    [Fact]
    public async Task RegistrarLinhaUnicaInvalidaResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaTransacoes),
            FabricaDeApi.Json(Cenario.EntradaJson(data: "14/09/2026")));

        // Aqui NAO ha lote para proteger: a requisicao inteira e uma linha so, e
        // uma linha rejeitada e erro do chamador. No sync e o contrario, e de
        // proposito.
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("erro").GetString()));
        Assert.Empty(fabrica.Repositorio.Itens);
    }

    [Fact]
    public async Task ListarPorPeriodoFiltraPelaDataDoLancamento()
    {
        using var fabrica = new FabricaDeApi();

        var ana = fabrica.Identidade.Cadastrar(Cenario.EmailDeAna, Cenario.Senha);
        fabrica.Repositorio.Semear(
            Cenario.Transacao(ana, Cenario.IdA, data: "2026-09-14", descricao: "Dentro"),
            Cenario.Transacao(ana, Cenario.IdB, data: "2026-10-02", descricao: "Fora"));

        using var cliente = fabrica.CreateClient();
        using var login = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\"}"));
        var token = (await FabricaDeApi.LerAsync(login)).GetProperty("token").GetString();

        using var autenticado = fabrica.ClienteComToken(token ?? string.Empty);
        using var resposta = await autenticado.GetAsync(Cenario.RotaListar("2026-09-01", "2026-09-30"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        var linha = Assert.Single(corpo.EnumerateArray());
        Assert.Equal("Dentro", linha.GetProperty("descricao").GetString());
    }

    [Fact]
    public async Task ExcluirMarcaDeletedAtEMantemALinha()
    {
        using var fabrica = new FabricaDeApi();

        var ana = fabrica.Identidade.Cadastrar(Cenario.EmailDeAna, Cenario.Senha);
        fabrica.Repositorio.Semear(Cenario.Transacao(ana));

        using var cliente = fabrica.CreateClient();
        using var login = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\"}"));
        var token = (await FabricaDeApi.LerAsync(login)).GetProperty("token").GetString();

        using var autenticado = fabrica.ClienteComToken(token ?? string.Empty);
        using var resposta = await autenticado.DeleteAsync(
            Cenario.Rota(Cenario.RotaTransacoes + "/" + Cenario.IdA));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);

        // Carimbo do RELOGIO DO SERVIDOR, nao do cliente: quem apaga online esta
        // dizendo "agora", e "agora" aqui e a hora do servidor.
        Assert.Equal(FabricaDeApi.AgoraDoServidor, corpo.GetProperty("deletedAt").GetString());

        // Nunca DELETE: a linha continua na base para propagar a exclusao.
        Assert.Single(fabrica.Repositorio.Itens);
    }

    [Fact]
    public async Task ExcluirIdInexistenteResponde404()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.DeleteAsync(
            Cenario.Rota(Cenario.RotaTransacoes + "/" + Cenario.IdC));

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task ExcluirIdForaDoFormatoUuidResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.DeleteAsync(
            Cenario.Rota(Cenario.RotaTransacoes + "/nao-e-uuid"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task ListarSemParametroDePeriodoResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.GetAsync(Cenario.Rota(Cenario.RotaTransacoes));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }
}
