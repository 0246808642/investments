using Financeiro.Api.Erros;
using Financeiro.Infrastructure.Identidade;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Financeiro.Api.Seguranca;

internal static class ExtensoesDeAutenticacao
{
    // Os parametros de validacao vem do MESMO objeto de configuracao que assina o
    // token (OpcoesJwt, na Infrastructure). Reescrever emissor/audiencia/chave aqui
    // criaria dois lugares para manter iguais, e o sintoma da divergencia e um 401
    // que nao se explica olhando so um dos dois arquivos.
    //
    // Nada de segredo embutido: falta de "Jwt:Chave" derruba a aplicacao no
    // arranque, que e melhor do que subir aceitando token assinado com um valor
    // padrao que esta no repositorio.
    public static IServiceCollection AdicionarAutenticacaoJwt(
        this IServiceCollection servicos,
        IConfiguration configuracao)
    {
        var opcoes = OpcoesJwt.Carregar(configuracao);
        if (opcoes.PrimeiroErro() is { } erro)
        {
            throw new InvalidOperationException(erro);
        }

        servicos
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(esquema =>
            {
                // Sem desligar o remapeamento, "sub" chega reescrito como a URI longa
                // do WS-Federation. A claim propria (usuario_id) atravessa intacta de
                // qualquer jeito, mas deixar o mapa ligado mudaria o que
                // Identity.Name devolve.
                esquema.MapInboundClaims = false;
                esquema.TokenValidationParameters = opcoes.ParametrosDeValidacao();

                // O 401 padrao vem com corpo vazio. Aqui ele sai com o mesmo
                // { erro, detalhes } de todos os outros erros da API.
                esquema.Events = new JwtBearerEvents
                {
                    OnChallenge = contexto =>
                    {
                        ArgumentNullException.ThrowIfNull(contexto);

                        contexto.HandleResponse();
                        contexto.Response.Headers.WWWAuthenticate = JwtBearerDefaults.AuthenticationScheme;

                        return ResultadosDeErro
                            .NaoAutenticado("Autenticacao obrigatoria: envie o cabecalho Authorization: Bearer <token>.")
                            .ExecuteAsync(contexto.HttpContext);
                    },
                    OnForbidden = contexto =>
                    {
                        ArgumentNullException.ThrowIfNull(contexto);

                        return Results
                            .Json(
                                RespostaDeErro.De("Token valido, mas sem permissao para este recurso."),
                                statusCode: StatusCodes.Status403Forbidden)
                            .ExecuteAsync(contexto.HttpContext);
                    },
                };
            });

        servicos.AddAuthorization();
        return servicos;
    }
}
