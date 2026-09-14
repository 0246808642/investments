namespace Financeiro.Application.Transacoes.Dtos;

// Situacao de cada item enviado pelo cliente. Vai no fio como texto minusculo
// (SituacaoItem.ParaTexto) para nao amarrar o cliente a numeros de enum.
public enum SituacaoItem
{
    // Linha que o servidor ainda nao conhecia.
    Criada,

    // Versao recebida venceu a armazenada.
    Atualizada,

    // Versao recebida perdeu o last-write-wins, ou era o mesmo delta de novo.
    // NAO e erro: e o desfecho normal de dois aparelhos offline.
    Descartada,

    // Delta malformado ou que fere uma invariante. So este item cai; o resto do
    // lote entra.
    Rejeitada,
}

public static class SituacaoItemExtensoes
{
    public static string ParaTexto(this SituacaoItem situacao) => situacao switch
    {
        SituacaoItem.Criada => "criada",
        SituacaoItem.Atualizada => "atualizada",
        SituacaoItem.Descartada => "descartada",
        SituacaoItem.Rejeitada => "rejeitada",
        _ => "rejeitada",
    };
}

// Desfecho de um item do lote. Id vem como o cliente mandou (inclusive quando e
// invalido), para que ele consiga casar a resposta com a linha local dele.
public sealed record ResultadoItemDto(string Id, string Situacao, string? Motivo);

// CONTRATO DE FIO (cliente -> servidor), camelCase:
//   { transacoes: [...], desde: "2026-09-14T12:00:00.000Z", ultimoId: "<uuid>", limite: 500 }
//
// desde/ultimoId sao o marco devolvido pela resposta anterior — o cliente repete
// o par sem interpretar. Nulos nos dois = primeira sincronizacao, traz tudo.
public sealed record RequisicaoSincronizacaoDto(
    IReadOnlyList<TransacaoEntradaDto>? Transacoes,
    string? Desde,
    string? UltimoId,
    int? Limite);

// CONTRATO DE FIO (servidor -> cliente), camelCase:
//   { transacoes, resultados, proximoDesde, proximoUltimoId, temMais, servidorEm }
//
// temMais indica que a pagina encheu: o cliente deve chamar de novo com o marco
// devolvido, sem esperar o proximo ciclo.
// servidorEm e o relogio do servidor no momento da resposta — o cliente usa para
// perceber que o relogio dele esta torto, que e o que produz conflito de empate.
public sealed record RespostaSincronizacaoDto(
    IReadOnlyList<TransacaoDto> Transacoes,
    IReadOnlyList<ResultadoItemDto> Resultados,
    string? ProximoDesde,
    string? ProximoUltimoId,
    bool TemMais,
    string ServidorEm);
