namespace Financeiro.Domain.Comum;

/// Falha de invariante: o dado recebido nao pode virar um objeto de dominio valido.
/// Nao confundir com conflito de sincronizacao — versao velha que chega e caso
/// normal de negocio e sai como ResultadoSincronizacao, nunca como excecao.
public sealed class ErroDeDominioException : Exception
{
    public ErroDeDominioException()
    {
    }

    public ErroDeDominioException(string message)
        : base(message)
    {
    }

    public ErroDeDominioException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
