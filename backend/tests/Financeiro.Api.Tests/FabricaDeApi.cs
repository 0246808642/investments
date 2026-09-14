using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Financeiro.Application.Abstracoes;
using Financeiro.Application.Transacoes;
using Financeiro.Infrastructure;
using Financeiro.Infrastructure.Identidade;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Financeiro.Api.Tests;

// Sobe a API de verdade (pipeline, autenticacao, serializacao, tratador de erro) e
// troca SO as quatro portas da Application por fakes em memoria.
//
// A troca e no limite certo: tudo que e responsabilidade da API continua sendo
// exercitado pelo codigo real. Se os testes montassem um ClaimsPrincipal a mao ou
// chamassem os casos de uso direto, o 401 que eles cobram nunca teria sido
// produzido pelo middleware que produz o 401 em producao.
internal sealed class FabricaDeApi : WebApplicationFactory<Program>
{
    // Chave de teste, longa o bastante para HMAC-SHA256. Vive aqui e em lugar
    // nenhum do projeto de producao: la a chave so vem de IConfiguration.
    public const string ChaveDeTeste = "chave-de-teste-somente-para-integracao-32+";

    public const string Emissor = "financeiro-testes";

    public const string Audiencia = "financeiro-testes";

    public const string AgoraDoServidor = "2026-09-20T10:00:00.000Z";

    private static readonly JsonSerializerOptions LeituraCamelCase = new(JsonSerializerDefaults.Web);

    public RepositorioEmMemoria Repositorio { get; } = new();

    public UnidadeDeTrabalhoFake UnidadeDeTrabalho { get; } = new();

    public RelogioFixo Relogio { get; } = new(AgoraDoServidor);

    public ServicoDeIdentidadeFake Identidade { get; }

    public FabricaDeApi()
    {
        var opcoes = new OpcoesJwt
        {
            Chave = ChaveDeTeste,
            Emissor = Emissor,
            Audiencia = Audiencia,
            MinutosDeValidade = 60,
        };

        Identidade = new ServicoDeIdentidadeFake(opcoes, Relogio);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        // Development de proposito: e o ambiente que liga CORS, OpenAPI e a pagina
        // de erro de desenvolvimento do ASP.NET. Se o tratador global nao fosse mais
        // interno que ela, o teste de "500 sem stack trace" pegaria o vazamento.
        builder.UseEnvironment("Development");

        foreach (var (chave, valor) in Definicoes)
        {
            builder.UseSetting(chave, valor);
        }

        builder.ConfigureAppConfiguration(configuracao => configuracao.AddInMemoryCollection(Definicoes));

        builder.ConfigureTestServices(servicos =>
        {
            Substituir<IRepositorioTransacoes>(servicos, Repositorio);
            Substituir<IUnidadeDeTrabalho>(servicos, UnidadeDeTrabalho);
            Substituir<IRelogio>(servicos, Relogio);
            Substituir<IServicoDeIdentidade>(servicos, Identidade);
        });
    }

    private static readonly Dictionary<string, string?> Definicoes =
            new(StringComparer.Ordinal)
            {
                ["Jwt:Chave"] = ChaveDeTeste,
                ["Jwt:Emissor"] = Emissor,
                ["Jwt:Audiencia"] = Audiencia,
                ["Jwt:MinutosDeValidade"] = "60",

                // A infraestrutura registra o DbContext no arranque e recusa subir
                // sem connection string. Nada aqui abre conexao — as quatro portas
                // estao trocadas por fakes —, mas a string precisa existir para o
                // registro nao falhar. O nome vem da constante da propria
                // Infrastructure, e nao de um literal copiado.
                ["ConnectionStrings:" + InjecaoDeDependencia.NomeDaConexao] = ConexaoDeTeste,
                ["Cors:OrigensPermitidas:0"] = "http://localhost:5173",
            };

    private const string ConexaoDeTeste =
        "Host=localhost;Port=5433;Database=financeiro_testes;Username=financeiro;Password=financeiro_dev";

    private static void Substituir<T>(IServiceCollection servicos, T instancia)
        where T : class
    {
        servicos.RemoveAll<T>();
        servicos.AddSingleton(instancia);
    }

    // Registra a conta pelo endpoint real e devolve um cliente ja com o Bearer.
    // Passar pelo endpoint (e nao assinar um token por fora) prova que o token que
    // a API emite e aceito pela API.
    public async Task<HttpClient> ClienteAutenticadoAsync(string email, string senha = "senha-forte-123")
    {
        var cliente = CreateClient();
        var resposta = await cliente.PostAsync(
            new Uri("/api/autenticacao/registrar", UriKind.Relative),
            JsonContent.Create(new { email, senha }));

        resposta.EnsureSuccessStatusCode();

        var corpo = await resposta.Content.ReadFromJsonAsync<JsonElement>(LeituraCamelCase);
        var token = corpo.GetProperty("token").GetString();

        cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return cliente;
    }

    public HttpClient ClienteComToken(string token)
    {
        var cliente = CreateClient();
        cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return cliente;
    }

    // JSON cru de proposito na entrada dos testes de contrato: e o unico jeito de
    // provar que o fio aceita exatamente "valor": 1000 e recusa "valor": 12.5.
    public static StringContent Json(string corpo)
        => new(corpo, Encoding.UTF8, "application/json");

    public static async Task<JsonElement> LerAsync(HttpResponseMessage resposta)
    {
        ArgumentNullException.ThrowIfNull(resposta);

        var texto = await resposta.Content.ReadAsStringAsync();
        return JsonDocument.Parse(texto).RootElement.Clone();
    }
}
