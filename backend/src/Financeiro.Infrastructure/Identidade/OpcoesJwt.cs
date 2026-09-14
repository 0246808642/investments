using System.Globalization;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Financeiro.Infrastructure.Identidade;

// Configuracao do token, vinda de IConfiguration. Nada aqui tem valor padrao de
// producao: a chave nao tem default nenhum, e um valor ausente ou curto derruba a
// aplicacao na primeira resolucao do servico em vez de assinar token com segredo
// previsivel.
public sealed class OpcoesJwt
{
    // Secao do appsettings / variaveis de ambiente / user-secrets.
    public const string Secao = "Jwt";

    // HMAC-SHA256 precisa de chave com pelo menos o tamanho do digest (256 bits).
    // Chave menor e aceita por algumas bibliotecas e reduz a seguranca em silencio;
    // aqui e erro.
    public const int TamanhoMinimoDaChaveEmBytes = 32;

    public string Chave { get; set; } = string.Empty;

    public string Emissor { get; set; } = string.Empty;

    public string Audiencia { get; set; } = string.Empty;

    public int MinutosDeValidade { get; set; } = 60;

    // Tolerancia de relogio na validacao. O padrao da biblioteca e 5 minutos, o que
    // estende a vida util de um token revogado; 30 segundos cobre desvio real de
    // relogio entre aparelho e servidor sem alargar a janela.
    public static TimeSpan ToleranciaDeRelogio => TimeSpan.FromSeconds(30);

    public static OpcoesJwt Carregar(IConfiguration configuracao)
    {
        ArgumentNullException.ThrowIfNull(configuracao);

        var opcoes = new OpcoesJwt();
        configuracao.GetSection(Secao).Bind(opcoes);
        return opcoes;
    }

    public SymmetricSecurityKey ChaveDeAssinatura()
    {
        var erro = PrimeiroErro();
        if (erro is not null)
        {
            throw new InvalidOperationException(erro);
        }

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Chave));
    }

    // O que a API precisa entregar ao AddJwtBearer. Fica aqui, e nao na API, para
    // que emissao e validacao usem literalmente o mesmo objeto de configuracao —
    // emissor e audiencia divergindo entre os dois lados produz um 401 que nao se
    // explica olhando so um dos arquivos.
    public TokenValidationParameters ParametrosDeValidacao() => new()
    {
        ValidateIssuer = true,
        ValidIssuer = Emissor,
        ValidateAudience = true,
        ValidAudience = Audiencia,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = ChaveDeAssinatura(),
        ValidateLifetime = true,
        ClockSkew = ToleranciaDeRelogio,
        // Com MapInboundClaims desligado na API, e este o tipo de claim que vira
        // Identity.Name/NameIdentifier. Apontar para a claim propria mantem o
        // User.FindFirst(ClaimsFinanceiro.UsuarioId) valido em qualquer caso.
        NameClaimType = ClaimsFinanceiro.UsuarioId,
    };

    // Mensagem do primeiro problema de configuracao, ou nulo se esta tudo certo.
    public string? PrimeiroErro()
    {
        if (string.IsNullOrWhiteSpace(Chave))
        {
            return "Jwt:Chave nao configurada. Defina em user-secrets, variavel de ambiente ou appsettings.Development.json — nunca no appsettings.json versionado.";
        }

        var bytes = Encoding.UTF8.GetByteCount(Chave);
        if (bytes < TamanhoMinimoDaChaveEmBytes)
        {
            return "Jwt:Chave curta demais para HMAC-SHA256: "
                + bytes.ToString(CultureInfo.InvariantCulture)
                + " bytes, minimo "
                + TamanhoMinimoDaChaveEmBytes.ToString(CultureInfo.InvariantCulture)
                + ".";
        }

        if (string.IsNullOrWhiteSpace(Emissor))
        {
            return "Jwt:Emissor nao configurado.";
        }

        if (string.IsNullOrWhiteSpace(Audiencia))
        {
            return "Jwt:Audiencia nao configurada.";
        }

        return MinutosDeValidade <= 0
            ? "Jwt:MinutosDeValidade precisa ser maior que zero."
            : null;
    }
}
