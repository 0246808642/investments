using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Microsoft.Extensions.DependencyInjection;

namespace Financeiro.Infrastructure.Tests;

// Um lote de sincronizacao e atomico. Metade de um lote gravada deixaria o cliente
// marcando como sincronizado um estado que o servidor nao tem — e ele nunca mais
// reenviaria a outra metade.
[Collection(ColecaoDeBanco.Nome)]
public sealed class UnidadeDeTrabalhoTestes
{
    private readonly BancoDeTestes _banco;

    public UnidadeDeTrabalhoTestes(BancoDeTestes banco) => _banco = banco;

    [Fact]
    public async Task LoteInteiroEntraDeUmaVez()
    {
        var usuario = Cenario.NovoUsuario();
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };

        await using (var escopo = _banco.CriarEscopo())
        {
            var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();
            var unidade = escopo.ServiceProvider.GetRequiredService<IUnidadeDeTrabalho>();

            await unidade.ExecutarEmTransacaoAsync(
                async cancelamento =>
                {
                    foreach (var id in ids)
                    {
                        await repositorio.AdicionarAsync(Cenario.Transacao(usuario, id), cancelamento);
                    }

                    return true;
                },
                CancellationToken.None);
        }

        await using var leitura = _banco.CriarEscopo();
        var consultado = leitura.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var todas = await consultado.ListarAlteradasDesdeAsync(usuario, null, null, 100, CancellationToken.None);
        Assert.Equal(3, todas.Count);
    }

    // Falha no meio do lote: nada entra. E o ponto inteiro da transacao.
    [Fact]
    public async Task FalhaNoMeioDoLoteNaoDeixaNadaGravado()
    {
        var usuario = Cenario.NovoUsuario();

        await using (var escopo = _banco.CriarEscopo())
        {
            var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();
            var unidade = escopo.ServiceProvider.GetRequiredService<IUnidadeDeTrabalho>();

            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                unidade.ExecutarEmTransacaoAsync<bool>(
                    async cancelamento =>
                    {
                        await repositorio.AdicionarAsync(Cenario.Transacao(usuario, Guid.NewGuid()), cancelamento);
                        await repositorio.AdicionarAsync(Cenario.Transacao(usuario, Guid.NewGuid()), cancelamento);

                        throw new InvalidOperationException("Item rejeitado no meio do lote.");
                    },
                    CancellationToken.None));
        }

        await using var leitura = _banco.CriarEscopo();
        var consultado = leitura.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var todas = await consultado.ListarAlteradasDesdeAsync(usuario, null, null, 100, CancellationToken.None);
        Assert.Empty(todas);
    }

    // A leitura do pull acontece dentro da mesma transacao da escrita do push, para
    // que a resposta reflita exatamente o estado que acabou de ser gravado.
    [Fact]
    public async Task LeituraDentroDaTransacaoEnxergaOQueAcabouDeSerEscrito()
    {
        var usuario = Cenario.NovoUsuario();

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();
        var unidade = escopo.ServiceProvider.GetRequiredService<IUnidadeDeTrabalho>();

        var lidas = await unidade.ExecutarEmTransacaoAsync(
            async cancelamento =>
            {
                await repositorio.AdicionarAsync(Cenario.Transacao(usuario, Guid.NewGuid()), cancelamento);
                await repositorio.AdicionarAsync(Cenario.Transacao(usuario, Guid.NewGuid()), cancelamento);

                // Salva antes de ler: o pull precisa enxergar o push do mesmo lote.
                await unidade.SalvarAlteracoesAsync(cancelamento);

                return await repositorio.ListarAlteradasDesdeAsync(usuario, null, null, 100, cancelamento);
            },
            CancellationToken.None);

        Assert.Equal(2, lidas.Count);
    }

    // Transacao reentrante participa da que ja existe em vez de abrir outra: um
    // commit interno prematuro publicaria metade do lote.
    [Fact]
    public async Task TransacaoAninhadaParticipaDaExterna()
    {
        var usuario = Cenario.NovoUsuario();

        await using (var escopo = _banco.CriarEscopo())
        {
            var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();
            var unidade = escopo.ServiceProvider.GetRequiredService<IUnidadeDeTrabalho>();

            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                unidade.ExecutarEmTransacaoAsync<bool>(
                    async externa =>
                    {
                        await unidade.ExecutarEmTransacaoAsync(
                            async interna =>
                            {
                                await repositorio.AdicionarAsync(
                                    Cenario.Transacao(usuario, Guid.NewGuid()), interna);
                                return true;
                            },
                            externa);

                        throw new InvalidOperationException("A externa falha depois da interna.");
                    },
                    CancellationToken.None));
        }

        // Se a interna tivesse feito commit proprio, esta linha teria sobrevivido.
        await using var leitura = _banco.CriarEscopo();
        var consultado = leitura.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        Assert.Empty(await consultado.ListarAlteradasDesdeAsync(usuario, null, null, 100, CancellationToken.None));
    }

    // Limite invalido e erro de programacao, nao consulta vazia silenciosa.
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task LimiteNaoPositivoNoPullEhRecusado(int limite)
    {
        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            repositorio.ListarAlteradasDesdeAsync(
                Cenario.NovoUsuario(), null, null, limite, CancellationToken.None));
    }

    // Lote vazio nao vai ao banco.
    [Fact]
    public async Task ObterPorIdsComListaVaziaNaoConsultaOBanco()
    {
        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var resultado = await repositorio.ObterPorIdsAsync(
            Cenario.NovoUsuario(),
            [],
            CancellationToken.None);

        Assert.Empty(resultado);
    }

    // Carimbo com precisao maior que a do fio e normalizado antes de virar fronteira
    // do keyset; sem isso, um 'desde' com 7 casas nunca empataria com o carimbo de 3
    // casas gravado e a fronteira inclusiva deixaria de incluir o que deveria.
    [Fact]
    public async Task CarimboComPrecisaoExcessivaEhNormalizadoAntesDeVirarFronteira()
    {
        var usuario = Cenario.NovoUsuario();
        const string carimbo = "2026-09-14T12:00:00.500Z";

        await Cenario.GravarAsync(_banco, Cenario.Transacao(usuario, Guid.NewGuid(), atualizadoEm: carimbo));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        // 500.4 microssegundos depois do carimbo gravado: truncado em milissegundo,
        // e o MESMO instante, e a fronteira inclusiva tem que devolver a linha.
        var comExcessoDePrecisao = Cenario.Em(carimbo).AddTicks(4_000);

        var lote = await repositorio.ListarAlteradasDesdeAsync(
            usuario, comExcessoDePrecisao, null, 10, CancellationToken.None);

        Assert.Single(lote);
    }
}
