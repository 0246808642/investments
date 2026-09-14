using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Financeiro.Infrastructure.Tests;

// O id da transacao nasce no cliente offline. Dois aparelhos de contas diferentes
// podem emitir o mesmo UUID — improvavel, mas nao impossivel, e "improvavel" nao e
// uma politica de isolamento entre contas. A PK composta (UsuarioId, Id) torna o
// caso estruturalmente inofensivo.
[Collection(ColecaoDeBanco.Nome)]
public sealed class ChavePrimariaCompostaTestes
{
    private readonly BancoDeTestes _banco;

    public ChavePrimariaCompostaTestes(BancoDeTestes banco) => _banco = banco;

    [Fact]
    public async Task MesmoIdDeTransacaoCoexisteEmDoisUsuarios()
    {
        var ana = Cenario.NovoUsuario();
        var bruno = Cenario.NovoUsuario();

        // O MESMO id, para os dois. Com PK simples isto seria violacao de chave
        // unica e o segundo usuario perderia o lancamento dele.
        var idCompartilhado = Guid.NewGuid();

        await Cenario.GravarAsync(_banco, Cenario.Transacao(ana, idCompartilhado, valor: 111, descricao: "Da Ana"));
        await Cenario.GravarAsync(_banco, Cenario.Transacao(bruno, idCompartilhado, valor: 222, descricao: "Do Bruno"));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var daAna = await repositorio.ObterAsync(ana, TransacaoId.De(idCompartilhado), CancellationToken.None);
        var doBruno = await repositorio.ObterAsync(bruno, TransacaoId.De(idCompartilhado), CancellationToken.None);

        Assert.NotNull(daAna);
        Assert.NotNull(doBruno);

        // Mesma chave logica, conteudos independentes: nenhuma linha sobrescreveu a
        // outra.
        Assert.Equal(111L, daAna.Valor.Valor);
        Assert.Equal("Da Ana", daAna.Descricao);
        Assert.Equal(222L, doBruno.Valor.Valor);
        Assert.Equal("Do Bruno", doBruno.Descricao);
    }

    // A PK e (usuario_id, id) na ordem certa, e nao (id, usuario_id): usuario_id
    // primeiro porque toda consulta filtra por ele, entao ele e o prefixo util do
    // indice.
    [Fact]
    public async Task ChavePrimariaNoBancoEhUsuarioIdSeguidoDeId()
    {
        await using var conexao = new NpgsqlConnection(_banco.Conexao);
        await conexao.OpenAsync(CancellationToken.None);

        await using var comando = new NpgsqlCommand(
            """
            SELECT string_agg(a.attname, ',' ORDER BY k.ordinalidade)
            FROM pg_index i
            JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(atributo, ordinalidade) ON TRUE
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.atributo
            WHERE i.indrelid = 'financeiro.transacoes'::regclass AND i.indisprimary
            """,
            conexao);

        var colunas = await comando.ExecuteScalarAsync(CancellationToken.None) as string;

        Assert.Equal("usuario_id,id", colunas);
    }

    [Fact]
    public async Task RepositorioDeUmUsuarioNuncaEnxergaLinhaDoOutro()
    {
        var ana = Cenario.NovoUsuario();
        var bruno = Cenario.NovoUsuario();
        var idDaAna = Guid.NewGuid();

        await Cenario.GravarAsync(_banco, Cenario.Transacao(ana, idDaAna, descricao: "Segredo da Ana"));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        // Bruno tem o id em maos e mesmo assim nao alcanca a linha: nao existe
        // caminho no repositorio que enderece uma transacao sem o dono.
        Assert.Null(await repositorio.ObterAsync(bruno, TransacaoId.De(idDaAna), CancellationToken.None));

        Assert.Empty(await repositorio.ObterPorIdsAsync(
            bruno,
            [TransacaoId.De(idDaAna)],
            CancellationToken.None));

        Assert.Empty(await repositorio.ListarAlteradasDesdeAsync(
            bruno,
            null,
            null,
            100,
            CancellationToken.None));

        Assert.Empty(await repositorio.ListarPorPeriodoAsync(
            bruno,
            DataMovimento.Analisar("1000-01-01"),
            DataMovimento.Analisar("9999-12-31"),
            true,
            CancellationToken.None));

        // E a linha da Ana continua la, intacta.
        Assert.NotNull(await repositorio.ObterAsync(ana, TransacaoId.De(idDaAna), CancellationToken.None));
    }

    // Lote inteiro numa ida so, e ainda assim escopado.
    [Fact]
    public async Task ObterPorIdsTrazSoOsDoUsuarioPedido()
    {
        var ana = Cenario.NovoUsuario();
        var bruno = Cenario.NovoUsuario();
        var compartilhado = Guid.NewGuid();
        var soDaAna = Guid.NewGuid();

        await Cenario.GravarAsync(
            _banco,
            Cenario.Transacao(ana, compartilhado, descricao: "Ana compartilhado"),
            Cenario.Transacao(ana, soDaAna, descricao: "Ana exclusivo"));

        await Cenario.GravarAsync(_banco, Cenario.Transacao(bruno, compartilhado, descricao: "Bruno compartilhado"));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var doBruno = await repositorio.ObterPorIdsAsync(
            bruno,
            [TransacaoId.De(compartilhado), TransacaoId.De(soDaAna)],
            CancellationToken.None);

        var unica = Assert.Single(doBruno);
        Assert.Equal("Bruno compartilhado", unica.Descricao);
    }
}
