using System.Globalization;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Api.Tests;

internal static class Cenario
{
    public const string Categoria = "22222222-2222-4222-8222-222222222222";

    public const string IdA = "aaaaaaaa-1111-4111-8111-111111111111";

    public const string IdB = "bbbbbbbb-2222-4222-8222-222222222222";

    public const string IdC = "cccccccc-3333-4333-8333-333333333333";

    public const string EmailDeAna = "ana@exemplo.com";

    public const string EmailDeBruno = "bruno@exemplo.com";

    public const string Senha = "senha-forte-123";

    public const string RotaSincronizacao = "/api/sincronizacao";

    public const string RotaTransacoes = "/api/transacoes";

    public static Uri Rota(string caminho) => new(caminho, UriKind.Relative);

    public static Uri RotaListar(string inicio, string fim)
        => Rota(RotaTransacoes + "?inicio=" + inicio + "&fim=" + fim);

    public static Transacao Transacao(
        UsuarioId usuario,
        string id = IdA,
        long valor = 1000,
        string data = "2026-09-14",
        string descricao = "Mercado",
        string atualizadoEm = "2026-09-14T12:00:00.000Z",
        string? excluidoEm = null)
        => Domain.Transacoes.Transacao.Reconstituir(
            TransacaoId.Analisar(id),
            usuario,
            new DadosTransacao(
                TipoMovimento.Saida,
                Centavos.De(valor),
                DataMovimento.Analisar(data),
                CategoriaId.Analisar(Categoria),
                descricao,
                null),
            Instante.Analisar(atualizadoEm),
            excluidoEm is null ? null : Instante.Analisar(excluidoEm));

    // Delta como o cliente TypeScript manda: camelCase, valor inteiro em centavos,
    // data 'YYYY-MM-DD', carimbos ISO-8601 com Z.
    public static string EntradaJson(
        string id = IdA,
        string tipo = "saida",
        string valor = "1000",
        string data = "2026-09-14",
        string descricao = "Mercado",
        string updatedAt = "2026-09-14T12:00:00.000Z")
        => string.Create(
            CultureInfo.InvariantCulture,
            $$"""
            {"id":"{{id}}","tipo":"{{tipo}}","valor":{{valor}},"data":"{{data}}","categoriaId":"{{Categoria}}","descricao":"{{descricao}}","contaId":null,"updatedAt":"{{updatedAt}}","deletedAt":null}
            """);

    public static string LoteJson(params string[] entradas)
    {
        ArgumentNullException.ThrowIfNull(entradas);

        return "{\"transacoes\":[" + string.Join(',', entradas) + "],\"desde\":null,\"ultimoId\":null,\"limite\":500}";
    }
}
