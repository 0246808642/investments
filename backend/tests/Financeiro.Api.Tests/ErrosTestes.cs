using System.Net;
using System.Text;

namespace Financeiro.Api.Tests;

public class ErrosTestes
{
    public const string SegredoInterno = "senha-do-banco-na-connection-string";

    [Fact]
    public async Task ValorFracionadoNoJsonResponde400ENaoArredonda()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson(Cenario.EntradaJson(valor: "12.5"))));

        // Dinheiro e inteiro em centavos. Aceitar 12.5 e arredondar faria a API
        // concordar em silencio com um valor que o usuario nunca digitou — e o erro
        // so apareceria no saldo, meses depois, sem rastro.
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Empty(fabrica.Repositorio.Itens);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("erro").GetString()));
    }

    [Fact]
    public async Task ValorComoTextoNoJsonResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson(Cenario.EntradaJson(valor: "\"1000\""))));

        // AllowReadingFromString desligado de proposito: numero e numero.
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Empty(fabrica.Repositorio.Itens);
    }

    [Fact]
    public async Task JsonMalformadoResponde400ComMensagemUtil()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json("{\"transacoes\": [ {"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        var erro = corpo.GetProperty("erro").GetString();

        // Mensagem util, nao "Bad Request" pelado: sem isso o cliente sabe que
        // errou e nao sabe onde.
        Assert.False(string.IsNullOrWhiteSpace(erro));
        Assert.Contains("invalid", erro, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ContentTypeNaoJsonResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var conteudo = new StringContent(Cenario.LoteJson(), Encoding.UTF8, "text/plain");
        using var resposta = await cliente.PostAsync(Cenario.Rota(Cenario.RotaSincronizacao), conteudo);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("erro").GetString()));
    }

    [Fact]
    public async Task CorpoAusenteResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json("null"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task ErroDeDominioResponde400ComCorpoConsistente()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        // Periodo invertido: a Application lanca ErroDeDominioException, que e a
        // UNICA excecao que ela deixa subir.
        using var resposta = await cliente.GetAsync(Cenario.RotaListar("2026-09-30", "2026-09-01"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);

        // Mesmo formato { erro, detalhes } de 401, 404 e 500: o cliente tem UM
        // formato para tratar.
        Assert.Contains("Periodo invertido", corpo.GetProperty("erro").GetString(), StringComparison.Ordinal);
        Assert.Empty(corpo.GetProperty("detalhes").EnumerateArray());
    }

    [Fact]
    public async Task ExcecaoInesperadaResponde500SemVazarStackTrace()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        fabrica.Repositorio.FalhaProgramada = new InvalidOperationException(SegredoInterno);

        using var resposta = await cliente.GetAsync(Cenario.RotaListar("2026-09-01", "2026-09-30"));

        Assert.Equal(HttpStatusCode.InternalServerError, resposta.StatusCode);

        var texto = await resposta.Content.ReadAsStringAsync();

        // Nem a mensagem interna, nem o nome do tipo, nem o rastro de pilha. Stack
        // trace na resposta entrega caminho de arquivo, tipo interno e versao de
        // pacote para quem so mandou uma requisicao torta — e o ambiente aqui e
        // Development, justamente onde o ASP.NET renderizaria a pagina de erro.
        Assert.DoesNotContain(SegredoInterno, texto, StringComparison.Ordinal);
        Assert.DoesNotContain("InvalidOperationException", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("   at ", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("Financeiro.Api.Endpoints", texto, StringComparison.Ordinal);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("erro").GetString()));
    }
}
