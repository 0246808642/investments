using System.Net;

namespace Financeiro.Api.Tests;

public class OpenApiTestes
{
    [Fact]
    public async Task DocumentoDeDesenvolvimentoDeclaraOEsquemaBearer()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = fabrica.CreateClient();

        using var resposta = await cliente.GetAsync(Cenario.Rota("/openapi/v1.json"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var documento = await FabricaDeApi.LerAsync(resposta);
        var esquema = documento
            .GetProperty("components")
            .GetProperty("securitySchemes")
            .GetProperty("Bearer");

        // Sem isto a UI do Swagger nao tem botao "Authorize" — da para ler a lista
        // de rotas e nao da para exercitar nenhuma rota autenticada, que sao todas
        // as de dado.
        Assert.Equal("http", esquema.GetProperty("type").GetString());
        Assert.Equal("bearer", esquema.GetProperty("scheme").GetString());
        Assert.Equal("JWT", esquema.GetProperty("bearerFormat").GetString());

        // As rotas de dado estao no documento com os caminhos que o cliente vai usar.
        var caminhos = documento.GetProperty("paths");
        Assert.True(caminhos.TryGetProperty(Cenario.RotaSincronizacao, out _));
        Assert.True(caminhos.TryGetProperty(Cenario.RotaTransacoes, out _));
        Assert.True(caminhos.TryGetProperty("/api/autenticacao/login", out _));
    }
}
