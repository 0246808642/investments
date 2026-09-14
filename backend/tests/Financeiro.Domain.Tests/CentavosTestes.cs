using Financeiro.Domain.Comum;

namespace Financeiro.Domain.Tests;

public class CentavosTestes
{
    [Theory]
    [InlineData(0L)]
    [InlineData(1L)]
    [InlineData(-1L)]
    [InlineData(123456L)]
    [InlineData(Centavos.LimiteSeguro)]
    [InlineData(-Centavos.LimiteSeguro)]
    public void AceitaInteiroDentroDoIntervaloSeguro(long bruto)
    {
        Assert.Equal(bruto, Centavos.De(bruto).Valor);
    }

    [Theory]
    [InlineData(Centavos.LimiteSeguro + 1)]
    [InlineData(-Centavos.LimiteSeguro - 1)]
    [InlineData(long.MaxValue)]
    [InlineData(long.MinValue)]
    public void RecusaValorAlemDoQueOClienteRepresenta(long bruto)
    {
        Assert.Throws<ErroDeDominioException>(() => { Centavos.De(bruto); });
    }

    [Theory]
    [InlineData("0", 0L)]
    [InlineData("1250", 1250L)]
    [InlineData("-500", -500L)]
    [InlineData("9007199254740991", Centavos.LimiteSeguro)]
    public void AnalisaTokenInteiroDoFio(string texto, long esperado)
    {
        Assert.Equal(esperado, Centavos.Analisar(texto).Valor);
    }

    // O ponto da borda: nada que nao seja inteiro puro entra. "12.5" virando 12 ou
    // 13 e exatamente o centavo que some do extrato.
    [Theory]
    [InlineData("12.5")]
    [InlineData("12,5")]
    [InlineData("12.00")]
    [InlineData("1e3")]
    [InlineData("1_000")]
    [InlineData(" 100")]
    [InlineData("100 ")]
    [InlineData("+100")]
    [InlineData("R$ 10")]
    [InlineData("")]
    [InlineData("-")]
    [InlineData("abc")]
    [InlineData(null)]
    public void RecusaTokenQueNaoEhInteiroPuro(string? texto)
    {
        Assert.False(Centavos.TentarAnalisar(texto, out _));
        Assert.Throws<ErroDeDominioException>(() => { Centavos.Analisar(texto); });
    }

    [Theory]
    [InlineData("9007199254740992")]
    [InlineData("-9007199254740992")]
    [InlineData("99999999999999999999999")]
    public void RecusaTokenForaDoIntervaloSeguro(string texto)
    {
        Assert.False(Centavos.TentarAnalisar(texto, out _));
    }

    [Fact]
    public void SomaSubtraiENega()
    {
        var dez = Centavos.De(1000);
        var tres = Centavos.De(300);

        Assert.Equal(1300L, (dez + tres).Valor);
        Assert.Equal(700L, (dez - tres).Valor);
        Assert.Equal(-1000L, (-dez).Valor);
        Assert.Equal(3000L, (dez * 3).Valor);
        Assert.Equal(700L, Centavos.Subtrair(dez, tres).Valor);
    }

    [Fact]
    public void SomaListaSemPerderCentavo()
    {
        var valores = new[] { Centavos.De(1), Centavos.De(2), Centavos.De(3), Centavos.De(-6) };

        Assert.Equal(0L, Centavos.SomarLista(valores).Valor);
        Assert.True(Centavos.SomarLista([]).EhZero);
    }

    // Estouro tem que virar erro de dominio, nao OverflowException crua nem
    // silencio de aritmetica unchecked.
    [Fact]
    public void EstouroNaSomaViraErroDeDominio()
    {
        var teto = Centavos.De(Centavos.LimiteSeguro);
        var um = Centavos.De(1);

        Assert.Throws<ErroDeDominioException>(() => { Centavos.Somar(teto, um); });
        Assert.Throws<ErroDeDominioException>(() => { Centavos.Subtrair(Centavos.De(-Centavos.LimiteSeguro), um); });
        Assert.Throws<ErroDeDominioException>(() => { Centavos.Multiplicar(teto, 2); });
    }

    [Fact]
    public void EstouroDeLongTambemViraErroDeDominio()
    {
        // Passa longe do limite de negocio e estoura o proprio long: o checked
        // precisa pegar antes de dar a volta para negativo.
        Assert.Throws<ErroDeDominioException>(() => { Centavos.Multiplicar(Centavos.De(Centavos.LimiteSeguro), int.MaxValue); });
    }

    [Fact]
    public void ComparaEOrdena()
    {
        var menor = Centavos.De(-1);
        var maior = Centavos.De(1);

        Assert.True(menor < maior);
        Assert.True(maior > menor);
        Assert.True(menor <= Centavos.De(-1));
        Assert.True(maior >= Centavos.De(1));
        Assert.Equal(-1, menor.CompareTo(maior));
        Assert.Equal(Centavos.De(500), Centavos.De(500));
    }

    [Fact]
    public void ZeroEhODefaultEEhReconhecido()
    {
        Assert.True(Centavos.Zero.EhZero);
        Assert.False(Centavos.Zero.EhPositivo);
        Assert.True(Centavos.De(1).EhPositivo);
        Assert.Equal(Centavos.Zero, default(Centavos));
        Assert.Equal(700L, Centavos.De(-700).Absoluto.Valor);
    }

    // Representacao de fio: inteiro cru, sem simbolo e sem separador, em qualquer
    // cultura do servidor.
    [Fact]
    public void TextoEhOInteiroCru()
    {
        Assert.Equal("123456", Centavos.De(123456).ToString());
        Assert.Equal("-500", Centavos.De(-500).ToString());
    }
}
