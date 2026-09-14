using System.Globalization;

namespace Financeiro.Domain.Comum;

/// Carimbos de tempo da sincronizacao (updatedAt / deletedAt).
///
/// Tudo e normalizado para UTC com precisao de milissegundo. A precisao importa:
/// o cliente produz o carimbo com new Date().toISOString(), que tem 3 casas; o
/// DateTimeOffset do .NET tem 7 e o timestamptz do Postgres tem 6. Se guardassemos
/// a precisao crua, o mesmo instante poderia comparar diferente antes e depois de
/// uma ida ao banco — e a regra de last-write-wins deixaria de ser estavel
/// exatamente no caso de empate, que e o mais delicado.
public static class Instante
{
    /// Formato que o cliente emite e espera: ISO-8601 UTC com milissegundos.
    public const string FormatoIso = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";

    private static readonly string[] FormatosAceitos =
    [
        "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
        "yyyy-MM-dd'T'HH:mm:ss.FFFFFFFzzz",
        "yyyy-MM-dd'T'HH:mm:sszzz",
    ];

    public static DateTimeOffset Normalizar(DateTimeOffset instante)
    {
        var utc = instante.ToUniversalTime();
        var ticks = utc.Ticks - (utc.Ticks % TimeSpan.TicksPerMillisecond);
        return new DateTimeOffset(ticks, TimeSpan.Zero);
    }

    public static DateTimeOffset? Normalizar(DateTimeOffset? instante)
        => instante is null ? null : Normalizar(instante.Value);

    public static string ParaTexto(DateTimeOffset instante)
        => Normalizar(instante).ToString(FormatoIso, CultureInfo.InvariantCulture);

    /// Exige fuso explicito ('Z' ou +hh:mm). Timestamp sem fuso seria interpretado
    /// com o fuso do servidor, e o servidor nao sabe onde o aparelho estava.
    public static bool TentarAnalisar(string? texto, out DateTimeOffset instante)
    {
        if (string.IsNullOrWhiteSpace(texto))
        {
            instante = default;
            return false;
        }

        if (!DateTimeOffset.TryParseExact(
                texto,
                FormatosAceitos,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var analisado))
        {
            instante = default;
            return false;
        }

        instante = Normalizar(analisado);
        return true;
    }

    public static DateTimeOffset Analisar(string? texto)
        => TentarAnalisar(texto, out var instante)
            ? instante
            : throw new ErroDeDominioException($"Timestamp invalido, esperado ISO-8601 com fuso: \"{texto}\"");
}
