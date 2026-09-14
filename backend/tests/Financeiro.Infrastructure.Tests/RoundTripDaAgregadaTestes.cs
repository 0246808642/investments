using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Financeiro.Infrastructure.Tests;

// Grava e le a agregada inteira, e confere tambem como ela ficou FISICAMENTE no
// Postgres. As duas metades importam: um mapeamento pode devolver o valor certo
// em C# e ainda assim ter guardado dinheiro em numeric, e ai o primeiro relatorio
// agregado que alguem escrever em SQL comeca a produzir centavo fracionario.
[Collection(ColecaoDeBanco.Nome)]
public sealed class RoundTripDaAgregadaTestes
{
    private readonly BancoDeTestes _banco;

    public RoundTripDaAgregadaTestes(BancoDeTestes banco) => _banco = banco;

    [Fact]
    public async Task GravaELeComTodosOsValueObjectsIntactos()
    {
        var usuario = Cenario.NovoUsuario();
        var id = Guid.NewGuid();
        var conta = ContaId.Novo();

        await Cenario.GravarAsync(
            _banco,
            Cenario.Transacao(
                usuario,
                id,
                atualizadoEm: "2026-09-14T12:34:56.789Z",
                valor: 123_456_789,
                data: "2028-02-29",
                descricao: "Feira do mes",
                tipo: TipoMovimento.Entrada,
                contaId: conta));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();

        var lida = await repositorio.ObterAsync(usuario, TransacaoId.De(id), CancellationToken.None);

        Assert.NotNull(lida);
        Assert.Equal(usuario, lida.UsuarioId);
        Assert.Equal(id, lida.Id.Valor);
        Assert.Equal(TipoMovimento.Entrada, lida.Tipo);

        // Centavos volta como inteiro, nao como algo reconstruido de decimal.
        Assert.Equal(123_456_789L, lida.Valor.Valor);

        // 29/02 de um ano bissexto sobrevive ao round-trip sem deslocar de dia —
        // que e o bug classico de guardar data de lancamento como timestamp.
        Assert.Equal("2028-02-29", lida.Data.ToString());
        Assert.Equal(Cenario.Categoria, lida.CategoriaId);
        Assert.Equal("Feira do mes", lida.Descricao);
        Assert.Equal(conta, lida.ContaId);

        // Carimbo com os 3 milissegundos preservados e offset zero.
        Assert.Equal("2026-09-14T12:34:56.789Z", Instante.ParaTexto(lida.AtualizadoEm));
        Assert.Null(lida.ExcluidoEm);
        Assert.False(lida.EstaExcluida);
    }

    // Lancamento avulso: ContaId nulo continua nulo, e nao vira Guid vazio.
    [Fact]
    public async Task ContaIdNuloVoltaNuloENaoComoGuidVazio()
    {
        var usuario = Cenario.NovoUsuario();
        var id = Guid.NewGuid();

        await Cenario.GravarAsync(_banco, Cenario.Transacao(usuario, id, contaId: null));

        await using var escopo = _banco.CriarEscopo();
        var repositorio = escopo.ServiceProvider.GetRequiredService<IRepositorioTransacoes>();
        var lida = await repositorio.ObterAsync(usuario, TransacaoId.De(id), CancellationToken.None);

        Assert.NotNull(lida);
        Assert.Null(lida.ContaId);
    }

    // O contrato fisico das colunas. Dinheiro e bigint; data e date guardando
    // exatamente 'YYYY-MM-DD'; carimbos sao timestamptz.
    [Fact]
    public async Task ColunasTemOsTiposDoContratoNoPostgres()
    {
        var usuario = Cenario.NovoUsuario();
        var id = Guid.NewGuid();

        await Cenario.GravarAsync(
            _banco,
            Cenario.Transacao(usuario, id, valor: 9_007_199_254_740_991L, data: "2026-12-31"));

        await using var conexao = new NpgsqlConnection(_banco.Conexao);
        await conexao.OpenAsync(CancellationToken.None);

        await using var comando = new NpgsqlCommand(
            """
            SELECT pg_typeof(valor)::text,
                   pg_typeof(data)::text,
                   pg_typeof(id)::text,
                   pg_typeof(atualizado_em)::text,
                   valor::text,
                   data::text,
                   tipo
            FROM financeiro.transacoes
            WHERE usuario_id = @usuario AND id = @id
            """,
            conexao);

        comando.Parameters.AddWithValue("usuario", usuario.Valor);
        comando.Parameters.AddWithValue("id", id);

        await using var leitor = await comando.ExecuteReaderAsync(CancellationToken.None);
        Assert.True(await leitor.ReadAsync(CancellationToken.None));

        // bigint, NUNCA numeric/decimal/double.
        Assert.Equal("bigint", leitor.GetString(0));
        Assert.Equal("date", leitor.GetString(1));
        Assert.Equal("uuid", leitor.GetString(2));
        Assert.Equal("timestamp with time zone", leitor.GetString(3));

        // O limite seguro do JavaScript vai e volta sem perder o ultimo digito,
        // que e o que aconteceria se a coluna fosse de ponto flutuante.
        Assert.Equal("9007199254740991", leitor.GetString(4));

        // A data e legivel no banco no mesmo formato do fio.
        Assert.Equal("2026-12-31", leitor.GetString(5));

        // O tipo e o texto canonico do cliente.
        Assert.Equal("saida", leitor.GetString(6));
    }
}
