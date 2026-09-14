using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Domain.Tests;

public class TipoMovimentoTestes
{
    // Os textos do fio sao os do cliente. Se alguem renomear o enum, este teste cai
    // antes de o PWA parar de sincronizar.
    [Fact]
    public void TextoDoFioEhOMesmoDoCliente()
    {
        Assert.Equal("entrada", TipoMovimento.Entrada.ParaTexto());
        Assert.Equal("saida", TipoMovimento.Saida.ParaTexto());
    }

    [Theory]
    [InlineData("entrada", TipoMovimento.Entrada)]
    [InlineData("saida", TipoMovimento.Saida)]
    public void AnalisaTextoDoFio(string texto, TipoMovimento esperado)
    {
        Assert.Equal(esperado, TipoMovimentoExtensoes.Analisar(texto));
    }

    [Theory]
    [InlineData("Entrada")]
    [InlineData("SAIDA")]
    [InlineData("saída")]
    [InlineData("despesa")]
    [InlineData("")]
    [InlineData(null)]
    public void RecusaTextoForaDoContrato(string? texto)
    {
        Assert.False(TipoMovimentoExtensoes.TentarAnalisar(texto, out _));
        Assert.Throws<ErroDeDominioException>(() => { TipoMovimentoExtensoes.Analisar(texto); });
    }

    [Fact]
    public void AplicaOSinalNoSaldo()
    {
        var valor = Centavos.De(2500);

        Assert.Equal(2500L, TipoMovimento.Entrada.AplicarSinal(valor).Valor);
        Assert.Equal(-2500L, TipoMovimento.Saida.AplicarSinal(valor).Valor);
    }

    [Fact]
    public void ConheceOOposto()
    {
        Assert.Equal(TipoMovimento.Saida, TipoMovimento.Entrada.Oposto());
        Assert.Equal(TipoMovimento.Entrada, TipoMovimento.Saida.Oposto());
        Assert.True(TipoMovimento.Entrada.EhEntrada());
        Assert.False(TipoMovimento.Saida.EhEntrada());
    }
}
