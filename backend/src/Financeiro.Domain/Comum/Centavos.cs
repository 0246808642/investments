using System.Globalization;

namespace Financeiro.Domain.Comum;

// Dinheiro e SEMPRE inteiro em centavos — espelha o branded type Centavos do
// cliente. Nao existe construtor a partir de decimal/double/float de proposito:
// o contrato de fio ja e inteiro, e o unico lugar onde um float poderia entrar e
// a conversao de borda, que e justamente onde o centavo se perde.
public readonly record struct Centavos : IComparable<Centavos>, IComparable
{
    // Number.MAX_SAFE_INTEGER. O cliente e JavaScript: acima disso ele nao
    // consegue representar o valor de volta sem arredondar, entao um valor que o
    // servidor aceitasse aqui voltaria corrompido na proxima sincronizacao.
    public const long LimiteSeguro = 9_007_199_254_740_991L;

    private Centavos(long valor) => Valor = valor;

    public long Valor { get; }

    public static Centavos Zero => default;

    public bool EhPositivo => Valor > 0;

    public bool EhZero => Valor == 0;

    public Centavos Absoluto => De(Math.Abs(Valor));

    public static Centavos De(long valor)
    {
        if (valor is > LimiteSeguro or < -LimiteSeguro)
        {
            throw new ErroDeDominioException(
                "Valor monetario fora do intervalo seguro de +/-"
                + LimiteSeguro.ToString(CultureInfo.InvariantCulture)
                + " centavos; recebido "
                + valor.ToString(CultureInfo.InvariantCulture));
        }

        return new Centavos(valor);
    }

    // Ponto de entrada de borda: le o token numerico cru vindo do fio. Aceita so
    // digitos com sinal opcional. "12.5", "12,5" e "1e3" sao recusados aqui em vez
    // de virarem 12 centavos calados por um Convert.ToInt64.
    public static bool TentarAnalisar(string? texto, out Centavos valor)
    {
        valor = Zero;
        if (string.IsNullOrEmpty(texto))
        {
            return false;
        }

        var corpo = texto[0] == '-' ? texto[1..] : texto;
        if (corpo.Length == 0)
        {
            return false;
        }

        foreach (var caractere in corpo)
        {
            if (caractere is < '0' or > '9')
            {
                return false;
            }
        }

        if (!long.TryParse(texto, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var inteiro)
            || inteiro is > LimiteSeguro or < -LimiteSeguro)
        {
            return false;
        }

        valor = new Centavos(inteiro);
        return true;
    }

    public static Centavos Analisar(string? texto)
        => TentarAnalisar(texto, out var valor)
            ? valor
            : throw new ErroDeDominioException(
                "Valor monetario invalido, esperado inteiro em centavos: \"" + texto + "\"");

    public static Centavos Somar(Centavos esquerda, Centavos direita)
    {
        try
        {
            return De(checked(esquerda.Valor + direita.Valor));
        }
        catch (OverflowException erro)
        {
            throw new ErroDeDominioException("Estouro ao somar valores monetarios", erro);
        }
    }

    public static Centavos Subtrair(Centavos esquerda, Centavos direita)
    {
        try
        {
            return De(checked(esquerda.Valor - direita.Valor));
        }
        catch (OverflowException erro)
        {
            throw new ErroDeDominioException("Estouro ao subtrair valores monetarios", erro);
        }
    }

    public static Centavos Negar(Centavos valor) => De(-valor.Valor);

    public static Centavos Multiplicar(Centavos valor, int fator)
    {
        try
        {
            return De(checked(valor.Valor * fator));
        }
        catch (OverflowException erro)
        {
            throw new ErroDeDominioException("Estouro ao multiplicar valor monetario", erro);
        }
    }

    public static Centavos SomarLista(IEnumerable<Centavos> valores)
    {
        ArgumentNullException.ThrowIfNull(valores);

        var total = Zero;
        foreach (var valor in valores)
        {
            total = Somar(total, valor);
        }

        return total;
    }

    public static Centavos operator +(Centavos esquerda, Centavos direita) => Somar(esquerda, direita);

    public static Centavos operator -(Centavos esquerda, Centavos direita) => Subtrair(esquerda, direita);

    public static Centavos operator -(Centavos valor) => Negar(valor);

    public static Centavos operator *(Centavos valor, int fator) => Multiplicar(valor, fator);

    public static bool operator <(Centavos esquerda, Centavos direita) => esquerda.Valor < direita.Valor;

    public static bool operator >(Centavos esquerda, Centavos direita) => esquerda.Valor > direita.Valor;

    public static bool operator <=(Centavos esquerda, Centavos direita) => esquerda.Valor <= direita.Valor;

    public static bool operator >=(Centavos esquerda, Centavos direita) => esquerda.Valor >= direita.Valor;

    public int CompareTo(Centavos outro) => Valor.CompareTo(outro.Valor);

    public int CompareTo(object? obj) => obj switch
    {
        null => 1,
        Centavos outro => CompareTo(outro),
        _ => throw new ArgumentException("Esperado " + nameof(Centavos), nameof(obj)),
    };

    // Representacao de fio: o inteiro cru, sem separador e sem simbolo.
    // Formatacao para humano e responsabilidade do cliente.
    public override string ToString() => Valor.ToString(CultureInfo.InvariantCulture);
}
