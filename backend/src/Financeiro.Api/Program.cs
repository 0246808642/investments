using Financeiro.Api.Configuracao;
using Financeiro.Api.Endpoints;
using Financeiro.Api.Erros;
using Financeiro.Api.Openapi;
using Financeiro.Api.Seguranca;
using Financeiro.Application.Transacoes.CasosDeUso;
using Financeiro.Infrastructure;
using Financeiro.Infrastructure.Persistencia;
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

// Comando de manutencao nao emite nem valida token, entao nao exige Jwt:Chave.
// Sem esta condicao, trocar uma senha contra o banco de producao a partir de uma
// maquina de desenvolvimento pediria tambem o segredo de assinatura — uma
// variavel que nao tem nada a ver com a tarefa, e que so seria inventada na hora
// para o processo subir.
var manutencao = args.Contains("--migrar") || args.Contains("--redefinir-senha");

if (!manutencao)
{
    builder.Services.AdicionarAutenticacaoJwt(builder.Configuration);
}

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

// Manutencao manual: troca a senha de uma conta e encerra, sem abrir porta.
//
//   dotnet run -- --redefinir-senha <e-mail> [senha]
//
// Sem a senha no comando, ela e lida da entrada padrao — assim ela nao fica no
// historico do shell nem na lista de processos da maquina. Existe porque nao ha
// "esqueci minha senha" no app (nao ha envio de e-mail configurado); ver o
// cabecalho de RedefinidorDeSenha.
if (args.Contains("--redefinir-senha"))
{
    var posicao = Array.IndexOf(args, "--redefinir-senha");
    var email = posicao + 1 < args.Length ? args[posicao + 1] : null;
    var senha = posicao + 2 < args.Length ? args[posicao + 2] : LerSenhaDaEntrada();

    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(senha))
    {
        await Console.Error.WriteLineAsync("Uso: --redefinir-senha <e-mail> [senha]");
        Environment.ExitCode = 1;
        return;
    }

    // Diz o banco ANTES de escrever: a mesma maquina alcanca o Postgres local e o
    // de producao, e a diferenca entre eles nao aparece em lugar nenhum da saida.
    await Console.Error.WriteLineAsync(
        "Banco: " + ConexaoPostgres.Descrever(ConexaoPostgres.Resolver(builder.Configuration)));

    var resultado = await RedefinidorDeSenha.RedefinirAsync(app.Services, email, senha);

    foreach (var aviso in resultado.Avisos)
    {
        await Console.Error.WriteLineAsync("Aviso: a senha nova nao atende a politica do cadastro — " + aviso);
    }

    await Console.Out.WriteLineAsync(resultado.Mensagem);
    Environment.ExitCode = resultado.Ok ? 0 : 1;
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

// A renovacao mora no mesmo prefixo, mas em grupo separado: ela e a unica rota de
// autenticacao que EXIGE token em vez de emitir um do nada.
app.MapGroup("/api/autenticacao")
    .RequireAuthorization()
    .WithTags("Autenticacao")
    .MapearRenovacao();

// RequireAuthorization no GRUPO, nao endpoint a endpoint: rota nova nasce
// protegida, e esquecer o atributo deixa de ser uma forma de vazar a base.
var dados = app.MapGroup("/api")
    .RequireAuthorization()
    .WithTags("Dados");

dados.MapearSincronizacao();
dados.MapearTransacoes();

app.Run();

// Le a senha sem eco. Terminal redirecionado (pipe) cai no ReadLine normal: sem
// console de verdade, Console.ReadKey lanca.
static string? LerSenhaDaEntrada()
{
    Console.Error.Write("Senha nova: ");
    if (Console.IsInputRedirected)
    {
        return Console.ReadLine();
    }

    var digitado = new System.Text.StringBuilder();
    while (true)
    {
        var tecla = Console.ReadKey(intercept: true);
        if (tecla.Key == ConsoleKey.Enter)
        {
            Console.Error.WriteLine();
            break;
        }

        if (tecla.Key == ConsoleKey.Backspace)
        {
            if (digitado.Length > 0)
            {
                digitado.Length -= 1;
            }
            continue;
        }

        digitado.Append(tecla.KeyChar);
    }

    return digitado.ToString();
}

// Exposto para os testes de integracao (WebApplicationFactory<Program>).
public partial class Program;
