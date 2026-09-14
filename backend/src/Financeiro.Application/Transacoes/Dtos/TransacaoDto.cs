namespace Financeiro.Application.Transacoes.Dtos;

// CONTRATO DE FIO (servidor -> cliente). Os nomes JSON precisam sair em camelCase
// e bater um a um com a interface Transacao do frontend:
//
//   { id, tipo, valor, data, categoriaId, descricao, contaId, updatedAt, deletedAt }
//
// A API deve configurar JsonNamingPolicy.CamelCase. UpdatedAt e DeletedAt ficam em
// ingles de proposito: sao os campos do BaseEntity do cliente, e traduzi-los aqui
// quebraria o contrato existente do PWA por gosto pessoal.
//
// valor e inteiro (centavos) — nunca decimal no JSON.
// data e string 'YYYY-MM-DD' — nunca DateTime, que o serializador mandaria com
// hora e fuso e deslocaria o dia.
// updatedAt/deletedAt sao ISO-8601 UTC com milissegundos e 'Z' final.
public sealed record TransacaoDto(
    string Id,
    string Tipo,
    long Valor,
    string Data,
    string CategoriaId,
    string Descricao,
    string? ContaId,
    string UpdatedAt,
    string? DeletedAt);

// CONTRATO DE FIO (cliente -> servidor). Mesma forma JSON, todos os campos
// anulaveis: e JSON de fora, e o que chega pode nao ter campo nenhum. Declarar
// nao-anulavel aqui seria mentir para o compilador e cobrar o preco com um
// NullReferenceException no meio de um lote.
public sealed record TransacaoEntradaDto(
    string? Id,
    string? Tipo,
    long? Valor,
    string? Data,
    string? CategoriaId,
    string? Descricao,
    string? ContaId,
    string? UpdatedAt,
    string? DeletedAt);
