namespace Financeiro.Domain.Comum;

// Identificadores tipados. O id nasce no cliente (UUID v4 gerado offline), entao
// o servidor nunca gera identidade — ele so valida o formato. Sao quatro structs
// distintas em vez de Guid solto para que trocar TransacaoId por CategoriaId numa
// chamada seja erro de compilacao, e nao uma consulta que volta vazia em producao.
internal static class Identificador
{
    // Formato "D": 36 caracteres com hifen, que e exatamente o que o novoId() do
    // cliente produz. Recusa as formas "N", "B" e "P" do Guid para que o mesmo id
    // tenha uma unica representacao no fio e no banco.
    public const string FormatoCanonico = "D";

    public static Guid Validar(Guid valor, string nome)
        => valor == Guid.Empty
            ? throw new ErroDeDominioException(nome + " nao pode ser vazio")
            : valor;

    public static bool TentarAnalisar(string? texto, out Guid valor)
    {
        if (texto is null || !Guid.TryParseExact(texto, FormatoCanonico, out valor) || valor == Guid.Empty)
        {
            valor = Guid.Empty;
            return false;
        }

        return true;
    }

    public static Guid Analisar(string? texto, string nome)
        => TentarAnalisar(texto, out var valor)
            ? valor
            : throw new ErroDeDominioException(nome + " invalido, esperado UUID no formato 8-4-4-4-12: \"" + texto + "\"");

    public static string ParaTexto(Guid valor) => valor.ToString(FormatoCanonico);
}

public readonly record struct UsuarioId(Guid Valor)
{
    public bool EhVazio => Valor == Guid.Empty;

    public static UsuarioId Novo() => new(Guid.NewGuid());

    public static UsuarioId De(Guid valor) => new(Identificador.Validar(valor, nameof(UsuarioId)));

    public static bool TentarAnalisar(string? texto, out UsuarioId id)
    {
        var sucesso = Identificador.TentarAnalisar(texto, out var valor);
        id = new UsuarioId(valor);
        return sucesso;
    }

    public static UsuarioId Analisar(string? texto) => new(Identificador.Analisar(texto, nameof(UsuarioId)));

    public override string ToString() => Identificador.ParaTexto(Valor);
}

public readonly record struct TransacaoId(Guid Valor)
{
    public bool EhVazio => Valor == Guid.Empty;

    public static TransacaoId Novo() => new(Guid.NewGuid());

    public static TransacaoId De(Guid valor) => new(Identificador.Validar(valor, nameof(TransacaoId)));

    public static bool TentarAnalisar(string? texto, out TransacaoId id)
    {
        var sucesso = Identificador.TentarAnalisar(texto, out var valor);
        id = new TransacaoId(valor);
        return sucesso;
    }

    public static TransacaoId Analisar(string? texto) => new(Identificador.Analisar(texto, nameof(TransacaoId)));

    public override string ToString() => Identificador.ParaTexto(Valor);
}

public readonly record struct CategoriaId(Guid Valor)
{
    public bool EhVazio => Valor == Guid.Empty;

    public static CategoriaId Novo() => new(Guid.NewGuid());

    public static CategoriaId De(Guid valor) => new(Identificador.Validar(valor, nameof(CategoriaId)));

    public static bool TentarAnalisar(string? texto, out CategoriaId id)
    {
        var sucesso = Identificador.TentarAnalisar(texto, out var valor);
        id = new CategoriaId(valor);
        return sucesso;
    }

    public static CategoriaId Analisar(string? texto) => new(Identificador.Analisar(texto, nameof(CategoriaId)));

    public override string ToString() => Identificador.ParaTexto(Valor);
}

// Existe porque Transacao referencia contaId (conta recorrente que gerou o
// lancamento). A agregada Conta nao faz parte desta fatia — so o identificador.
public readonly record struct ContaId(Guid Valor)
{
    public bool EhVazio => Valor == Guid.Empty;

    public static ContaId Novo() => new(Guid.NewGuid());

    public static ContaId De(Guid valor) => new(Identificador.Validar(valor, nameof(ContaId)));

    public static bool TentarAnalisar(string? texto, out ContaId id)
    {
        var sucesso = Identificador.TentarAnalisar(texto, out var valor);
        id = new ContaId(valor);
        return sucesso;
    }

    public static ContaId Analisar(string? texto) => new(Identificador.Analisar(texto, nameof(ContaId)));

    public override string ToString() => Identificador.ParaTexto(Valor);
}
