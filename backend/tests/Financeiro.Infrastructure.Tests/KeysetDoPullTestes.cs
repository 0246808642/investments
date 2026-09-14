using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Financeiro.Infrastructure.Persistencia;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Financeiro.Infrastructure.Tests;

// O teste mais importante desta fatia.
//
// Linha perdida no pull nao aparece como erro: aparece como um lancamento que
// simplesmente nunca chega no aparelho do usuario, e que ninguem descobre porque
// nao ha nada para descobrir — o registro some sem rastro. Tudo aqui existe para
// que essa classe de defeito falhe no build em vez de falhar em campo.
[Collection(ColecaoDeBanco.Nome)]
public sealed class KeysetDoPullTestes
{
    // Um unico carimbo para TODAS as linhas: e o caso em que paginar por carimbo
    // sozinho colapsa, porque nao ha nada para desempatar alem do id.
    private const string MesmoCarimbo = "2026-09-14T12:00:00.000Z";

    private readonly BancoDeTestes _banco;

    public KeysetDoPullTestes(BancoDeTestes banco) => _banco = banco;

    // -------------------------------------------------------------------------
    // 1. Nenhuma linha se perde quando o empate de carimbo cruza a fronteira.
    // -------------------------------------------------------------------------
    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(5)]
    public async Task SeisLinhasComOMesmoCarimboAtravessamAFronteiraSemPerderNenhuma(int limite)
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var todas = await Cenario.PaginarTudoAsync(repositorio, usuario, limite, CancellationToken.None);
        var ids = todas.Select(transacao => transacao.Id.Valor).ToList();

        // Nada repetido: fronteira mal calculada reenvia a mesma linha para sempre e
        // o pull nunca termina.
        Assert.Equal(ids.Count, ids.Distinct().Count());

        // E, sobretudo, nada perdido.
        Assert.Equal(Cenario.IdsEmOrdemDoPostgres.Length, ids.Count);
        Assert.Equal(Cenario.IdsEmOrdemDoPostgres.Order().ToList(), ids.Order().ToList());
    }

    // -------------------------------------------------------------------------
    // 2. A ordem entregue e a do Postgres.
    // -------------------------------------------------------------------------
    [Fact]
    public async Task OrdemDoPullEhADoPostgres()
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var todas = await Cenario.PaginarTudoAsync(repositorio, usuario, 2, CancellationToken.None);

        Assert.Equal(
            Cenario.IdsEmOrdemDoPostgres.ToList(),
            todas.Select(transacao => transacao.Id.Valor).ToList());
    }

    // A ordem que o cenario chama de "do Postgres" e a que o Postgres realmente
    // produz — conferida contra o proprio banco, nao contra a expectativa de quem
    // escreveu o teste.
    [Fact]
    public async Task OrdemEsperadaEhAQueOPostgresProduz()
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        await using var conexao = new NpgsqlConnection(_banco.Conexao);
        await conexao.OpenAsync(CancellationToken.None);

        await using var comando = new NpgsqlCommand(
            "SELECT id FROM financeiro.transacoes WHERE usuario_id = @usuario ORDER BY id",
            conexao);
        comando.Parameters.AddWithValue("usuario", usuario.Valor);

        var doBanco = new List<Guid>();
        await using var leitor = await comando.ExecuteReaderAsync(CancellationToken.None);
        while (await leitor.ReadAsync(CancellationToken.None))
        {
            doBanco.Add(leitor.GetGuid(0));
        }

        Assert.Equal(Cenario.IdsEmOrdemDoPostgres.ToList(), doBanco);
    }

    // Onde a ordem do .NET concorda com a do Postgres, e onde nao concorda.
    //
    // Este teste existe porque a suposicao corrente — "Guid.CompareTo usa outra
    // ordem de bytes" — nao se sustenta nesta versao do runtime, e um teste apoiado
    // numa premissa falsa vira verde vazio. O que a medicao mostra:
    //
    //   * Guid.CompareTo COINCIDE com a ordem do uuid do Postgres. Ele compara sem
    //     sinal, byte a byte, sobre a forma escrita. Ordenar em memoria com ele
    //     daria, hoje, o mesmo resultado que o banco.
    //   * Guid.ToByteArray() (little-endian nos tres primeiros campos, que e o
    //     PADRAO do metodo) diverge. E essa a forma concreta que a armadilha toma:
    //     id mapeado para bytea, comparador sobre byte[], chave de dicionario
    //     ordenada por bytes, serializador binario.
    //
    // A conclusao nao muda a decisao de projeto — ela a reforca. A comparacao fica
    // no SQL justamente para que a corretude nao dependa de qual comparador do .NET
    // por acaso concorda com o Postgres nesta versao do runtime.
    [Fact]
    public void OrdemDeGuidNoDotNetEmRelacaoAoPostgres()
    {
        var ordemDoPostgres = Cenario.IdsEmOrdemDoPostgres.ToList();

        // Order() usa o comparador padrao, que e Guid.CompareTo.
        Assert.Equal(ordemDoPostgres, Cenario.IdsEmOrdemDoPostgres.Order().ToList());

        // Big-endian: a mesma ordem do uuid do Postgres.
        Assert.Equal(
            ordemDoPostgres,
            Cenario.IdsEmOrdemDoPostgres
                .OrderBy(id => id.ToByteArray(bigEndian: true), ComparadorDeBytes.Instancia)
                .ToList());

        // Little-endian, o padrao de ToByteArray(): ordem DIFERENTE. Se algum dia o
        // id trafegar ou for comparado nessa forma, o keyset perde linha na
        // fronteira — e e por isso que a comparacao nao sai do banco.
        Assert.NotEqual(
            ordemDoPostgres,
            Cenario.IdsEmOrdemDoPostgres
                .OrderBy(id => id.ToByteArray(), ComparadorDeBytes.Instancia)
                .ToList());
    }

    private sealed class ComparadorDeBytes : IComparer<byte[]>
    {
        public static ComparadorDeBytes Instancia { get; } = new();

        public int Compare(byte[]? x, byte[]? y)
        {
            if (x is null || y is null)
            {
                return x is null && y is null ? 0 : x is null ? -1 : 1;
            }

            return x.AsSpan().SequenceCompareTo(y.AsSpan());
        }
    }

    // -------------------------------------------------------------------------
    // 3. A comparacao roda no banco, e nao em memoria.
    // -------------------------------------------------------------------------

    // Prova pelo SQL que foi de fato enviado ao Postgres: a comparacao de TUPLA
    // esta no WHERE, o ORDER BY usa os mesmos dois campos na mesma ordem, e nao ha
    // OFFSET em lugar nenhum.
    [Fact]
    public async Task ComparacaoDeTuplaEOrdenacaoVaoParaOSqlEnviadoAoPostgres()
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        var comandos = new List<string>();
        await using (var contexto = _banco.CriarContextoComCapturaDeSql(comandos))
        {
            var repositorio = new RepositorioTransacoes(contexto);

            await repositorio.ListarAlteradasDesdeAsync(
                usuario,
                Cenario.Em(MesmoCarimbo),
                TransacaoId.De(Cenario.IdsEmOrdemDoPostgres[1]),
                2,
                CancellationToken.None);
        }

        var sql = string.Join('\n', comandos);

        // A tupla (atualizado_em, id) comparada COMO TUPLA, do lado do banco.
        Assert.Contains("(\"atualizado_em\", \"id\") > (", sql, StringComparison.Ordinal);

        // Ordenacao pelos mesmos dois campos: e a coerencia entre comparar e ordenar
        // que garante que a proxima pagina comeca onde a anterior parou.
        Assert.Contains("ORDER BY \"atualizado_em\", \"id\"", sql, StringComparison.Ordinal);

        // LIMIT sobre a chave, nunca OFFSET: OFFSET conta linhas, e a contagem muda
        // quando alguem insere no meio entre duas paginas.
        Assert.DoesNotContain("OFFSET", sql, StringComparison.OrdinalIgnoreCase);
    }

    // O outro lado da prova: a consulta nao tem por onde escapar para a memoria,
    // porque o SQL e constante e nenhum operador LINQ e composto depois dele.
    [Fact]
    public void SqlDoKeysetEhConstanteEComparaTupla()
    {
        Assert.Contains(
            "(\"atualizado_em\", \"id\") > ({1}::timestamptz, {2}::uuid)",
            SqlTransacoes.PullKeyset,
            StringComparison.Ordinal);

        Assert.Contains(
            "ORDER BY \"atualizado_em\", \"id\"",
            SqlTransacoes.PullKeyset,
            StringComparison.Ordinal);

        Assert.DoesNotContain("OFFSET", SqlTransacoes.PullKeyset, StringComparison.OrdinalIgnoreCase);
    }

    // -------------------------------------------------------------------------
    // 4. Por que o keyset existe: paginar so pelo carimbo perde linha de verdade.
    // -------------------------------------------------------------------------

    // Nao testa o repositorio — testa a ARMADILHA, rodando contra os MESMOS dados a
    // consulta ingenua que o repositorio deliberadamente nao usa. Enquanto este
    // teste continuar perdendo linhas, fica documentado no codigo por que a tupla e
    // obrigatoria; se um dia ele parar de perder, a premissa mudou e o keyset
    // merece revisao.
    [Fact]
    public async Task PaginarSoPeloCarimboPerderiaLinhasNaFronteira()
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        await using var conexao = new NpgsqlConnection(_banco.Conexao);
        await conexao.OpenAsync(CancellationToken.None);

        var vistos = new List<Guid>();
        DateTimeOffset? desde = null;

        for (var pagina = 0; pagina < 10; pagina++)
        {
            await using var comando = new NpgsqlCommand(
                """
                SELECT id, atualizado_em FROM financeiro.transacoes
                WHERE usuario_id = @usuario
                  AND (@desde::timestamptz IS NULL OR atualizado_em > @desde::timestamptz)
                ORDER BY atualizado_em, id
                LIMIT 2
                """,
                conexao);

            comando.Parameters.AddWithValue("usuario", usuario.Valor);
            comando.Parameters.AddWithValue("desde", desde is null ? DBNull.Value : desde.Value);

            var lote = new List<(Guid Id, DateTimeOffset Carimbo)>();
            await using (var leitor = await comando.ExecuteReaderAsync(CancellationToken.None))
            {
                while (await leitor.ReadAsync(CancellationToken.None))
                {
                    lote.Add((leitor.GetGuid(0), leitor.GetFieldValue<DateTimeOffset>(1)));
                }
            }

            if (lote.Count == 0)
            {
                break;
            }

            vistos.AddRange(lote.Select(linha => linha.Id));
            desde = lote[^1].Carimbo;
        }

        // Seis linhas gravadas; a paginacao ingenua enxerga so as duas primeiras e
        // depois se convence de que acabou, porque 'atualizado_em > desde' exclui
        // justamente as quatro que empatam no carimbo.
        Assert.Equal(2, vistos.Count);
        Assert.True(vistos.Count < Cenario.IdsEmOrdemDoPostgres.Length);
    }

    // -------------------------------------------------------------------------
    // 5. A fronteira exata que a porta especifica.
    // -------------------------------------------------------------------------

    [Fact]
    public async Task DesdeNuloTrazDoInicioDeTudo()
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var lote = await repositorio.ListarAlteradasDesdeAsync(usuario, null, null, 100, CancellationToken.None);

        Assert.Equal(Cenario.IdsEmOrdemDoPostgres.Length, lote.Count);
    }

    // Sem ultimoId a fronteira e INCLUSIVA: reenviar linha ja conhecida e
    // inofensivo (o cliente descarta pelo mesmo last-write-wins), enquanto excluir
    // seria arriscar perder linha.
    [Fact]
    public async Task DesdeSemUltimoIdIncluiAsLinhasComOCarimboExato()
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var lote = await repositorio.ListarAlteradasDesdeAsync(
            usuario,
            Cenario.Em(MesmoCarimbo),
            null,
            100,
            CancellationToken.None);

        Assert.Equal(Cenario.IdsEmOrdemDoPostgres.Length, lote.Count);
    }

    // Com ultimoId a fronteira e ESTRITA: continua exatamente depois da ultima
    // linha entregue, sem repetir e sem pular.
    [Fact]
    public async Task DesdeComUltimoIdContinuaExatamenteDepoisDaUltimaLinha()
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var restante = await repositorio.ListarAlteradasDesdeAsync(
            usuario,
            Cenario.Em(MesmoCarimbo),
            TransacaoId.De(Cenario.IdsEmOrdemDoPostgres[2]),
            100,
            CancellationToken.None);

        Assert.Equal(
            Cenario.IdsEmOrdemDoPostgres.Skip(3).ToList(),
            restante.Select(transacao => transacao.Id.Valor).ToList());
    }

    // O limite e respeitado: pagina cheia nao vaza para a proxima.
    [Fact]
    public async Task LimiteDaPaginaEhRespeitado()
    {
        var usuario = await SemearIdsDivergentesAsync(MesmoCarimbo);

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var lote = await repositorio.ListarAlteradasDesdeAsync(usuario, null, null, 3, CancellationToken.None);

        Assert.Equal(3, lote.Count);
        Assert.Equal(
            Cenario.IdsEmOrdemDoPostgres.Take(3).ToList(),
            lote.Select(transacao => transacao.Id.Valor).ToList());
    }

    // Carimbos misturados: tres grupos de seis linhas empatadas, com a pagina de 4
    // caindo sempre no meio de um grupo. E o caso real do sync, onde um lote inteiro
    // gravado de uma vez compartilha o carimbo.
    [Fact]
    public async Task GruposDeCarimbosEmpatadosAtravessamVariasFronteirasSemPerda()
    {
        var usuario = Cenario.NovoUsuario();
        var carimbos = new[]
        {
            "2026-09-14T12:00:00.000Z",
            "2026-09-14T12:00:00.001Z",
            "2026-09-14T12:00:00.002Z",
        };

        var esperadas = new List<Guid>();
        foreach (var carimbo in carimbos)
        {
            // Ids novos por grupo (a PK e (usuario, id), entao nao da para reusar),
            // mas mantendo os 4 primeiros bytes — que sao exatamente os que fazem
            // .NET e Postgres discordarem.
            var lote = Cenario.IdsEmOrdemDoPostgres
                .Select(id => Cenario.Transacao(usuario, VariarSufixo(id, carimbo), atualizadoEm: carimbo))
                .ToArray();

            esperadas.AddRange(lote.Select(transacao => transacao.Id.Valor));
            await Cenario.GravarAsync(_banco, lote);
        }

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var todas = await Cenario.PaginarTudoAsync(repositorio, usuario, 4, CancellationToken.None);
        var obtidas = todas.Select(transacao => transacao.Id.Valor).ToList();

        Assert.Equal(18, obtidas.Count);
        Assert.Equal(obtidas.Count, obtidas.Distinct().Count());
        Assert.Equal(esperadas.Order().ToList(), obtidas.Order().ToList());

        // Os carimbos saem em ordem nao decrescente: o pull nunca anda para tras.
        var sequencia = todas.Select(transacao => transacao.AtualizadoEm).ToList();
        Assert.Equal(sequencia.OrderBy(instante => instante).ToList(), sequencia);
    }

    // Mesmos 4 primeiros bytes (a parte que diverge entre .NET e Postgres), ultimo
    // byte variando por grupo.
    private static Guid VariarSufixo(Guid modelo, string discriminador)
    {
        var bytes = modelo.ToByteArray(bigEndian: true);
        bytes[15] = (byte)discriminador[^2];
        return new Guid(bytes, bigEndian: true);
    }

    private async Task<UsuarioId> SemearIdsDivergentesAsync(string carimbo)
    {
        var usuario = Cenario.NovoUsuario();

        var transacoes = Cenario.IdsEmOrdemDoPostgres
            .Select(id => Cenario.Transacao(usuario, id, atualizadoEm: carimbo))
            .ToArray();

        await Cenario.GravarAsync(_banco, transacoes);
        return usuario;
    }
}
