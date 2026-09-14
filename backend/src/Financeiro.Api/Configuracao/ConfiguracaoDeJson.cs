using System.Text.Json;
using System.Text.Json.Serialization;

namespace Financeiro.Api.Configuracao;

// Politica unica de JSON da API. O cliente e TypeScript e os DTOs da Application
// foram escritos para camelCase — mudar isso aqui quebra o contrato de fio inteiro
// sem quebrar nenhum teste de unidade da Application.
internal static class ConfiguracaoDeJson
{
    public static void Aplicar(JsonSerializerOptions opcoes)
    {
        ArgumentNullException.ThrowIfNull(opcoes);

        opcoes.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        opcoes.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;

        // Dinheiro e inteiro em centavos. Strict e o padrao do System.Text.Json e
        // esta aqui EXPLICITO para nao ser afrouxado por distracao: com
        // AllowReadingFromString ou tolerancia a fracao, "12.5" viraria 12 ou 13 e
        // a API concordaria silenciosamente com um valor que o usuario nunca digitou.
        // Do jeito que esta, 12.5 falha na desserializacao e vira 400.
        opcoes.NumberHandling = JsonNumberHandling.Strict;

        // Nulo explicito no fio: deletedAt/contaId nulos PRECISAM aparecer, porque e
        // assim que o cliente distingue "campo ausente" de "campo apagado".
        opcoes.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    }
}
