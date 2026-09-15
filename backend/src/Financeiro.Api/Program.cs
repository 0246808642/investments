using Financeiro.Api.Configuracao;
using Financeiro.Api.Endpoints;
using Financeiro.Api.Erros;
using Financeiro.Api.Openapi;
using Financeiro.Api.Seguranca;
using Financeiro.Application.Transacoes.CasosDeUso;
using Financeiro.Infrastructure;
using Microsoft.Extensions.DependencyInjection.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Toda a infraestrutura de uma vez: DbContexts, repositorios, relogio, unidade de
// trabalho, identidade. A API nao registra nenhuma dessas portas na mao — se
// registrasse, existiriam duas verdades sobre como o dado e persistido e a que
// vale dependeria da ordem de registro.
builder.Services.AdicionarInfraestrutura(builder.Configuration);

// Casos de uso da Application. TryAdd porque a infraestrutura pode registra-los
// tambem: registro duplicado do mesmo tipo compila, passa no teste e so aparece em
// producao como "qual das duas instancias respondeu?".
builder.Services.TryAddScoped<SincronizarTransacoes>();
builder.Services.TryAddScoped<RegistrarTransacao>();
builder.Services.TryAddScoped<ListarTransacoesPorPeriodo>();
builder.Services.TryAddScoped<ExcluirTransacao>();

builder.Services.AdicionarAutenticacaoJwt(builder.Configuration);

builder.Services.ConfigureHttpJsonOptions(opcoes => ConfiguracaoDeJson.Aplicar(opcoes.SerializerOptions));

builder.Services.AddExceptionHandler<TratadorGlobalDeExcecoes>();
builder.Services.AddProblemDetails();

builder.Services.AddCors(opcoes => opcoes.AddPolicy(
    PoliticaDeCors.Nome,
    politica => politica
        .WithOrigins(PoliticaDeCors.LerOrigens(builder.Configuration))
        .AllowAnyHeader()
        .AllowAnyMethod()));

builder.Services.AddOpenApi(documento => documento.AddDocumentTransformer<TransformadorDeSegurancaBearer>());

var app = builder.Build();

// Release step do deploy: aplica as migrations dos dois contextos e encerra, sem
// abrir porta nenhuma. Roda numa maquina separada ANTES de a versao nova receber
// trafego, entao nenhuma instancia chega a subir com schema defasado.
//
// A excecao nao e capturada de proposito: processo que morre devolve codigo de
// saida diferente de zero, e e so isso que faz a Fly abortar o deploy e manter a
// versao antiga servindo. Um try/catch com log aqui transformaria migration
// quebrada em deploy "bem-sucedido" apontando para um banco incompativel.
if (args.Contains("--migrar"))
{
    await AplicadorDeMigracoes.AplicarAsync(app.Services);
    return;
}

// Primeiro da fila: sendo o middleware de excecao mais interno que o de
// desenvolvimento que o WebApplication instala sozinho, e ele quem captura, e a
// pagina de erro com stack trace nunca chega a ser renderizada — nem em
// Development.
app.UseExceptionHandler();

// CORS vale em TODO ambiente, e nao so em Development: o frontend e servido por
// outra origem (Vercel) tambem — e principalmente — em producao. Enquanto isto
// vivia dentro do if de desenvolvimento, o navegador barrava qualquer chamada do
// app publicado, e o erro aparecia no cliente como "nao foi possivel falar com o
// servidor", que e a mensagem que menos aponta para CORS.
//
// Antes da autenticacao: o preflight OPTIONS viaja sem Authorization e tomaria
// 401 antes de o navegador sequer mandar a requisicao de verdade.
//
// A lista de origens continua vindo de configuracao, nunca "*".
app.UseCors(PoliticaDeCors.Nome);

if (app.Environment.IsDevelopment())
{
    // A documentacao, essa sim, fica so em desenvolvimento: ela descreve a
    // superficie inteira da API e nao ha motivo de expo-la publicamente.
    app.MapOpenApi();
    app.UseSwaggerUI(opcoes => opcoes.SwaggerEndpoint("/openapi/v1.json", "Financeiro API v1"));
}

app.UseAuthentication();
app.UseAuthorization();

// Depois da autorizacao: sem token e 401, e nao um 400 de formato que confirmaria
// que a rota existe e o que ela aceita.
app.UseMiddleware<MiddlewareDeTipoDeConteudo>();

app.MapearSaude();

app.MapGroup("/api/autenticacao")
    .AllowAnonymous()
    .WithTags("Autenticacao")
    .MapearAutenticacao();

// RequireAuthorization no GRUPO, nao endpoint a endpoint: rota nova nasce
// protegida, e esquecer o atributo deixa de ser uma forma de vazar a base.
var dados = app.MapGroup("/api")
    .RequireAuthorization()
    .WithTags("Dados");

dados.MapearSincronizacao();
dados.MapearTransacoes();

app.Run();

// Exposto para os testes de integracao (WebApplicationFactory<Program>).
public partial class Program;
