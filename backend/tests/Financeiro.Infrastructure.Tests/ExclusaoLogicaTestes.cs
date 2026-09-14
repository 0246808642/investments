using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Financeiro.Infrastructure.Tests;

// Exclusao e um carimbo, nunca um DELETE.
//
// A linha excluida continua na tabela e continua trafegando no pull porque e so
// por ela que um aparelho que estava offline descobre o que sumiu. Apagar a linha
// apagaria a propria noticia da exclusao, e o lancamento voltaria do morto na
// proxima sincronizacao daquele aparelho.
[Collection(ColecaoDeBanco.Nome)]
public sealed class ExclusaoLogicaTestes
{
    private const string Carimbo = "2026-09-14T12:00:00.000Z";

    private readonly BancoDeTestes _banco;

    public ExclusaoLogicaTestes(BancoDeTestes banco) => _banco = banco;

    // O ponto central: o pull INCLUI as excluidas.
    [Fact]
    public async Task ListarAlteradasDesdeIncluiAsExcluidas()
    {
        var usuario = Cenario.NovoUsuario();
        var ativa = Guid.NewGuid();
        var excluida = Guid.NewGuid();

        await Cenario.GravarAsync(
            _banco,
            Cenario.Transacao(usuario, ativa, atualizadoEm: Carimbo, descricao: "Ainda existe"),
            Cenario.Transacao(usuario, excluida, atualizadoEm: Carimbo, excluidoEm: Carimbo, descricao: "Apagada"));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var lote = await repositorio.ListarAlteradasDesdeAsync(usuario, null, null, 100, CancellationToken.None);

        Assert.Equal(2, lote.Count);

        var tombstone = Assert.Single(lote, transacao => transacao.Id.Valor == excluida);
        Assert.True(tombstone.EstaExcluida);
        Assert.Equal(Carimbo, Instante.ParaTexto(Assert.IsType<DateTimeOffset>(tombstone.ExcluidoEm)));
    }

    // Paginando tambem: nao existe um filtro escondido que so apareça depois da
    // primeira pagina.
    [Fact]
    public async Task ExcluidasAtravessamAPaginacaoComoQualquerOutraLinha()
    {
        var usuario = Cenario.NovoUsuario();

        var transacoes = Cenario.IdsEmOrdemDoPostgres
            .Select((id, posicao) => Cenario.Transacao(
                usuario,
                id,
                atualizadoEm: Carimbo,
                // Metade excluida, alternando, para que toda pagina tenha das duas.
                excluidoEm: posicao % 2 == 0 ? Carimbo : null))
            .ToArray();

        await Cenario.GravarAsync(_banco, transacoes);

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var todas = await Cenario.PaginarTudoAsync(repositorio, usuario, 2, CancellationToken.None);

        Assert.Equal(6, todas.Count);
        Assert.Equal(3, todas.Count(transacao => transacao.EstaExcluida));
    }

    // ObterAsync tambem devolve a excluida: o caso de uso de sync precisa carregar a
    // versao local para decidir o last-write-wins, e uma linha excluida que sumisse
    // daqui faria um delta remoto novo ser tratado como criacao.
    [Fact]
    public async Task ObterAsyncDevolveALinhaExcluida()
    {
        var usuario = Cenario.NovoUsuario();
        var id = Guid.NewGuid();

        await Cenario.GravarAsync(
            _banco,
            Cenario.Transacao(usuario, id, atualizadoEm: Carimbo, excluidoEm: Carimbo));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var lida = await repositorio.ObterAsync(usuario, TransacaoId.De(id), CancellationToken.None);

        Assert.NotNull(lida);
        Assert.True(lida.EstaExcluida);
    }

