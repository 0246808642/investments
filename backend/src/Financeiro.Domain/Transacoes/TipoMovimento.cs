using Financeiro.Domain.Comum;

namespace Financeiro.Domain.Transacoes;

// O sinal do lancamento mora aqui, nao no numero. Valor e sempre positivo; e o
// tipo que diz se ele soma ou subtrai do saldo.
public enum TipoMovimento
{
    Entrada = 1,
    Saida = 2,
}

public static class TipoMovimentoExtensoes
{
    // Os textos do fio sao os do cliente ('entrada' | 'saida'), minusculos e sem
    // acento. O nome do enum nao e o contrato — este metodo e.
    public const string TextoEntrada = "entrada";

    public const string TextoSaida = "saida";

    public static string ParaTexto(this TipoMovimento tipo) => tipo switch
    {
        TipoMovimento.Entrada => TextoEntrada,
        TipoMovimento.Saida => TextoSaida,
        _ => throw new ErroDeDominioException("TipoMovimento desconhecido: " + tipo.ToString()),
    };

    public static bool TentarAnalisar(string? texto, out TipoMovimento tipo)
    {
        switch (texto)
        {
            case TextoEntrada:
                tipo = TipoMovimento.Entrada;
                return true;
            case TextoSaida:
                tipo = TipoMovimento.Saida;
                return true;
            default:
                tipo = default;
                return false;
        }
    }

    public static TipoMovimento Analisar(string? texto)
        => TentarAnalisar(texto, out var tipo)
            ? tipo
            : throw new ErroDeDominioException(
                "Tipo de movimento invalido, esperado \"" + TextoEntrada + "\" ou \"" + TextoSaida + "\": \"" + texto + "\"");

    public static bool EhEntrada(this TipoMovimento tipo) => tipo == TipoMovimento.Entrada;

    public static TipoMovimento Oposto(this TipoMovimento tipo)
        => tipo == TipoMovimento.Entrada ? TipoMovimento.Saida : TipoMovimento.Entrada;

    // Efeito no saldo: e aqui que o sinal aparece, uma unica vez.
    public static Centavos AplicarSinal(this TipoMovimento tipo, Centavos valor)
        => tipo == TipoMovimento.Entrada ? valor : Centavos.Negar(valor);
}
