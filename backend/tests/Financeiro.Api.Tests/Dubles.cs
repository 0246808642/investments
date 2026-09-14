using System.Globalization;
using System.Security.Claims;
using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;
using Financeiro.Infrastructure.Identidade;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Financeiro.Api.Tests;

// Fakes em memoria das QUATRO portas da Application. O no da API se verifica
// sozinho: nenhum teste aqui depende de Postgres, de migration ou do que a
// Infrastructure fez. Se um teste destes quebrar, o defeito esta na API.
internal sealed class RelogioFixo : IRelogio
{
    public RelogioFixo(string iso) => Agora = Instante.Analisar(iso);

    public DateTimeOffset Agora { get; set; }
}

internal sealed class UnidadeDeTrabalhoFake : IUnidadeDeTrabalho
{
    public int Salvamentos { get; private set; }

    public Task SalvarAlteracoesAsync(CancellationToken cancellationToken)
    {
        Salvamentos++;
        return Task.CompletedTask;
    }

    public Task<T> ExecutarEmTransacaoAsync<T>(
        Func<CancellationToken, Task<T>> operacao,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(operacao);

        return operacao(cancellationToken);
    }
}

// Implementa o contrato documentado na porta: escopo por usuario em TODA consulta,
// sem DELETE, pull por chave composta (AtualizadoEm, Id), excluidas incluidas no
// pull. O escopo por usuario e o que torna o teste de vazamento entre contas uma
// prova, e nao uma suposicao.
internal sealed class RepositorioEmMemoria : IRepositorioTransacoes
{
    private readonly List<Transacao> _itens = [];

    // Falha injetada para exercitar o caminho de excecao inesperada (500).
    public Exception? FalhaProgramada { get; set; }

    public IReadOnlyList<Transacao> Itens => _itens;

    public void Semear(params Transacao[] transacoes)
    {
        ArgumentNullException.ThrowIfNull(transacoes);

        _itens.AddRange(transacoes);
    }

    public Transacao? Buscar(TransacaoId id) => _itens.Find(t => t.Id == id);

    public Task<Transacao?> ObterAsync(UsuarioId usuario, TransacaoId id, CancellationToken cancellationToken)
    {
        Explodir();
        return Task.FromResult(_itens.Find(t => t.UsuarioId == usuario && t.Id == id));
    }

    public Task<IReadOnlyList<Transacao>> ObterPorIdsAsync(
        UsuarioId usuario,
        IReadOnlyCollection<TransacaoId> ids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        Explodir();

        IReadOnlyList<Transacao> encontradas = _itens
            .Where(t => t.UsuarioId == usuario && ids.Contains(t.Id))
            .ToList();

        return Task.FromResult(encontradas);
    }

    public Task<IReadOnlyList<Transacao>> ListarPorPeriodoAsync(
        UsuarioId usuario,
        DataMovimento inicio,
        DataMovimento fim,
        bool incluirExcluidas,
        CancellationToken cancellationToken)
    {
        Explodir();

        IReadOnlyList<Transacao> encontradas = _itens
            .Where(t => t.UsuarioId == usuario)
            .Where(t => t.Data.EstaNoIntervalo(inicio, fim))
            .Where(t => incluirExcluidas || !t.EstaExcluida)
            .OrderBy(t => t.Data)
            .ThenBy(t => t.Id.ToString(), StringComparer.Ordinal)
            .ToList();

        return Task.FromResult(encontradas);
    }

    public Task<IReadOnlyList<Transacao>> ListarAlteradasDesdeAsync(
        UsuarioId usuario,
        DateTimeOffset? desde,
        TransacaoId? ultimoId,
        int limite,
        CancellationToken cancellationToken)
    {
        Explodir();

        IReadOnlyList<Transacao> pagina = _itens
            .Where(t => t.UsuarioId == usuario)
            .Where(t => DepoisDoMarco(t, desde, ultimoId))
            .OrderBy(t => t.AtualizadoEm)
            .ThenBy(t => t.Id.ToString(), StringComparer.Ordinal)
            .Take(limite)
            .ToList();

        return Task.FromResult(pagina);
    }

    public Task AdicionarAsync(Transacao transacao, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(transacao);
        Explodir();

        _itens.Add(transacao);
        return Task.CompletedTask;
    }

    public void Atualizar(Transacao transacao)
    {
        // Sem rastreamento: a agregada ja foi mutada em memoria.
    }

