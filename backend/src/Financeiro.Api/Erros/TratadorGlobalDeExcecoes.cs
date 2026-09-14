using System.Text.Json;
using Financeiro.Domain.Comum;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Financeiro.Api.Erros;

// Ultima linha antes da resposta. Traduz excecao em status e nunca deixa detalhe
// interno sair no corpo.
//
// Tres casos, e so tres:
//   ErroDeDominioException  -> 400. E a unica excecao que a Application deixa
//                              subir, e a mensagem dela foi escrita para ser lida
//                              por quem chamou.
//   BadHttpRequestException -> 400. Falha de FORMATO (JSON quebrado, Content-Type
//                              errado, "valor": 12.5 num campo inteiro). A
//                              mensagem do serializador diz o caminho do campo, que
//                              e exatamente o que o cliente precisa para corrigir.
//   qualquer outra          -> 500 com texto fixo. Vai para o log com a excecao
//                              inteira; para o cliente vai uma frase. Stack trace
//                              na resposta entrega caminho de arquivo, nome de
//                              tipo interno e versao de pacote para quem so mandou
//                              uma requisicao torta.
internal sealed partial class TratadorGlobalDeExcecoes : IExceptionHandler
{
    public const string MensagemDeFalhaInterna =
        "Erro interno ao processar a requisicao. Tente novamente; se persistir, avise o suporte.";

    private readonly ILogger<TratadorGlobalDeExcecoes> _registrador;

    public TratadorGlobalDeExcecoes(ILogger<TratadorGlobalDeExcecoes> registrador)
    {
        ArgumentNullException.ThrowIfNull(registrador);

        _registrador = registrador;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        var (status, corpo) = Traduzir(exception);

        if (status == StatusCodes.Status500InternalServerError)
        {
            RegistrarFalhaInterna(
                _registrador,
                httpContext.Request.Method,
                httpContext.Request.Path.ToString(),
                exception);
        }

        httpContext.Response.StatusCode = status;
        httpContext.Response.ContentType = "application/json; charset=utf-8";
        await httpContext.Response.WriteAsJsonAsync(corpo, cancellationToken).ConfigureAwait(false);

        return true;
    }

    private static (int Status, RespostaDeErro Corpo) Traduzir(Exception? excecao) => excecao switch
    {
        ErroDeDominioException erro
            => (StatusCodes.Status400BadRequest, RespostaDeErro.De(erro.Message)),

        BadHttpRequestException erro
            => (StatusCodes.Status400BadRequest, RespostaDeErro.De(DescreverFalhaDeFormato(erro))),

        JsonException erro
            => (StatusCodes.Status400BadRequest, RespostaDeErro.De("JSON invalido: " + erro.Message)),

        _ => (StatusCodes.Status500InternalServerError, RespostaDeErro.De(MensagemDeFalhaInterna)),
    };

    // A mensagem util esta na JsonException interna ("The JSON value could not be
    // converted to System.Int64. Path: $.transacoes[0].valor"). A de fora so diz
    // que falhou ao ler o corpo.
    private static string DescreverFalhaDeFormato(BadHttpRequestException erro)
        => erro.InnerException is JsonException interna
            ? "Corpo invalido: " + interna.Message
            : "Requisicao invalida: " + erro.Message;

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Error,
        Message = "Falha nao tratada em {Metodo} {Caminho}")]
    private static partial void RegistrarFalhaInterna(
        ILogger registrador,
        string metodo,
        string caminho,
        Exception excecao);
}
