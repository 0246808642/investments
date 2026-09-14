using System.Globalization;
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
public sealed class ServicoDeIdentidade : IServicoDeIdentidade
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
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(email))
        {
            return ResultadoIdentidade.Falha("E-mail e obrigatorio.");
        }

        var normalizado = email.Trim();

        // UserName = e-mail: o sistema nao tem conceito de apelido, e deixar os dois
        // campos divergirem criaria duas chaves de login para a mesma conta.
        var usuario = new UsuarioDaAplicacao
        {
            UserName = normalizado,
            Email = normalizado,
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
        return ResultadoIdentidade.Ok(token, expira, usuarioId);
    }
}
