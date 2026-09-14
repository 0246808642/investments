using Financeiro.Domain.Comum;

namespace Financeiro.Application.Abstracoes;

/// Resultado de registro ou login. Erros vem como lista de mensagens porque o
/// Identity devolve varias de uma vez (senha curta, sem digito, sem maiuscula).
public sealed record ResultadoIdentidade(
    bool Sucesso,
    string? Token,
    DateTimeOffset? ExpiraEm,
    UsuarioId? Usuario,
    IReadOnlyList<string> Erros)
{
    public static ResultadoIdentidade Ok(string token, DateTimeOffset expiraEm, UsuarioId usuario)
        => new(true, token, expiraEm, usuario, []);

    public static ResultadoIdentidade Falha(params string[] erros)
        => new(false, null, null, null, erros);
}

/// Fronteira entre a API e a implementacao de identidade.
///
/// Existe para que a camada de API nao dependa do ASP.NET Identity nem de como o
/// token e assinado: ela pede "autentique" e recebe um UsuarioId, que e o mesmo
/// tipo que escopa toda agregada do dominio. Trocar Identity por outro provedor
/// (ou por OAuth) nao deve tocar em endpoint nenhum.
///
/// Deliberadamente NAO expoe entidade de usuario: o dominio financeiro so precisa
/// saber de quem e o registro, nunca o e-mail ou o hash da senha.
public interface IServicoDeIdentidade
{
    Task<ResultadoIdentidade> RegistrarAsync(string email, string senha, CancellationToken cancellationToken);

    Task<ResultadoIdentidade> AutenticarAsync(string email, string senha, CancellationToken cancellationToken);
}
