using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;
using Microsoft.Extensions.DependencyInjection;

namespace Financeiro.Infrastructure.Tests;

internal static class Cenario
{
    public static readonly CategoriaId Categoria =
        CategoriaId.De(new Guid("22222222-2222-4222-8222-222222222222"));

    // Seis UUIDs listados na ordem em que o Postgres os ordena: comparacao byte a
    // byte sobre a forma escrita do uuid.
    //
    // Os quatro primeiros bytes variam de 00 ate ff de proposito, cobrindo a
    // fronteira do bit mais alto (7f -> 80 -> 90 -> ff). E ali que uma comparacao
    // COM SINAL sobre os 4 primeiros bytes divergiria da do Postgres, e e ali que
    // a ordem de bytes crua de Guid.ToByteArray() (little-endian nos tres
    // primeiros campos) diverge de fato. Ver
    // KeysetDoPullTestes.OrdemDeGuidNoDotNetEmRelacaoAoPostgres, que mede as duas
    // coisas em vez de confiar na lembranca.
    //
    // Com UUIDs aleatorios um teste de keyset passa por sorte em boa parte das
    // rodadas; com estes, a fronteira de pagina cai sempre em cima do ponto
    // sensivel.
    public static readonly Guid[] IdsEmOrdemDoPostgres =
    [
        new("00000000-0000-4000-8000-000000000001"),
        new("11111111-1111-4111-8111-111111111111"),
        new("7fffffff-ffff-4fff-8fff-ffffffffffff"),
        new("80000000-0000-4000-8000-000000000000"),
        new("90909090-9090-4090-8090-909090909090"),
        new("ffffffff-ffff-4fff-8fff-ffffffffffff"),
    ];

    public static DateTimeOffset Em(string iso) => Instante.Analisar(iso);

    public static UsuarioId NovoUsuario() => UsuarioId.Novo();

    public static DadosTransacao Dados(
        TipoMovimento tipo = TipoMovimento.Saida,
        long valor = 1000,
        string data = "2026-09-14",
        string descricao = "Mercado",
        ContaId? contaId = null)
        => new(tipo, Centavos.De(valor), DataMovimento.Analisar(data), Categoria, descricao, contaId);

    public static Transacao Transacao(
        UsuarioId usuario,
        Guid id,
        string atualizadoEm = "2026-09-14T12:00:00.000Z",
        string? excluidoEm = null,
        long valor = 1000,
        string data = "2026-09-14",
        string descricao = "Mercado",
        TipoMovimento tipo = TipoMovimento.Saida,
        ContaId? contaId = null)
        => Domain.Transacoes.Transacao.Reconstituir(
            TransacaoId.De(id),
            usuario,
            Dados(tipo, valor, data, descricao, contaId),
            Em(atualizadoEm),
            excluidoEm is null ? null : Em(excluidoEm));

    // Grava pelo caminho real: repositorio + unidade de trabalho, no mesmo escopo
    // de DI que a API usaria.
    public static async Task GravarAsync(BancoDeTestes banco, params Transacao[] transacoes)
    {
        ArgumentNullException.ThrowIfNull(banco);
        ArgumentNullException.ThrowIfNull(transacoes);

        await using var escopo = banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();
        var unidade = escopo.ServiceProvider.GetRequiredService<IUnidadeDeTrabalho>();

        foreach (var transacao in transacoes)
        {
            await repositorio.AdicionarAsync(transacao, CancellationToken.None).ConfigureAwait(false);
        }

        await unidade.SalvarAlteracoesAsync(CancellationToken.None).ConfigureAwait(false);
    }

    // Percorre o pull pagina a pagina, exatamente como o cliente faria: a proxima
    // pagina comeca no (AtualizadoEm, Id) da ultima linha da anterior.
    public static async Task<IReadOnlyList<Transacao>> PaginarTudoAsync(
        IRepositorioTransacoes repositorio,
        UsuarioId usuario,
        int limite,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(repositorio);

        var todas = new List<Transacao>();
        DateTimeOffset? desde = null;
        TransacaoId? ultimoId = null;

        // Teto de seguranca: sem ele, um keyset que nao avanca vira teste que roda
        // para sempre em vez de teste que falha.
        for (var pagina = 0; pagina < 100; pagina++)
        {
            var lote = await repositorio
                .ListarAlteradasDesdeAsync(usuario, desde, ultimoId, limite, cancellationToken)
                .ConfigureAwait(false);

            if (lote.Count == 0)
            {
                return todas;
            }

            todas.AddRange(lote);

            var ultima = lote[^1];
            desde = ultima.AtualizadoEm;
            ultimoId = ultima.Id;

            if (lote.Count < limite)
            {
                return todas;
            }
        }

        throw new InvalidOperationException("O keyset nao avancou: excesso de paginas.");
    }
}
