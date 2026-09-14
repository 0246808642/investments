using Financeiro.Application.Transacoes.CasosDeUso;
using Financeiro.Domain.Comum;

namespace Financeiro.Application.Tests;

public class CasosDeUsoDeTransacaoTestes
{
    private readonly RepositorioEmMemoria _repositorio = new();
    private readonly UnidadeDeTrabalhoFake _unidade = new();
    private readonly RelogioFixo _relogio = new("2026-09-20T10:00:00.000Z");

    [Fact]
    public async Task RegistrarCriaLinhaNova()
    {
        var caso = new RegistrarTransacao(_repositorio, _unidade);

        var resultado = await caso.ExecutarAsync(Cenario.Usuario, Cenario.Entrada(), CancellationToken.None);

        Assert.Equal("criada", resultado.Situacao);
        Assert.Single(_repositorio.Itens);
        Assert.Equal(1, _unidade.Salvamentos);
    }

    // Mesma semantica do lote, porque e o mesmo aplicador: reenviar e caso normal.
    [Fact]
    public async Task RegistrarComVersaoMaisNovaAtualiza()
    {
        _repositorio.Semear(Cenario.Transacao(atualizadoEm: "2026-09-14T12:00:00.000Z"));
        var caso = new RegistrarTransacao(_repositorio, _unidade);

        var resultado = await caso.ExecutarAsync(
            Cenario.Usuario,
            Cenario.Entrada(valor: 4321, updatedAt: "2026-09-16T12:00:00.000Z"),
            CancellationToken.None);

        Assert.Equal("atualizada", resultado.Situacao);
        Assert.Equal(4321L, _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA))?.Valor.Valor);
    }

    [Fact]
    public async Task RegistrarComVersaoMaisVelhaDescartaSemGravar()
    {
        _repositorio.Semear(Cenario.Transacao(valor: 1000, atualizadoEm: "2026-09-14T12:00:00.000Z"));
        var caso = new RegistrarTransacao(_repositorio, _unidade);

        var resultado = await caso.ExecutarAsync(
            Cenario.Usuario,
            Cenario.Entrada(valor: 4321, updatedAt: "2026-09-13T12:00:00.000Z"),
            CancellationToken.None);

        Assert.Equal("descartada", resultado.Situacao);
        Assert.Equal(1000L, _repositorio.Buscar(TransacaoId.Analisar(Cenario.IdA))?.Valor.Valor);
        Assert.Equal(0, _repositorio.Atualizadas);
    }

    [Fact]
    public async Task RegistrarRejeitaDeltaInvalidoSemGravar()
    {
        var caso = new RegistrarTransacao(_repositorio, _unidade);

        var resultado = await caso.ExecutarAsync(
            Cenario.Usuario,
            Cenario.Entrada(valor: -100),
            CancellationToken.None);

        Assert.Equal("rejeitada", resultado.Situacao);
        Assert.NotNull(resultado.Motivo);
        Assert.Empty(_repositorio.Itens);
        Assert.Equal(0, _unidade.Salvamentos);
    }

    [Fact]
    public async Task RegistrarExigeUsuarioAutenticado()
    {
        var caso = new RegistrarTransacao(_repositorio, _unidade);

        await Assert.ThrowsAsync<ErroDeDominioException>(() =>
            caso.ExecutarAsync(default, Cenario.Entrada(), CancellationToken.None));
    }

    [Fact]
    public async Task ListaPorPeriodoDeCompetencia()
    {
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdA, data: "2026-08-31"),
            Cenario.Transacao(id: Cenario.IdB, data: "2026-09-01"),
            Cenario.Transacao(id: Cenario.IdC, data: "2026-09-30"));
        var caso = new ListarTransacoesPorPeriodo(_repositorio);

        var lista = await caso.ExecutarAsync(
            Cenario.Usuario,
            "2026-09-01",
            "2026-09-30",
            incluirExcluidas: false,
            CancellationToken.None);

        Assert.Equal(2, lista.Count);
        Assert.Equal("2026-09-01", lista[0].Data);
        Assert.Equal("2026-09-30", lista[1].Data);
    }

    // Excluida nao aparece na tela do mes; so no pull do sync.
    [Fact]
    public async Task ListaPorPeriodoEscondeExcluidasPorPadrao()
    {
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdA, data: "2026-09-10"),
            Cenario.Transacao(
                id: Cenario.IdB,
                data: "2026-09-11",
                atualizadoEm: "2026-09-12T12:00:00.000Z",
                excluidoEm: "2026-09-12T12:00:00.000Z"));
        var caso = new ListarTransacoesPorPeriodo(_repositorio);

        var visiveis = await caso.ExecutarAsync(
            Cenario.Usuario, "2026-09-01", "2026-09-30", false, CancellationToken.None);
        var todas = await caso.ExecutarAsync(
            Cenario.Usuario, "2026-09-01", "2026-09-30", true, CancellationToken.None);

        Assert.Single(visiveis);
        Assert.Equal(2, todas.Count);
    }

    [Fact]
    public async Task ListaPorPeriodoNaoVazaEntreUsuarios()
    {
        _repositorio.Semear(
            Cenario.Transacao(id: Cenario.IdA, data: "2026-09-10"),
            Cenario.Transacao(id: Cenario.IdB, data: "2026-09-11", usuario: Cenario.OutroUsuario));
        var caso = new ListarTransacoesPorPeriodo(_repositorio);

        var lista = await caso.ExecutarAsync(
            Cenario.Usuario, "2026-09-01", "2026-09-30", false, CancellationToken.None);

        Assert.Equal(Cenario.IdA, Assert.Single(lista).Id);
    }

    [Theory]
    [InlineData("2026-02-31", "2026-09-30")]
    [InlineData("2026-09-01", "14/09/2026")]
    [InlineData("2026-09-30", "2026-09-01")]
    public async Task ListaPorPeriodoRecusaParametroInvalido(string inicio, string fim)
    {
        var caso = new ListarTransacoesPorPeriodo(_repositorio);

        await Assert.ThrowsAsync<ErroDeDominioException>(() =>
            caso.ExecutarAsync(Cenario.Usuario, inicio, fim, false, CancellationToken.None));
    }

    [Fact]
    public async Task ExcluirMarcaComCarimboDoServidor()
    {
        _repositorio.Semear(Cenario.Transacao(atualizadoEm: "2026-09-14T12:00:00.000Z"));
        var caso = new ExcluirTransacao(_repositorio, _unidade, _relogio);

        var dto = await caso.ExecutarAsync(Cenario.Usuario, Cenario.IdA, CancellationToken.None);

        Assert.NotNull(dto);
        Assert.Equal("2026-09-20T10:00:00.000Z", dto.DeletedAt);
        Assert.Equal("2026-09-20T10:00:00.000Z", dto.UpdatedAt);
        // Nunca DELETE.
        Assert.Single(_repositorio.Itens);
    }

    [Fact]
    public async Task ExcluirEhIdempotente()
    {
        _repositorio.Semear(Cenario.Transacao(atualizadoEm: "2026-09-14T12:00:00.000Z"));
        var caso = new ExcluirTransacao(_repositorio, _unidade, _relogio);

        await caso.ExecutarAsync(Cenario.Usuario, Cenario.IdA, CancellationToken.None);
        _relogio.Agora = Cenario.Em("2026-09-21T10:00:00.000Z");
        var segunda = await caso.ExecutarAsync(Cenario.Usuario, Cenario.IdA, CancellationToken.None);

        Assert.NotNull(segunda);
        Assert.Equal("2026-09-20T10:00:00.000Z", segunda.DeletedAt);
        Assert.Equal(1, _unidade.Salvamentos);
    }

    [Fact]
    public async Task ExcluirDevolveNuloQuandoNaoEhDoUsuario()
    {
        _repositorio.Semear(Cenario.Transacao(usuario: Cenario.OutroUsuario));
        var caso = new ExcluirTransacao(_repositorio, _unidade, _relogio);

        Assert.Null(await caso.ExecutarAsync(Cenario.Usuario, Cenario.IdA, CancellationToken.None));
    }

    [Fact]
    public async Task ExcluirRecusaIdMalformado()
    {
        var caso = new ExcluirTransacao(_repositorio, _unidade, _relogio);

        await Assert.ThrowsAsync<ErroDeDominioException>(() =>
            caso.ExecutarAsync(Cenario.Usuario, "nao-e-uuid", CancellationToken.None));
    }
}
