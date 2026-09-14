using Financeiro.Application.Transacoes.CasosDeUso;
using Financeiro.Application.Transacoes.Dtos;
using Financeiro.Domain.Comum;

namespace Financeiro.Application.Tests;

public class SincronizarTransacoesTestes
{
    private readonly RepositorioEmMemoria _repositorio = new();
    private readonly UnidadeDeTrabalhoFake _unidade = new();
    private readonly RelogioFixo _relogio = new("2026-09-20T10:00:00.000Z");

    private SincronizarTransacoes CriarCasoDeUso() => new(_repositorio, _unidade, _relogio);

    [Fact]
    public async Task CriaLinhaQueOServidorNaoConhecia()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([Cenario.Entrada()]),
            CancellationToken.None);

        var item = Assert.Single(resposta.Resultados);
        Assert.Equal("criada", item.Situacao);
        Assert.Equal(Cenario.IdA, item.Id);
        Assert.Null(item.Motivo);
        Assert.Equal(1, _repositorio.Adicionadas);

        var gravada = _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA));
        Assert.NotNull(gravada);
        Assert.Equal(1000L, gravada.Valor.Valor);
        Assert.Equal(Cenario.Usuario, gravada.UsuarioId);
    }

    // O id vem de fora: a mesma linha chegando do segundo aparelho e atualizacao,
    // nao violacao de chave.
    [Fact]
    public async Task LinhaJaExistenteComVersaoMaisNovaEhAtualizada()
    {
        _repositorio.Semear(Cenario.Transacao(atualizadoEm: "2026-09-14T12:00:00.000Z"));

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([Cenario.Entrada(valor: 5555, updatedAt: "2026-09-15T12:00:00.000Z")]),
            CancellationToken.None);

        Assert.Equal("atualizada", Assert.Single(resposta.Resultados).Situacao);
        Assert.Equal(5555L, _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA))?.Valor.Valor);
        Assert.Equal(0, _repositorio.Adicionadas);
        Assert.Equal(1, _repositorio.Atualizadas);
    }

    // Versao mais velha e descartada em silencio: resposta 200 com "descartada",
    // nunca erro.
    [Fact]
    public async Task VersaoMaisVelhaVoltaComoDescartadaSemAlterarOBanco()
    {
        _repositorio.Semear(Cenario.Transacao(valor: 1000, atualizadoEm: "2026-09-14T12:00:00.000Z"));

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([Cenario.Entrada(valor: 9999, updatedAt: "2026-09-13T12:00:00.000Z")]),
            CancellationToken.None);

        Assert.Equal("descartada", Assert.Single(resposta.Resultados).Situacao);
        Assert.Equal(1000L, _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA))?.Valor.Valor);
        Assert.Equal(0, _repositorio.Atualizadas);
    }

    [Fact]
    public async Task ExclusaoChegaComoDeletedAtPreenchido()
    {
        _repositorio.Semear(Cenario.Transacao(atualizadoEm: "2026-09-14T12:00:00.000Z"));

        await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([
                Cenario.Entrada(
                    updatedAt: "2026-09-15T12:00:00.000Z",
                    deletedAt: "2026-09-15T12:00:00.000Z")
            ]),
            CancellationToken.None);

        var gravada = _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA));
        Assert.NotNull(gravada);
        Assert.True(gravada.EstaExcluida);
        // Nunca DELETE: a linha continua la para propagar a exclusao.
        Assert.Single(_repositorio.Itens);
    }

    // Linha criada e apagada offline, antes de qualquer sincronizacao: chega ao
    // servidor ja excluida e precisa ser aceita assim.
    [Fact]
    public async Task AceitaLinhaNovaQueJaChegaExcluida()
    {
        await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([Cenario.Entrada(deletedAt: "2026-09-14T12:00:00.000Z")]),
            CancellationToken.None);

        var gravada = _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA));
        Assert.NotNull(gravada);
        Assert.True(gravada.EstaExcluida);
    }

    // A decisao de protocolo mais importante do lote: um item ruim NAO derruba os
    // outros. Derrubar tudo travaria o aparelho para sempre, reenviando o mesmo
    // lote ruim em todo ciclo.
    [Fact]
    public async Task ItemMalformadoNaoDerrubaOLote()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([
                Cenario.Entrada(id: Cenario.IdA),
                Cenario.Entrada(id: Cenario.IdB, data: "2026-02-31"),
                Cenario.Entrada(id: Cenario.IdC, valor: 2500),
            ]),
            CancellationToken.None);

        Assert.Equal(3, resposta.Resultados.Count);
        Assert.Equal("criada", resposta.Resultados[0].Situacao);
        Assert.Equal("rejeitada", resposta.Resultados[1].Situacao);
        Assert.NotNull(resposta.Resultados[1].Motivo);
        Assert.Equal("criada", resposta.Resultados[2].Situacao);
        Assert.Equal(2, _repositorio.Itens.Count);
    }

    [Theory]
    [InlineData("id-invalido", null, null, null, null)]
    [InlineData(Cenario.IdB, "despesa", null, null, null)]
    [InlineData(Cenario.IdB, null, "14/09/2026", null, null)]
    [InlineData(Cenario.IdB, null, null, "nao-e-uuid", null)]
    [InlineData(Cenario.IdB, null, null, null, "2026-09-14 12:00")]
    public async Task RejeitaItemComFormatoDeFioQuebrado(
        string id,
        string? tipo,
        string? data,
        string? categoria,
        string? updatedAt)
    {
        var entrada = Cenario.Entrada(
            id: id,
            tipo: tipo ?? "saida",
            data: data ?? "2026-09-14",
            categoriaId: categoria ?? Cenario.Categoria,
            updatedAt: updatedAt ?? "2026-09-14T12:00:00.000Z");

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([entrada]),
            CancellationToken.None);

        Assert.Equal("rejeitada", Assert.Single(resposta.Resultados).Situacao);
        Assert.Empty(_repositorio.Itens);
    }

    // Invariante de negocio ferida tambem e rejeicao de item, nao erro de lote — e
    // a mensagem vem da agregada, que e onde a regra mora.
    [Fact]
    public async Task RejeitaItemQueFereInvarianteDaAgregada()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([
                Cenario.Entrada(id: Cenario.IdA, valor: 0),
                Cenario.Entrada(id: Cenario.IdB, descricao: new string('x', 201)),
                Cenario.Entrada(id: Cenario.IdC),
            ]),
            CancellationToken.None);

        Assert.Equal("rejeitada", resposta.Resultados[0].Situacao);
        Assert.Contains("positivo", resposta.Resultados[0].Motivo ?? string.Empty, StringComparison.Ordinal);
        Assert.Equal("rejeitada", resposta.Resultados[1].Situacao);
        Assert.Equal("criada", resposta.Resultados[2].Situacao);
        Assert.Single(_repositorio.Itens);
    }

    // Dois deltas da mesma linha no mesmo lote: o segundo disputa contra o
    // resultado do primeiro, nao contra o que estava no banco.
    [Fact]
    public async Task MesmoIdDuasVezesNoLoteResolveEntreSi()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([
                Cenario.Entrada(valor: 1000, updatedAt: "2026-09-14T12:00:00.000Z"),
                Cenario.Entrada(valor: 2000, updatedAt: "2026-09-14T13:00:00.000Z"),
            ]),
            CancellationToken.None);

        Assert.Equal("criada", resposta.Resultados[0].Situacao);
        Assert.Equal("atualizada", resposta.Resultados[1].Situacao);
        Assert.Single(_repositorio.Itens);
        Assert.Equal(2000L, _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA))?.Valor.Valor);
    }

    [Fact]
    public async Task MesmoIdDuasVezesComSegundoMaisVelhoDescartaOSegundo()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([
                Cenario.Entrada(valor: 2000, updatedAt: "2026-09-14T13:00:00.000Z"),
                Cenario.Entrada(valor: 1000, updatedAt: "2026-09-14T12:00:00.000Z"),
            ]),
            CancellationToken.None);

        Assert.Equal("criada", resposta.Resultados[0].Situacao);
        Assert.Equal("descartada", resposta.Resultados[1].Situacao);
        Assert.Equal(2000L, _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA))?.Valor.Valor);
    }

    [Fact]
    public async Task PullDevolveOQueMudouDepoisDoMarco()
    {
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdA, atualizadoEm: "2026-09-10T12:00:00.000Z"),
            Cenario.Transacao(id: Cenario.IdB, atualizadoEm: "2026-09-18T12:00:00.000Z"));

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(desde: "2026-09-15T00:00:00.000Z", ultimoId: Cenario.IdA),
            CancellationToken.None);

        Assert.Equal(Cenario.IdB, Assert.Single(resposta.Transacoes).Id);
        Assert.Equal("2026-09-18T12:00:00.000Z", resposta.ProximoDesde);
        Assert.Equal(Cenario.IdB, resposta.ProximoUltimoId);
        Assert.False(resposta.TemMais);
    }

    // Excluidas PRECISAM vir no pull: e so por elas que o aparelho que estava
    // offline fica sabendo do que foi apagado.
    [Fact]
    public async Task PullIncluiExcluidas()
    {
        _repositorio.Semear(
            Cenario.Transacao(
                id: Cenario.IdA,
                atualizadoEm: "2026-09-18T12:00:00.000Z",
                excluidoEm: "2026-09-18T12:00:00.000Z"));

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(),
            CancellationToken.None);

        var dto = Assert.Single(resposta.Transacoes);
        Assert.Equal("2026-09-18T12:00:00.000Z", dto.DeletedAt);
    }

    [Fact]
    public async Task PaginaEDevolveMarcoParaAProximaChamada()
    {
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdA, atualizadoEm: "2026-09-10T12:00:00.000Z"),
            Cenario.Transacao(id: Cenario.IdB, atualizadoEm: "2026-09-11T12:00:00.000Z"),
            Cenario.Transacao(id: Cenario.IdC, atualizadoEm: "2026-09-12T12:00:00.000Z"));

        var primeira = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(limite: 2),
            CancellationToken.None);

        Assert.Equal(2, primeira.Transacoes.Count);
        Assert.True(primeira.TemMais);
        Assert.Equal(Cenario.IdB, primeira.ProximoUltimoId);

        var segunda = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(desde: primeira.ProximoDesde, ultimoId: primeira.ProximoUltimoId, limite: 2),
            CancellationToken.None);

        Assert.Equal(Cenario.IdC, Assert.Single(segunda.Transacoes).Id);
        Assert.False(segunda.TemMais);
    }

    // Linhas no mesmo milissegundo na fronteira da pagina: e o caso que uma
    // paginacao so por timestamp perderia em silencio.
    [Fact]
    public async Task NaoPerdeLinhasQueCaemNoMesmoMilissegundo()
    {
        const string mesmoInstante = "2026-09-12T12:00:00.000Z";
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdA, atualizadoEm: mesmoInstante),
            Cenario.Transacao(id: Cenario.IdB, atualizadoEm: mesmoInstante),
            Cenario.Transacao(id: Cenario.IdC, atualizadoEm: mesmoInstante));

        var primeira = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(limite: 2),
            CancellationToken.None);

        var segunda = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(desde: primeira.ProximoDesde, ultimoId: primeira.ProximoUltimoId, limite: 2),
            CancellationToken.None);

        var vistos = primeira.Transacoes.Select(t => t.Id).Concat(segunda.Transacoes.Select(t => t.Id)).ToList();

        Assert.Equal(3, vistos.Count);
        Assert.Equal(3, vistos.Distinct(StringComparer.Ordinal).Count());
    }

    // Pagina vazia nao pode zerar o marco: o aparelho recomecaria do zero na
    // proxima chamada e baixaria a base inteira.
    [Fact]
    public async Task PaginaVaziaPreservaOMarcoAnterior()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(desde: "2026-09-15T00:00:00.000Z", ultimoId: Cenario.IdA),
            CancellationToken.None);

        Assert.Empty(resposta.Transacoes);
        Assert.Equal("2026-09-15T00:00:00.000Z", resposta.ProximoDesde);
        Assert.Equal(Cenario.IdA, resposta.ProximoUltimoId);
    }

    [Fact]
    public async Task PrimeiraSincronizacaoTrazTudo()
    {
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdA, atualizadoEm: "2026-09-10T12:00:00.000Z"),
            Cenario.Transacao(id: Cenario.IdB, atualizadoEm: "2026-09-11T12:00:00.000Z"));

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(),
            CancellationToken.None);

        Assert.Equal(2, resposta.Transacoes.Count);
    }

    // Escopo multiusuario: a linha do outro usuario nao aparece nem no pull nem na
    // resolucao do push.
    [Fact]
    public async Task NaoEnxergaLinhaDeOutroUsuario()
    {
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdB, atualizadoEm: "2026-09-18T12:00:00.000Z", usuario: Cenario.OutroUsuario));

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([Cenario.Entrada()]),
            CancellationToken.None);

        Assert.DoesNotContain(resposta.Transacoes, t => string.Equals(t.Id, Cenario.IdB, StringComparison.Ordinal));
        Assert.Equal(Cenario.Usuario, _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA))?.UsuarioId);
    }

    [Fact]
    public async Task ExigeUsuarioAutenticado()
    {
        var casoDeUso = CriarCasoDeUso();

        await Assert.ThrowsAsync<ErroDeDominioException>(() =>
            casoDeUso.ExecutarAsync(default, Cenario.Requisicao(), CancellationToken.None));
    }

    // Marco invalido e erro de protocolo: o valor saiu de uma resposta deste mesmo
    // servidor. Aceitar calado faria o aparelho rebaixar a base inteira sem motivo.
    [Theory]
    [InlineData("ontem", null)]
    [InlineData("2026-09-15", null)]
    [InlineData("2026-09-15T00:00:00.000Z", "nao-e-uuid")]
    public async Task RecusaMarcoInvalido(string? desde, string? ultimoId)
    {
        var casoDeUso = CriarCasoDeUso();

        await Assert.ThrowsAsync<ErroDeDominioException>(() =>
            casoDeUso.ExecutarAsync(
                Cenario.Usuario,
                Cenario.Requisicao(desde: desde, ultimoId: ultimoId),
                CancellationToken.None));
    }

    [Theory]
    [InlineData(null, 3)]
    [InlineData(0, 3)]
    [InlineData(-5, 3)]
    [InlineData(2, 2)]
    [InlineData(99999, 3)]
    public async Task NormalizaOLimitePedidoPeloCliente(int? limite, int esperado)
    {
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdA, atualizadoEm: "2026-09-10T12:00:00.000Z"),
            Cenario.Transacao(id: Cenario.IdB, atualizadoEm: "2026-09-11T12:00:00.000Z"),
            Cenario.Transacao(id: Cenario.IdC, atualizadoEm: "2026-09-12T12:00:00.000Z"));

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(limite: limite),
            CancellationToken.None);

        Assert.Equal(esperado, resposta.Transacoes.Count);
    }

    // Push e pull no mesmo lote: o que acabou de entrar ja sai na resposta, e tudo
    // numa transacao so.
    [Fact]
    public async Task PushEPullAcontecemNaMesmaTransacao()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([Cenario.Entrada()]),
            CancellationToken.None);

        Assert.Equal(1, _unidade.Transacoes);
        Assert.Equal(1, _unidade.Salvamentos);
        Assert.Equal(Cenario.IdA, Assert.Single(resposta.Transacoes).Id);
    }

    [Fact]
    public async Task LoteVazioSoFazPull()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(),
            CancellationToken.None);

        Assert.Empty(resposta.Resultados);
        Assert.Equal(0, _unidade.Salvamentos);
        Assert.Equal("2026-09-20T10:00:00.000Z", resposta.ServidorEm);
    }

    // Contrato de fio: centavos como inteiro, data como 'YYYY-MM-DD', carimbos em
    // ISO-8601 UTC. Este teste e o que trava uma mudanca acidental de serializacao.
    [Fact]
    public async Task RespostaRespeitaOContratoDeFio()
    {
        _repositorio.Semear(
            Cenario.Transacao(
                id: Cenario.IdA,
                valor: 250075,
                data: "2026-09-14",
                descricao: "Mercado",
                atualizadoEm: "2026-09-18T12:00:00.000Z"));

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(),
            CancellationToken.None);

        var dto = Assert.Single(resposta.Transacoes);
        Assert.Equal(Cenario.IdA, dto.Id);
        Assert.Equal("saida", dto.Tipo);
        Assert.Equal(250075L, dto.Valor);
        Assert.Equal("2026-09-14", dto.Data);
        Assert.Equal(Cenario.Categoria, dto.CategoriaId);
        Assert.Equal("Mercado", dto.Descricao);
        Assert.Null(dto.ContaId);
        Assert.Equal("2026-09-18T12:00:00.000Z", dto.UpdatedAt);
        Assert.Null(dto.DeletedAt);
    }

    [Fact]
    public async Task IdaEVoltaPreservaODeltaDoCliente()
    {
        const string conta = "44444444-4444-4444-8444-444444444444";

        await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao([
                Cenario.Entrada(tipo: "entrada", valor: 999999, contaId: conta, descricao: "  Salario  "),
            ]),
            CancellationToken.None);

        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            Cenario.Requisicao(),
            CancellationToken.None);

        var dto = Assert.Single(resposta.Transacoes);
        Assert.Equal("entrada", dto.Tipo);
        Assert.Equal(999999L, dto.Valor);
        Assert.Equal(conta, dto.ContaId);
        Assert.Equal("Salario", dto.Descricao);
    }

    // Cliente que manda { transacoes: null } (ou omite o campo) esta so puxando.
    [Fact]
    public async Task ListaDeTransacoesNulaEhTratadaComoPullPuro()
    {
        var resposta = await CriarCasoDeUso().ExecutarAsync(
            Cenario.Usuario,
            new RequisicaoSincronizacaoDto(null, null, null, null),
            CancellationToken.None);

        Assert.Empty(resposta.Resultados);
        Assert.Empty(resposta.Transacoes);
    }
}
