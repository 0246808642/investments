using System.Globalization;
using System.Text.RegularExpressions;
using Financeiro.Application.Abstracoes;
using Financeiro.Domain.Comum;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Financeiro.Infrastructure.Identidade;

// Implementacao de IServicoDeIdentidade sobre ASP.NET Identity + JWT assinado.
//
// A API nunca ve UserManager nem IdentityUser: ela pede "registre" ou "autentique"
// e recebe um ResultadoIdentidade com o token e o UsuarioId. Trocar o provedor de
// identidade um dia nao encosta em endpoint nenhum.
public sealed partial class ServicoDeIdentidade : IServicoDeIdentidade
{
    // Mesma mensagem para e-mail inexistente e para senha errada. Mensagens
    // diferentes transformam a tela de login num verificador de quais e-mails tem
    // conta no sistema.
    private const string CredenciaisInvalidas = "E-mail ou senha invalidos.";

    private readonly UserManager<UsuarioDaAplicacao> _gerenciador;
    private readonly IRelogio _relogio;
    private readonly OpcoesJwt _opcoes;

    public ServicoDeIdentidade(
        UserManager<UsuarioDaAplicacao> gerenciador,
        IRelogio relogio,
        IOptions<OpcoesJwt> opcoes)
    {
        ArgumentNullException.ThrowIfNull(opcoes);

        _gerenciador = gerenciador;
        _relogio = relogio;
        _opcoes = opcoes.Value;
    }

    public async Task<ResultadoIdentidade> RegistrarAsync(
        string email,
        string senha,
        string nome,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(email))
        {
            return ResultadoIdentidade.Falha("E-mail e obrigatorio.");
        }

        var normalizado = email.Trim();

        // Colapsa espacos repetidos alem de aparar as pontas: "Ana   Maria" e
        // "Ana Maria" sao o mesmo nome, e guardar os dois faria a mesma pessoa
        // parecer duas na lista de contas.
        var nomeNormalizado = EspacosRepetidos().Replace((nome ?? string.Empty).Trim(), " ");
        if (nomeNormalizado.Length < UsuarioDaAplicacao.TamanhoMinimoDoNome)
        {
            return ResultadoIdentidade.Falha("Informe um nome com pelo menos "
                + UsuarioDaAplicacao.TamanhoMinimoDoNome.ToString(CultureInfo.InvariantCulture)
                + " caracteres.");
        }

        if (nomeNormalizado.Length > UsuarioDaAplicacao.TamanhoMaximoDoNome)
        {
            return ResultadoIdentidade.Falha("O nome passa de "
                + UsuarioDaAplicacao.TamanhoMaximoDoNome.ToString(CultureInfo.InvariantCulture)
                + " caracteres.");
        }

        // UserName = e-mail: o sistema nao tem conceito de apelido, e deixar os dois
        // campos divergirem criaria duas chaves de login para a mesma conta.
        var usuario = new UsuarioDaAplicacao
        {
            UserName = normalizado,
            Email = normalizado,
            Nome = nomeNormalizado,
        };

        var criacao = await _gerenciador.CreateAsync(usuario, senha ?? string.Empty).ConfigureAwait(false);
        if (!criacao.Succeeded)
        {
            // E-mail duplicado e senha fraca chegam os dois por aqui, e o Identity
            // devolve varios erros de uma vez (curta, sem digito, sem maiuscula).
            return ResultadoIdentidade.Falha(DescricoesDe(criacao));
        }

        return EmitirToken(usuario);
    }

    public async Task<ResultadoIdentidade> AutenticarAsync(
        string email,
        string senha,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(email))
        {
            return ResultadoIdentidade.Falha(CredenciaisInvalidas);
        }

        var usuario = await _gerenciador.FindByEmailAsync(email.Trim()).ConfigureAwait(false);
        if (usuario is null)
        {
            return ResultadoIdentidade.Falha(CredenciaisInvalidas);
        }

        // CheckPasswordAsync e nao SignInManager: SignInManager depende de
        // HttpContext e de cookie, que nao existem num fluxo de token puro.
        var senhaConfere = await _gerenciador
            .CheckPasswordAsync(usuario, senha ?? string.Empty)
            .ConfigureAwait(false);

        return senhaConfere
            ? EmitirToken(usuario)
            : ResultadoIdentidade.Falha(CredenciaisInvalidas);
    }

    public async Task<ResultadoIdentidade> RenovarAsync(
        UsuarioId usuario,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (usuario.EhVazio)
        {
            return ResultadoIdentidade.Falha(CredenciaisInvalidas);
        }

        // Busca a conta em vez de reaproveitar as claims do token antigo: o nome
        // pode ter mudado, e a conta pode ter sido apagada. Renovar em cima do que
        // o proprio token afirma manteria vivo, indefinidamente, um token de conta
        // que nao existe mais.
        var conta = await _gerenciador.FindByIdAsync(usuario.ToString()).ConfigureAwait(false);

        return conta is null
            ? ResultadoIdentidade.Falha(CredenciaisInvalidas)
            : EmitirToken(conta);
    }

    // Gerado em tempo de compilacao: a regex e fixa e nao precisa ser interpretada
    // a cada registro.
    [GeneratedRegex(@"\s+")]
    private static partial Regex EspacosRepetidos();

    private static string[] DescricoesDe(IdentityResult resultado)
    {
        var erros = resultado.Errors as ICollection<IdentityError> ?? [.. resultado.Errors];
        var descricoes = new string[erros.Count];
        var posicao = 0;
        foreach (var erro in erros)
        {
            descricoes[posicao] = erro.Description;
            posicao++;
        }

        return descricoes;
    }

    private ResultadoIdentidade EmitirToken(UsuarioDaAplicacao usuario)
    {
        // O UsuarioId do dominio E a chave do Identity. Sem traducao, sem tabela de
        // correspondencia, sem um segundo lugar onde o id possa divergir.
        var usuarioId = usuario.ParaUsuarioId();

        var agora = _relogio.Agora;
        var expira = agora.AddMinutes(_opcoes.MinutosDeValidade);

        var descritor = new SecurityTokenDescriptor
        {
            Issuer = _opcoes.Emissor,
            Audience = _opcoes.Audiencia,
            IssuedAt = agora.UtcDateTime,
            NotBefore = agora.UtcDateTime,
            Expires = expira.UtcDateTime,
            Claims = new Dictionary<string, object>(StringComparer.Ordinal)
            {
                // A claim que a API le para escopar TODA consulta do dominio.
                [ClaimsFinanceiro.UsuarioId] = usuarioId.ToString(),

                // 'sub' com o mesmo valor, para ferramentas que esperam a claim
                // registrada. Os dois sempre concordam por construcao.
                [JwtRegisteredClaimNames.Sub] = usuarioId.ToString(),
                [JwtRegisteredClaimNames.Email] = usuario.Email ?? string.Empty,

                // Identificador unico do token, para que dois logins no mesmo
                // milissegundo nao produzam a mesma string.
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString("D", CultureInfo.InvariantCulture),
            },
            SigningCredentials = new SigningCredentials(
                _opcoes.ChaveDeAssinatura(),
                SecurityAlgorithms.HmacSha256),
        };

        var token = new JsonWebTokenHandler().CreateToken(descritor);

        // O nome viaja na RESPOSTA, nao no token. Token e credencial: vai em todo
        // cabecalho Authorization, fica em log de proxy e nao se revoga. Nome e
        // dado de apresentacao, e o cliente so precisa dele uma vez, no login.
        return ResultadoIdentidade.Ok(token, expira, usuarioId, usuario.Nome);
    }
}
