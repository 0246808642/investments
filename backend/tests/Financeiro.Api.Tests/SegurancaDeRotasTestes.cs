using System.Net;

namespace Financeiro.Api.Tests;

// O teste que impede o vazamento. Se algum destes cair, a API esta entregando dado
// de uma conta para outra — nao ha "gravidade media" aqui.
public class SegurancaDeRotasTestes
{
    public static TheoryData<string, string> RotasDeDado() => new()
    {
        { "POST", Cenario.RotaSincronizacao },
        { "POST", Cenario.RotaTransacoes },
        { "GET", Cenario.RotaTransacoes + "?inicio=2026-09-01&fim=2026-09-30" },
        { "DELETE", Cenario.RotaTransacoes + "/" + Cenario.IdA },
    };

    [Theory]
    [MemberData(nameof(RotasDeDado))]
    public async Task RotaDeDadoSemTokenResponde401(string metodo, string caminho)
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var requisicao = Montar(metodo, caminho);

        using var resposta = await cliente.SendAsync(requisicao);

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);

        // 401 com o mesmo corpo de erro de todo o resto da API.
        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("erro").GetString()));
    }

    [Theory]
    [MemberData(nameof(RotasDeDado))]
    public async Task RotaDeDadoComTokenForjadoResponde401(string metodo, string caminho)
    {
        using var fabrica = new FabricaDeApi();

        // Assinado com outra chave: a API precisa recusar pela assinatura, nao pelo
        // formato. Um token "parece JWT" nao vale nada.
        using var cliente = fabrica.ClienteComToken(
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWxzbyJ9.assinatura-invalida");

        using var requisicao = Montar(metodo, caminho);

        using var resposta = await cliente.SendAsync(requisicao);

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    // Corpo so onde o verbo tem corpo; GET com payload nao e requisicao real e
    // testar o irreal nao prova nada sobre a rota.
    private static HttpRequestMessage Montar(string metodo, string caminho)
    {
        var requisicao = new HttpRequestMessage(new HttpMethod(metodo), Cenario.Rota(caminho));

        if (string.Equals(metodo, "POST", StringComparison.Ordinal))
        {
            requisicao.Content = FabricaDeApi.Json(Cenario.LoteJson());
        }

        return requisicao;
    }

    [Fact]
    public async Task TokenValidoSemClaimDeUsuarioResponde401ENao500()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.ClienteComToken(fabrica.Identidade.TokenSemClaimDeUsuario());

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson()));

        // Claim faltando e falha de autenticacao, nao excecao nao tratada: 500 aqui
        // esconderia um token quebrado atras de "erro do servidor".
        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [Fact]
    public async Task SincronizacaoDeANuncaDevolveDadoDeB()
    {
        using var fabrica = new FabricaDeApi();

        var bruno = fabrica.Identidade.Cadastrar(Cenario.EmailDeBruno, Cenario.Senha);
        fabrica.Repositorio.Semear(Cenario.Transacao(bruno, Cenario.IdB, valor: 777, descricao: "Segredo do Bruno"));

        using var clienteDaAna = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await clienteDaAna.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson()));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Empty(corpo.GetProperty("transacoes").EnumerateArray());
        Assert.DoesNotContain("Segredo do Bruno", corpo.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task ListagemDeANuncaDevolveDadoDeB()
    {
        using var fabrica = new FabricaDeApi();

        var bruno = fabrica.Identidade.Cadastrar(Cenario.EmailDeBruno, Cenario.Senha);
        fabrica.Repositorio.Semear(Cenario.Transacao(bruno, Cenario.IdB, descricao: "Segredo do Bruno"));

        using var clienteDaAna = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await clienteDaAna.GetAsync(Cenario.RotaListar("2026-01-01", "2026-12-31"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Empty(corpo.EnumerateArray());
    }

    [Fact]
    public async Task ExclusaoDeLinhaDeOutroUsuarioResponde404ENaoApaga()
    {
        using var fabrica = new FabricaDeApi();

        var bruno = fabrica.Identidade.Cadastrar(Cenario.EmailDeBruno, Cenario.Senha);
        fabrica.Repositorio.Semear(Cenario.Transacao(bruno, Cenario.IdB));

        using var clienteDaAna = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await clienteDaAna.DeleteAsync(
            Cenario.Rota(Cenario.RotaTransacoes + "/" + Cenario.IdB));

        // 404, e nao 403: 403 confirmaria que aquele id existe na base de outra
        // pessoa, que ja e informacao a mais.
        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);

        var doBruno = fabrica.Repositorio.Buscar(Domain.Comum.TransacaoId.Analisar(Cenario.IdB));
        Assert.NotNull(doBruno);
        Assert.False(doBruno.EstaExcluida);
    }

    [Fact]
    public async Task DoisUsuariosPodemUsarOMesmoIdSemSeEnxergar()
    {
        using var fabrica = new FabricaDeApi();

        var bruno = fabrica.Identidade.Cadastrar(Cenario.EmailDeBruno, Cenario.Senha);
        fabrica.Repositorio.Semear(Cenario.Transacao(bruno, Cenario.IdA, valor: 999, descricao: "Do Bruno"));

        using var clienteDaAna = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var envio = await clienteDaAna.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson(Cenario.EntradaJson(valor: "1000", descricao: "Da Ana"))));

        Assert.Equal(HttpStatusCode.OK, envio.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(envio);

        // O mesmo id existe nas duas contas. A Ana ve so a versao dela; a linha do
        // Bruno nem foi tocada.
        var devolvidas = corpo.GetProperty("transacoes").EnumerateArray().ToList();
        Assert.Single(devolvidas);
        Assert.Equal("Da Ana", devolvidas[0].GetProperty("descricao").GetString());
        Assert.Equal(2, fabrica.Repositorio.Itens.Count);
        Assert.Contains(fabrica.Repositorio.Itens, t => t.UsuarioId == bruno && t.Descricao == "Do Bruno");
    }

    [Fact]
    public async Task UsuarioIdEnviadoNoCorpoEIgnorado()
    {
        using var fabrica = new FabricaDeApi();

        var bruno = fabrica.Identidade.Cadastrar(Cenario.EmailDeBruno, Cenario.Senha);

        using var clienteDaAna = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        // O cliente tenta se passar pelo Bruno por dois caminhos ao mesmo tempo:
        // campo no corpo e parametro de query. Nenhum dos dois existe no contrato, e
        // e exatamente por isso que nenhum dos dois funciona.
        var corpoMalicioso =
            "{\"usuarioId\":\"" + bruno + "\",\"transacoes\":["
            + Cenario.EntradaJson(descricao: "Tentativa")
            + "],\"desde\":null,\"ultimoId\":null,\"limite\":500}";

        using var resposta = await clienteDaAna.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao + "?usuarioId=" + bruno),
            FabricaDeApi.Json(corpoMalicioso));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var gravada = Assert.Single(fabrica.Repositorio.Itens);
        Assert.NotEqual(bruno, gravada.UsuarioId);
    }
}
