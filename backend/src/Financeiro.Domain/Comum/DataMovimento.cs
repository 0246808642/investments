using System.Globalization;

namespace Financeiro.Domain.Comum;

// Data do lancamento: ano-mes-dia, sem hora e sem fuso. Espelha a DataISO do
// cliente. Nao e DateTime de proposito — DateTime carrega hora e fuso e desloca o
// dia quando passa por uma conversao de UTC, que e exatamente o bug que faz um
// gasto do dia 1 aparecer no mes anterior.
public readonly record struct DataMovimento : IComparable<DataMovimento>, IComparable
{
    public const string Formato = "yyyy-MM-dd";

    // O formato de fio tem 10 caracteres e 4 digitos de ano. Ano de 1 a 3 digitos
    // nao existe nesse contrato — e o piso tambem elimina default(DataMovimento),
    // que seria 0001-01-01, como estado alcancavel dentro de uma agregada.
    public const int AnoMinimo = 1000;

    public const int AnoMaximo = 9999;

    private DataMovimento(DateOnly valor) => Valor = valor;

    // DateOnly e so o armazenamento: nao tem hora nem fuso, entao nao reintroduz
    // o problema que a string do cliente resolve.
    public DateOnly Valor { get; }

    public int Ano => Valor.Year;

    public int Mes => Valor.Month;

    public int Dia => Valor.Day;

    // Competencia mensal 'YYYY-MM', espelhando a MesISO do cliente.
    public string Competencia => Valor.ToString("yyyy-MM", CultureInfo.InvariantCulture);

    public bool EhValida => Valor.Year is >= AnoMinimo and <= AnoMaximo;

    public static DataMovimento De(int ano, int mes, int dia)
    {
        if (ano is < AnoMinimo or > AnoMaximo)
        {
            throw new ErroDeDominioException(
                "Ano fora do intervalo "
                + AnoMinimo.ToString(CultureInfo.InvariantCulture)
                + "-"
                + AnoMaximo.ToString(CultureInfo.InvariantCulture)
                + ": "
                + ano.ToString(CultureInfo.InvariantCulture));
        }

        if (mes is < 1 or > 12)
        {
            throw new ErroDeDominioException("Mes invalido: " + mes.ToString(CultureInfo.InvariantCulture));
        }

        if (dia < 1 || dia > DateTime.DaysInMonth(ano, mes))
        {
            throw new ErroDeDominioException(
                "Dia invalido para o mes informado: " + dia.ToString(CultureInfo.InvariantCulture));
        }

        return new DataMovimento(new DateOnly(ano, mes, dia));
    }

    public static DataMovimento De(DateOnly valor) => De(valor.Year, valor.Month, valor.Day);

    // Aceita exatamente 'YYYY-MM-DD'. Recusa '2026-02-31' (casa com o formato mas
    // nao e dia do calendario), '2026-2-3' e qualquer coisa com hora junto.
    public static bool TentarAnalisar(string? texto, out DataMovimento data)
    {
        data = default;
        if (texto is null || texto.Length != Formato.Length)
        {
            return false;
        }

        if (!DateOnly.TryParseExact(texto, Formato, CultureInfo.InvariantCulture, DateTimeStyles.None, out var valor))
        {
            return false;
        }

        if (valor.Year is < AnoMinimo or > AnoMaximo)
        {
            return false;
        }

        data = new DataMovimento(valor);
        return true;
    }

    public static DataMovimento Analisar(string? texto)
        => TentarAnalisar(texto, out var data)
            ? data
            : throw new ErroDeDominioException("Data invalida, esperado " + Formato + ": \"" + texto + "\"");

    public bool EstaNoIntervalo(DataMovimento inicio, DataMovimento fim)
        => Valor >= inicio.Valor && Valor <= fim.Valor;

    public static bool operator <(DataMovimento esquerda, DataMovimento direita) => esquerda.Valor < direita.Valor;

    public static bool operator >(DataMovimento esquerda, DataMovimento direita) => esquerda.Valor > direita.Valor;

    public static bool operator <=(DataMovimento esquerda, DataMovimento direita) => esquerda.Valor <= direita.Valor;

    public static bool operator >=(DataMovimento esquerda, DataMovimento direita) => esquerda.Valor >= direita.Valor;

    public int CompareTo(DataMovimento outra) => Valor.CompareTo(outra.Valor);

    public int CompareTo(object? obj) => obj switch
    {
        null => 1,
        DataMovimento outra => CompareTo(outra),
        _ => throw new ArgumentException("Esperado " + nameof(DataMovimento), nameof(obj)),
    };

    // Representacao de fio, identica a do cliente: 'YYYY-MM-DD'.
    public override string ToString() => Valor.ToString(Formato, CultureInfo.InvariantCulture);
}