    private static bool DepoisDoMarco(Transacao transacao, DateTimeOffset? desde, TransacaoId? ultimoId)
    {
        if (desde is null)
        {
            return true;
        }

        if (transacao.AtualizadoEm > desde.Value)
        {
            return true;
        }

        if (transacao.AtualizadoEm < desde.Value)
        {
            return false;
        }

        return ultimoId is null
            || string.CompareOrdinal(transacao.Id.ToString(), ultimoId.Value.ToString()) > 0;
    }

    private void Explodir()
    {
        if (FalhaProgramada is not null)
        {
            throw FalhaProgramada;
        }
    }
}

// Emite um JWT DE VERDADE, assinado com a mesma chave que a API valida e com as
// mesmas claims que a Infrastructure emite (usuario_id e sub). Assim o teste de
// autorizacao exercita o handler real do ASP.NET, e nao um ClaimsPrincipal montado
// a mao, que passaria por cima justamente do que se quer provar.
internal sealed class ServicoDeIdentidadeFake : IServicoDeIdentidade
{
    public const int TamanhoMinimoDaSenha = 8;

    private readonly Dictionary<string, (UsuarioId Usuario, string Senha)> _contas =
        new(StringComparer.OrdinalIgnoreCase);

    private readonly OpcoesJwt _opcoes;
    private readonly RelogioFixo _relogio;

    public ServicoDeIdentidadeFake(OpcoesJwt opcoes, RelogioFixo relogio)
    {
        ArgumentNullException.ThrowIfNull(opcoes);
        ArgumentNullException.ThrowIfNull(relogio);

        _opcoes = opcoes;
        _relogio = relogio;
    }

    // Cadastro direto, sem passar pelo endpoint: usado para semear o usuario B e
    // saber o UsuarioId dele antes de qualquer requisicao.
    public UsuarioId Cadastrar(string email, string senha)
    {
        var usuario = UsuarioId.Novo();
        _contas[email] = (usuario, senha);
        return usuario;
    }

    public Task<ResultadoIdentidade> RegistrarAsync(string email, string senha, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(email);
        ArgumentNullException.ThrowIfNull(senha);

        if (_contas.ContainsKey(email))
        {
            return Task.FromResult(ResultadoIdentidade.Falha("Email ja esta em uso."));
        }

        if (senha.Length < TamanhoMinimoDaSenha)
        {
            return Task.FromResult(ResultadoIdentidade.Falha(
                "Senha precisa de pelo menos "
                    + TamanhoMinimoDaSenha.ToString(CultureInfo.InvariantCulture)
                    + " caracteres.",
                "Senha precisa de pelo menos um digito."));
        }

        var usuario = Cadastrar(email, senha);
        return Task.FromResult(Emitir(usuario));
    }

    public Task<ResultadoIdentidade> AutenticarAsync(string email, string senha, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(email);

        return Task.FromResult(
            _contas.TryGetValue(email, out var conta) && string.Equals(conta.Senha, senha, StringComparison.Ordinal)
                ? Emitir(conta.Usuario)
                : ResultadoIdentidade.Falha("Credenciais invalidas."));
    }

    // Token valido, porem SEM a claim de usuario: prova que a API devolve 401 (e
    // nao 500 nem, pior, o dado de alguem) quando o token nao identifica ninguem.
    public string TokenSemClaimDeUsuario() => Assinar(new Dictionary<string, object>(StringComparer.Ordinal)
    {
        ["email"] = "fantasma@exemplo.com",
    });

    private ResultadoIdentidade Emitir(UsuarioId usuario)
    {
        var expiraEm = _relogio.Agora.AddMinutes(_opcoes.MinutosDeValidade);
        var token = Assinar(new Dictionary<string, object>(StringComparer.Ordinal)
        {
            [ClaimsFinanceiro.UsuarioId] = usuario.ToString(),
            [JwtRegisteredClaimNames.Sub] = usuario.ToString(),
        });

        return ResultadoIdentidade.Ok(token, expiraEm, usuario);
    }

    private string Assinar(Dictionary<string, object> claims)
    {
        var descritor = new SecurityTokenDescriptor
        {
            Issuer = _opcoes.Emissor,
            Audience = _opcoes.Audiencia,
            IssuedAt = DateTime.UtcNow,
            NotBefore = DateTime.UtcNow.AddMinutes(-1),
            Expires = DateTime.UtcNow.AddMinutes(_opcoes.MinutosDeValidade),
            Claims = claims,
            Subject = new ClaimsIdentity(),
            SigningCredentials = new SigningCredentials(
                _opcoes.ChaveDeAssinatura(),
                SecurityAlgorithms.HmacSha256),
        };

        return new JsonWebTokenHandler().CreateToken(descritor);
    }
}
