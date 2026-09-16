using Financeiro.Domain.Comum;

namespace Financeiro.Application.Abstracoes;

/// Resultado de registro ou login. Erros vem como lista de mensagens porque o
/// Identity devolve varias de uma vez (senha curta, sem digito, sem maiuscula).
public sealed record ResultadoIdentidade(
    bool Sucesso,
    string? Token,
    DateTimeOffset? ExpiraEm,
    UsuarioId? Usuario,
    IReadOnlyList<string> Erros,
    /// Nome de exibicao. Nulo nas contas criadas antes da coluna existir — o
    /// cliente cai para o e-mail nesses casos.
    string? Nome = null)
{
    public static ResultadoIdentidade Ok(
        string token,
        DateTimeOffset expiraEm,
        UsuarioId usuario,
        string? nome = null)
        => new(true, token, expiraEm, usuario, [], nome);

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
    /// `nome` e o rotulo de exibicao, nao credencial: o login continua por e-mail.
    Task<ResultadoIdentidade> RegistrarAsync(
        string email,
        string senha,
        string nome,
        CancellationToken cancellationToken);

    Task<ResultadoIdentidade> AutenticarAsync(string email, string senha, CancellationToken cancellationToken);

    /// Emite um token novo para quem JA provou ser quem diz, apresentando um token
    /// ainda valido. Nao ve senha: a prova de identidade e o Bearer que o pipeline
    /// de autenticacao ja validou antes do endpoint rodar.
    ///
    /// E o que faz a sessao deslizar em vez de morrer na hora marcada. Sem isto o
    /// token tem prazo fixo desde o login e, no dia do vencimento, quem usa o app
    /// todo dia e mandado para a tela de login do mesmo jeito que quem sumiu por um
    /// mes.
    ///
    /// Falha quando a conta sumiu entre a emissao e a renovacao — conta apagada
    /// nao ganha token novo so porque o antigo ainda nao venceu.
    Task<ResultadoIdentidade> RenovarAsync(UsuarioId usuario, CancellationToken cancellationToken);
}
