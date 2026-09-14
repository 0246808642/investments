using System.Net;

namespace Financeiro.Api.Tests;

public class SincronizacaoTestes
{
    [Fact]
    public async Task PushEPullNaMesmaChamadaComCorpoCamelCase()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson(
                Cenario.EntradaJson(Cenario.IdA, valor: "1500", descricao: "Mercado"),
                Cenario.EntradaJson(Cenario.IdB, valor: "2500", descricao: "Farmacia"))));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);

        // Push: os dois deltas entraram.
        var resultados = corpo.GetProperty("resultados").EnumerateArray().ToList();
        Assert.Equal(2, resultados.Count);
        Assert.All(resultados, item => Assert.Equal("criada", item.GetProperty("situacao").GetString()));

        // Pull: a MESMA chamada ja devolve o que acabou de ser gravado. E o ponto
        // do endpoint unico — duas rotas separadas abririam uma janela em que o
        // pull nao enxerga o proprio push.
        var transacoes = corpo.GetProperty("transacoes").EnumerateArray().ToList();
        Assert.Equal(2, transacoes.Count);

        // Contrato de fio, um a um. Nomes errados aqui quebram o PWA em silencio:
        // o JSON chega, os campos vem undefined e a tela fica vazia sem erro.
        var primeira = transacoes[0];
        Assert.Equal("saida", primeira.GetProperty("tipo").GetString());
        Assert.Equal(1500, primeira.GetProperty("valor").GetInt64());
        Assert.Equal("2026-09-14", primeira.GetProperty("data").GetString());
        Assert.Equal(Cenario.Categoria, primeira.GetProperty("categoriaId").GetString());
        Assert.Equal("Mercado", primeira.GetProperty("descricao").GetString());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, primeira.GetProperty("contaId").ValueKind);
        Assert.Equal("2026-09-14T12:00:00.000Z", primeira.GetProperty("updatedAt").GetString());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, primeira.GetProperty("deletedAt").ValueKind);

        // Marco de paginacao e relogio do servidor.
        Assert.Equal("2026-09-14T12:00:00.000Z", corpo.GetProperty("proximoDesde").GetString());
        Assert.False(string.IsNullOrWhiteSpace(corpo.GetProperty("proximoUltimoId").GetString()));
        Assert.False(corpo.GetProperty("temMais").GetBoolean());
        Assert.Equal(FabricaDeApi.AgoraDoServidor, corpo.GetProperty("servidorEm").GetString());
    }

    [Fact]
    public async Task LoteComItemRuimResponde200ComOItemRejeitadoEOsBonsGravados()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson(
                Cenario.EntradaJson(Cenario.IdA, descricao: "Boa 1"),

                // Data fora do formato 'YYYY-MM-DD': o item cai, o lote nao.
                Cenario.EntradaJson(Cenario.IdB, data: "14/09/2026", descricao: "Torta"),
                Cenario.EntradaJson(Cenario.IdC, descricao: "Boa 2"))));

        // 200, NAO 400. Derrubar o lote inteiro por causa de uma linha torta
        // travaria a sincronizacao daquele aparelho para sempre: ele reenviaria o
        // mesmo lote ruim em todo ciclo e nenhuma linha boa passaria nunca.
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        var resultados = corpo.GetProperty("resultados").EnumerateArray().ToList();
        Assert.Equal(3, resultados.Count);

        var rejeitado = Assert.Single(
            resultados,
            item => string.Equals(item.GetProperty("situacao").GetString(), "rejeitada", StringComparison.Ordinal));

        // O id volta como o cliente mandou, para ele casar a resposta com a linha
        // local, e o motivo vem junto para a tela conseguir explicar o que houve.
        Assert.Equal(Cenario.IdB, rejeitado.GetProperty("id").GetString());
        Assert.False(string.IsNullOrWhiteSpace(rejeitado.GetProperty("motivo").GetString()));

        // As duas boas entraram.
        Assert.Equal(2, fabrica.Repositorio.Itens.Count);
        Assert.Contains(fabrica.Repositorio.Itens, t => t.Descricao == "Boa 1");
        Assert.Contains(fabrica.Repositorio.Itens, t => t.Descricao == "Boa 2");
    }

    [Fact]
    public async Task ItemQueFereInvarianteDoDominioTambemSoRejeitaOProprioItem()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson(
                // Valor zero fere a invariante da agregada (nao movimenta saldo).
                Cenario.EntradaJson(Cenario.IdA, valor: "0", descricao: "Zerada"),
                Cenario.EntradaJson(Cenario.IdB, descricao: "Boa"))));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        var rejeitado = Assert.Single(
            corpo.GetProperty("resultados").EnumerateArray(),
            item => string.Equals(item.GetProperty("situacao").GetString(), "rejeitada", StringComparison.Ordinal));

        Assert.Equal(Cenario.IdA, rejeitado.GetProperty("id").GetString());
        Assert.Single(fabrica.Repositorio.Itens);
    }

    [Fact]
    public async Task PullTrazExcluidasParaPropagarAExclusao()
    {
        using var fabrica = new FabricaDeApi();

        var ana = fabrica.Identidade.Cadastrar(Cenario.EmailDeAna, Cenario.Senha);
        fabrica.Repositorio.Semear(Cenario.Transacao(
            ana,
            Cenario.IdA,
            atualizadoEm: "2026-09-15T08:00:00.000Z",
            excluidoEm: "2026-09-15T08:00:00.000Z"));

        using var cliente = fabrica.CreateClient();
        using var login = await cliente.PostAsync(
            Cenario.Rota("/api/autenticacao/login"),
            FabricaDeApi.Json("{\"email\":\"" + Cenario.EmailDeAna + "\",\"senha\":\"" + Cenario.Senha + "\"}"));

        var token = (await FabricaDeApi.LerAsync(login)).GetProperty("token").GetString();
        using var autenticado = fabrica.ClienteComToken(token ?? string.Empty);

        using var resposta = await autenticado.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json(Cenario.LoteJson()));

        var corpo = await FabricaDeApi.LerAsync(resposta);
        var linha = Assert.Single(corpo.GetProperty("transacoes").EnumerateArray());

        // Sem a excluida no pull, o aparelho que estava offline nunca ficaria
        // sabendo do que foi apagado.
        Assert.Equal("2026-09-15T08:00:00.000Z", linha.GetProperty("deletedAt").GetString());
    }

    [Fact]
    public async Task MarcoDesdeInvalidoResponde400()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json("{\"transacoes\":[],\"desde\":\"ontem\",\"ultimoId\":null,\"limite\":500}"));

        // Marco torto e erro de PROTOCOLO, nao item de lote: o valor saiu de uma
        // resposta anterior deste mesmo servidor.
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Contains("desde", corpo.GetProperty("erro").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task LoteVazioEChamadaValidaDePullPuro()
    {
        using var fabrica = new FabricaDeApi();
        using var cliente = await fabrica.ClienteAutenticadoAsync(Cenario.EmailDeAna);

        using var resposta = await cliente.PostAsync(
            Cenario.Rota(Cenario.RotaSincronizacao),
            FabricaDeApi.Json("{\"transacoes\":[],\"desde\":null,\"ultimoId\":null,\"limite\":null}"));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await FabricaDeApi.LerAsync(resposta);
        Assert.Empty(corpo.GetProperty("resultados").EnumerateArray());
        Assert.Empty(corpo.GetProperty("transacoes").EnumerateArray());
    }
}
