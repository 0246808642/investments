using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Domain.Tests;

// Construtores de cenario. Ids fixos para que a comparacao de assinatura no
// desempate seja reproduzivel entre execucoes.
internal static class Cenario
{
    public static readonly UsuarioId Usuario = UsuarioId.De(new Guid("11111111-1111-4111-8111-111111111111"));

    public static readonly UsuarioId OutroUsuario = UsuarioId.De(new Guid("99999999-9999-4999-8999-999999999999"));

    public static readonly CategoriaId Categoria = CategoriaId.De(new Guid("22222222-2222-4222-8222-222222222222"));

    public static readonly CategoriaId OutraCategoria = CategoriaId.De(new Guid("33333333-3333-4333-8333-333333333333"));

    public static readonly ContaId Conta = ContaId.De(new Guid("44444444-4444-4444-8444-444444444444"));

    public static readonly TransacaoId IdTransacao = TransacaoId.De(new Guid("55555555-5555-4555-8555-555555555555"));

    public static DateTimeOffset Em(string iso) => Instante.Analisar(iso);

    public static DadosTransacao Dados(
        TipoMovimento tipo = TipoMovimento.Saida,
        long valor = 1000,
        string data = "2026-09-14",
        string descricao = "Mercado",
        CategoriaId? categoria = null,
        ContaId? conta = null)
        => new(
            tipo,
            Centavos.De(valor),
            DataMovimento.Analisar(data),
            categoria ?? Categoria,
            descricao,
            conta);

    public static Transacao NovaTransacao(
        string atualizadoEm = "2026-09-14T12:00:00.000Z",
        DadosTransacao? dados = null,
        TransacaoId? id = null)
        => Transacao.Criar(id ?? IdTransacao, Usuario, dados ?? Dados(), Em(atualizadoEm));
}
