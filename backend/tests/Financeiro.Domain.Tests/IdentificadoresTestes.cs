using Financeiro.Domain.Comum;

namespace Financeiro.Domain.Tests;

public class IdentificadoresTestes
{
    [Fact]
    public void AnalisaOUuidQueOClienteGera()
    {
        const string texto = "0f2b7c8a-1d3e-4f5a-9b6c-7d8e9f0a1b2c";

        var id = TransacaoId.Analisar(texto);

        Assert.Equal(texto, id.ToString());
        Assert.False(id.EhVazio);
    }

    // Uma unica representacao no fio e no banco. As formas "N", "B" e "P" do Guid
    // sao o mesmo valor escrito diferente, e aceitar as quatro faria a mesma linha
    // chegar com quatro chaves diferentes.
    [Theory]
    [InlineData("0f2b7c8a1d3e4f5a9b6c7d8e9f0a1b2c")]
    [InlineData("{0f2b7c8a-1d3e-4f5a-9b6c-7d8e9f0a1b2c}")]
    [InlineData("(0f2b7c8a-1d3e-4f5a-9b6c-7d8e9f0a1b2c)")]
    [InlineData("nao-e-uuid")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    [InlineData("")]
    [InlineData(null)]
    public void RecusaFormaNaoCanonicaEIdVazio(string? texto)
    {
        Assert.False(TransacaoId.TentarAnalisar(texto, out _));
        Assert.Throws<ErroDeDominioException>(() => { TransacaoId.Analisar(texto); });
    }

    [Fact]
    public void RecusaGuidVazioNaConstrucao()
    {
        Assert.Throws<ErroDeDominioException>(() => { TransacaoId.De(Guid.Empty); });
        Assert.Throws<ErroDeDominioException>(() => { CategoriaId.De(Guid.Empty); });
        Assert.Throws<ErroDeDominioException>(() => { UsuarioId.De(Guid.Empty); });
        Assert.Throws<ErroDeDominioException>(() => { ContaId.De(Guid.Empty); });
    }

    [Fact]
    public void IdentificaOEstadoVazioSemLancar()
    {
        Assert.True(default(TransacaoId).EhVazio);
        Assert.True(default(CategoriaId).EhVazio);
        Assert.False(TransacaoId.Novo().EhVazio);
    }

    // Mesmo Guid em tipos diferentes sao valores diferentes. A protecao de verdade
    // e de compilacao (nao existe conversao entre eles); aqui fica registrado que
    // nem por igualdade estrutural eles se confundem.
    [Fact]
    public void TiposDiferentesNaoSeMisturam()
    {
        var guid = new Guid("0f2b7c8a-1d3e-4f5a-9b6c-7d8e9f0a1b2c");
        var transacao = TransacaoId.De(guid);
        var categoria = CategoriaId.De(guid);

        Assert.Equal(transacao.Valor, categoria.Valor);
        Assert.NotStrictEqual<object>(transacao, categoria);
    }

    [Fact]
    public void MesmoValorEhIgual()
    {
        var guid = Guid.NewGuid();

        Assert.Equal(TransacaoId.De(guid), TransacaoId.De(guid));
        Assert.NotEqual(TransacaoId.Novo(), TransacaoId.Novo());
    }
}
