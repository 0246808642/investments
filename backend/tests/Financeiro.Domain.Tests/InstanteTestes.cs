using Financeiro.Domain.Comum;

namespace Financeiro.Domain.Tests;

public class InstanteTestes
{
    [Fact]
    public void ConverteParaUtcAntesDeComparar()
    {
        var comFuso = new DateTimeOffset(2026, 9, 14, 9, 0, 0, TimeSpan.FromHours(-3));

        var normalizado = Instante.Normalizar(comFuso);

        Assert.Equal(TimeSpan.Zero, normalizado.Offset);
        Assert.Equal("2026-09-14T12:00:00.000Z", Instante.ParaTexto(normalizado));
    }

    // Precisao e regra, nao detalhe: o cliente carimba com 3 casas, o .NET tem 7 e
    // o Postgres 6. Sem truncar, o mesmo instante compararia diferente antes e
    // depois de passar pelo banco — justo no empate, que e o caso critico.
    [Fact]
    public void TruncaEmMilissegundosParaQueEmpateSejaEmpateMesmo()
    {
        var comTicksExtras = new DateTimeOffset(2026, 9, 14, 12, 0, 0, TimeSpan.Zero).AddTicks(9_999);
        var redondo = new DateTimeOffset(2026, 9, 14, 12, 0, 0, TimeSpan.Zero);

        Assert.True(comTicksExtras > redondo);
        Assert.Equal(Instante.Normalizar(redondo), Instante.Normalizar(comTicksExtras));
    }

    [Theory]
    [InlineData("2026-09-14T12:00:00.000Z", "2026-09-14T12:00:00.000Z")]
    [InlineData("2026-09-14T12:00:00Z", "2026-09-14T12:00:00.000Z")]
    [InlineData("2026-09-14T12:00:00.123Z", "2026-09-14T12:00:00.123Z")]
    [InlineData("2026-09-14T09:00:00.000-03:00", "2026-09-14T12:00:00.000Z")]
    [InlineData("2026-09-14T12:00:00.1234567Z", "2026-09-14T12:00:00.123Z")]
    public void AnalisaIsoDoClienteSempreEmUtc(string texto, string esperado)
    {
        Assert.Equal(esperado, Instante.ParaTexto(Instante.Analisar(texto)));
    }

    // Timestamp sem fuso seria lido com o fuso do servidor, e o servidor nao sabe
    // onde o aparelho estava. Recusar e melhor do que chutar.
    [Theory]
    [InlineData("2026-09-14T12:00:00")]
    [InlineData("2026-09-14 12:00:00Z")]
    [InlineData("2026-09-14")]
    [InlineData("14/09/2026 12:00")]
    [InlineData("")]
    [InlineData(null)]
    public void RecusaTimestampSemFusoOuForaDoIso(string? texto)
    {
        Assert.False(Instante.TentarAnalisar(texto, out _));
        Assert.Throws<ErroDeDominioException>(() => { Instante.Analisar(texto); });
    }

    [Fact]
    public void FormataSempreComTresCasasEZFinal()
    {
        var instante = new DateTimeOffset(2026, 1, 2, 3, 4, 5, 60, TimeSpan.Zero);

        Assert.Equal("2026-01-02T03:04:05.060Z", Instante.ParaTexto(instante));
    }

    [Fact]
    public void IdaEVoltaPreservaOValor()
    {
        var original = Instante.Normalizar(new DateTimeOffset(2026, 9, 14, 12, 34, 56, 789, TimeSpan.Zero));

        Assert.Equal(original, Instante.Analisar(Instante.ParaTexto(original)));
    }

    [Fact]
    public void NormalizaNuloComoNulo()
    {
        Assert.Null(Instante.Normalizar((DateTimeOffset?)null));
        Assert.NotNull(Instante.Normalizar((DateTimeOffset?)DateTimeOffset.UnixEpoch));
    }
}