    // O outro lado: no extrato por periodo, quem pede sem excluidas nao ve
    // excluidas. E o unico caminho onde esconder e o comportamento certo, e por isso
    // ele e explicito (um parametro), e nao um filtro global invisivel.
    [Fact]
    public async Task ListarPorPeriodoEscondeExcluidasSoQuandoPedido()
    {
        var usuario = Cenario.NovoUsuario();
        var ativa = Guid.NewGuid();
        var excluida = Guid.NewGuid();

        await Cenario.GravarAsync(
            _banco,
            Cenario.Transacao(usuario, ativa, data: "2026-09-10"),
            Cenario.Transacao(usuario, excluida, data: "2026-09-11", excluidoEm: Carimbo));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var inicio = DataMovimento.Analisar("2026-09-01");
        var fim = DataMovimento.Analisar("2026-09-30");

        var comExcluidas = await repositorio.ListarPorPeriodoAsync(
            usuario, inicio, fim, incluirExcluidas: true, CancellationToken.None);

        var semExcluidas = await repositorio.ListarPorPeriodoAsync(
            usuario, inicio, fim, incluirExcluidas: false, CancellationToken.None);

        Assert.Equal(2, comExcluidas.Count);
        var unica = Assert.Single(semExcluidas);
        Assert.Equal(ativa, unica.Id.Valor);
    }

    // Intervalo fechado nos dois lados, e ordenado por data.
    [Fact]
    public async Task PeriodoEhFechadoNosDoisLadosEOrdenadoPorData()
    {
        var usuario = Cenario.NovoUsuario();

        await Cenario.GravarAsync(
            _banco,
            Cenario.Transacao(usuario, Guid.NewGuid(), data: "2026-08-31"),
            Cenario.Transacao(usuario, Guid.NewGuid(), data: "2026-09-01"),
            Cenario.Transacao(usuario, Guid.NewGuid(), data: "2026-09-15"),
            Cenario.Transacao(usuario, Guid.NewGuid(), data: "2026-09-30"),
            Cenario.Transacao(usuario, Guid.NewGuid(), data: "2026-10-01"));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var setembro = await repositorio.ListarPorPeriodoAsync(
            usuario,
            DataMovimento.Analisar("2026-09-01"),
            DataMovimento.Analisar("2026-09-30"),
            incluirExcluidas: true,
            CancellationToken.None);

        // Os extremos entram; 31/08 e 01/10 ficam de fora.
        Assert.Equal(
            ["2026-09-01", "2026-09-15", "2026-09-30"],
            setembro.Select(transacao => transacao.Data.ToString()).ToList());
    }

    // A regra tambem existe no banco, e nao so na disciplina de quem escreve
    // repositorio: um DELETE vindo de um script de manutencao ou de um psql aberto
    // e recusado do mesmo jeito.
    [Fact]
    public async Task DeleteFisicoEhRecusadoPeloProprioPostgres()
    {
        var usuario = Cenario.NovoUsuario();
        var id = Guid.NewGuid();

        await Cenario.GravarAsync(_banco, Cenario.Transacao(usuario, id));

        await using var conexao = new NpgsqlConnection(_banco.Conexao);
        await conexao.OpenAsync(CancellationToken.None);

        await using var comando = new NpgsqlCommand(
            "DELETE FROM financeiro.transacoes WHERE usuario_id = @usuario",
            conexao);
        comando.Parameters.AddWithValue("usuario", usuario.Valor);

        var erro = await Assert.ThrowsAsync<PostgresException>(
            () => comando.ExecuteNonQueryAsync(CancellationToken.None));

        Assert.Contains("DELETE fisico proibido", erro.MessageText, StringComparison.Ordinal);

        // E a linha continua la.
        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();
        Assert.NotNull(await repositorio.ObterAsync(usuario, TransacaoId.De(id), CancellationToken.None));
    }

    // O repositorio nao expoe nenhuma forma de remover: a porta nao tem metodo de
    // exclusao, e a unica maneira de excluir e a agregada carimbar ExcluidoEm.
    [Fact]
    public void PortaDoRepositorioNaoTemMetodoDeExclusao()
    {
        var metodos = typeof(IRepositorioTransacoes)
            .GetMethods()
            .Select(metodo => metodo.Name)
            .ToList();

        Assert.DoesNotContain(metodos, nome =>
            nome.Contains("Remover", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("Excluir", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("Delete", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("Apagar", StringComparison.OrdinalIgnoreCase));
    }
}
