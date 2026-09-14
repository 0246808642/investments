using Financeiro.Domain.Comum;

namespace Financeiro.Domain.Tests;

public class DataMovimentoTestes
{
    [Theory]
    [InlineData("2026-09-14", 2026, 9, 14)]
    [InlineData("2024-02-29", 2024, 2, 29)]
    [InlineData("1000-01-01", 1000, 1, 1)]
    [InlineData("9999-12-31", 9999, 12, 31)]
    public void AnalisaFormatoDoFio(string texto, int ano, int mes, int dia)
    {
        var data = DataMovimento.Analisar(texto);

        Assert.Equal(ano, data.Ano);
        Assert.Equal(mes, data.Mes);
        Assert.Equal(dia, data.Dia);
        Assert.Equal(texto, data.ToString());
    }

    // 2026-02-31 casa com o formato e nao existe no calendario. E o caso que um
    // regex sozinho deixa passar.
    [Theory]
    [InlineData("2026-02-31")]
    [InlineData("2026-02-30")]
    [InlineData("2025-02-29")]
    [InlineData("2026-13-01")]
    [InlineData("2026-00-10")]
    [InlineData("2026-09-00")]
    [InlineData("2026-09-32")]
    public void RecusaDataQueNaoExisteNoCalendario(string texto)
    {
        Assert.False(DataMovimento.TentarAnalisar(texto, out _));
        Assert.Throws<ErroDeDominioException>(() => { DataMovimento.Analisar(texto); });
    }

    // Nada de hora, nada de fuso, nada de outro formato: o contrato e 10 caracteres.
    [Theory]
    [InlineData("2026-9-14")]
    [InlineData("14/09/2026")]
    [InlineData("2026-09-14T00:00:00")]
    [InlineData("2026-09-14Z")]
    [InlineData("2026-09-1")]
    [InlineData("20260914")]
    [InlineData(" 2026-09-14")]
    [InlineData("")]
    [InlineData(null)]
    public void RecusaQualquerCoisaForaDoFormato(string? texto)
    {
        Assert.False(DataMovimento.TentarAnalisar(texto, out _));
    }

    // Ano de menos de 4 digitos nao existe no formato — e o piso tambem barra o
    // default(DataMovimento), que seria 0001-01-01.
    [Fact]
    public void RecusaAnoForaDoIntervaloDoFormato()
    {
        Assert.False(DataMovimento.TentarAnalisar("0999-12-31", out _));
        Assert.Throws<ErroDeDominioException>(() => { DataMovimento.De(999, 12, 31); });
        Assert.False(default(DataMovimento).EhValida);
    }

    [Fact]
    public void ConstroiPorComponentesComOMesmoRigor()
    {
        Assert.Equal("2026-09-14", DataMovimento.De(2026, 9, 14).ToString());
        Assert.Throws<ErroDeDominioException>(() => { DataMovimento.De(2026, 2, 29); });
        Assert.Throws<ErroDeDominioException>(() => { DataMovimento.De(2026, 13, 1); });
        Assert.Throws<ErroDeDominioException>(() => { DataMovimento.De(2026, 4, 31); });
    }

    [Fact]
    public void OrdenaCronologicamente()
    {
        var antes = DataMovimento.Analisar("2026-09-14");
        var depois = DataMovimento.Analisar("2026-10-01");

        Assert.True(antes < depois);
        Assert.True(depois > antes);
        Assert.True(antes <= DataMovimento.Analisar("2026-09-14"));
        Assert.Equal(-1, antes.CompareTo(depois));
        Assert.True(antes.EstaNoIntervalo(DataMovimento.Analisar("2026-09-01"), DataMovimento.Analisar("2026-09-30")));
        Assert.False(depois.EstaNoIntervalo(DataMovimento.Analisar("2026-09-01"), DataMovimento.Analisar("2026-09-30")));
    }

    [Fact]
    public void ExpoeCompetenciaMensal()
    {
        Assert.Equal("2026-09", DataMovimento.Analisar("2026-09-14").Competencia);
    }

    // A ordem lexicografica da string e a ordem cronologica: e por isso que o
    // cliente indexa a data como texto e o servidor pode espelhar isso.
    [Fact]
    public void OrdemDeTextoEhAOrdemDeCalendario()
    {
        var primeira = DataMovimento.Analisar("2026-09-09");
        var segunda = DataMovimento.Analisar("2026-09-10");

        Assert.True(primeira < segunda);
        Assert.True(string.CompareOrdinal(primeira.ToString(), segunda.ToString()) < 0);
    }
}
