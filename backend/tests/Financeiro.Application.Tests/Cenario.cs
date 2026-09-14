using Financeiro.Application.Transacoes.Dtos;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Application.Tests;

internal static class Cenario
{
    public static readonly UsuarioId Usuario = UsuarioId.De(new Guid("11111111-1111-4111-8111-111111111111"));

    public static readonly UsuarioId OutroUsuario = UsuarioId.De(new Guid("99999999-9999-4999-8999-999999999999"));

    public const string Categoria = "22222222-2222-4222-8222-222222222222";

    public const string IdA = "aaaaaaaa-1111-4111-8111-111111111111";

    public const string IdB = "bbbbbbbb-2222-4222-8222-222222222222";

    public const string IdC = "cccccccc-3333-4333-8333-333333333333";

    public static DateTimeOffset Em(string iso) => Instante.Analisar(iso);

    // Delta como o cliente manda: valor inteiro em centavos, data 'YYYY-MM-DD',
    // carimbos ISO-8601 com Z.
    public static TransacaoEntradaDto Entrada(
        string id = IdA,
        string? tipo = "saida",
        long? valor = 1000,
        string? data = "2026-09-14",
        string? categoriaId = Categoria,
        string? descricao = "Mercado",
        string? contaId = null,
        string? updatedAt = "2026-09-14T12:00:00.000Z",
        string? deletedAt = null)
        => new(id, tipo, valor, data, categoriaId, descricao, contaId, updatedAt, deletedAt);

    public static Transacao Transacao(
        string id = IdA,
        long valor = 1000,
        string data = "2026-09-14",
        string descricao = "Mercado",
        string atualizadoEm = "2026-09-14T12:00:00.000Z",
        string? excluidoEm = null,
        UsuarioId? usuario = null)
        => Domain.Transacoes.Transacao.Reconstituir(
            TransacaoId.Analisar(id),
            usuario ?? Usuario,
            new DadosTransacao(
                TipoMovimento.Saida,
                Centavos.De(valor),
                DataMovimento.Analisar(data),
                CategoriaId.Analisar(Categoria),
                descricao,
                null),
            Em(atualizadoEm),
            excluidoEm is null ? null : Em(excluidoEm));

    public static RequisicaoSincronizacaoDto Requisicao(
        IReadOnlyList<TransacaoEntradaDto>? transacoes = null,
        string? desde = null,
        string? ultimoId = null,
        int? limite = null)
        => new(transacoes, desde, ultimoId, limite);
}
