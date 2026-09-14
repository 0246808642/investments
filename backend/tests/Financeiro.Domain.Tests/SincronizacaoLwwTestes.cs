using Financeiro.Domain.Comum;
using Financeiro.Domain.Sincronizacao;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Domain.Tests;

// O coracao do sistema. Aqui um erro nao aparece como excecao: aparece como um
// lancamento que some do celular do usuario tres dias depois.
public class SincronizacaoLwwTestes
{
    private const string Base = "2026-09-14T12:00:00.000Z";
    private const string Depois = "2026-09-14T12:00:01.000Z";
    private const string Antes = "2026-09-14T11:59:59.000Z";

    [Fact]
    public void VersaoRemotaMaisNovaVence()
    {
        var local = Cenario.NovaTransacao(Base);

        var resultado = local.AplicarAtualizacaoRemota(
            Cenario.Dados(valor: 7777, descricao: "Do outro aparelho"),
            Cenario.Em(Depois),
            null);

        Assert.Equal(ResultadoSincronizacao.Aplicada, resultado);
        Assert.Equal(7777L, local.Valor.Valor);
        Assert.Equal("Do outro aparelho", local.Descricao);
        Assert.Equal(Depois, Instante.ParaTexto(local.AtualizadoEm));
    }

    // Descarte e SILENCIOSO: valor de retorno, nunca excecao. Dois aparelhos
    // offline editando a mesma linha e o caso normal, nao a falha.
    [Fact]
    public void VersaoRemotaMaisVelhaEhDescartadaSemAlterarNada()
    {
        var local = Cenario.NovaTransacao(Base);

        var resultado = local.AplicarAtualizacaoRemota(
            Cenario.Dados(valor: 7777, descricao: "Versao velha"),
            Cenario.Em(Antes),
            null);

        Assert.Equal(ResultadoSincronizacao.DescartadaPorSerMaisAntiga, resultado);
        Assert.Equal(1000L, local.Valor.Valor);
        Assert.Equal("Mercado", local.Descricao);
        Assert.Equal(Base, Instante.ParaTexto(local.AtualizadoEm));
    }

    // "Ja existe" e caso normal: o mesmo delta chegando de novo (reenvio, dois
    // aparelhos com a mesma copia) e no-op, nao violacao.
    [Fact]
    public void MesmoDeltaDeNovoEhNoOpIdempotente()
    {
        var local = Cenario.NovaTransacao(Base);

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(), Cenario.Em(Base), null);

        Assert.Equal(ResultadoSincronizacao.DescartadaPorSerIdentica, resultado);
        Assert.Equal(Base, Instante.ParaTexto(local.AtualizadoEm));
    }

    // DESEMPATE, regra 1: exclusao vence atualizacao no empate exato de carimbo.
    // No cliente nao existe desfazer exclusao; aceitar a atualizacao ressuscitaria a
    // linha em um aparelho e nao no outro, e os dois ficariam divergentes para sempre.
    [Fact]
    public void NoEmpateExclusaoRemotaVenceAtualizacaoLocal()
    {
        var local = Cenario.NovaTransacao(Base);

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(), Cenario.Em(Base), Cenario.Em(Base));

        Assert.Equal(ResultadoSincronizacao.Aplicada, resultado);
        Assert.True(local.EstaExcluida);
    }

    // DESEMPATE, regra 1 pelo outro lado: local excluida, remota viva, mesmo
    // carimbo -> a exclusao local se mantem.
    [Fact]
    public void NoEmpateExclusaoLocalVenceAtualizacaoRemota()
    {
        var local = Cenario.NovaTransacao(Antes);
        local.MarcarExcluida(Cenario.Em(Base));

        var resultado = local.AplicarAtualizacaoRemota(
            Cenario.Dados(valor: 4242),
            Cenario.Em(Base),
            null);

        Assert.Equal(ResultadoSincronizacao.DescartadaPorDesempate, resultado);
        Assert.True(local.EstaExcluida);
        Assert.Equal(1000L, local.Valor.Valor);
    }

    // DESEMPATE, regra 2: empate de carimbo e as duas vivas -> vence a maior chave
    // ordinal do conteudo. Nao e "maior valor": e uma ordem total qualquer, e o que
    // importa e ela ser a mesma em qualquer servidor e em qualquer ordem de chegada.
    [Fact]
    public void NoEmpateVenceAMaiorChaveOrdinalDoConteudo()
    {
        var local = Cenario.NovaTransacao(Base, Cenario.Dados(valor: 1000));

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(valor: 2000), Cenario.Em(Base), null);

        Assert.Equal(ResultadoSincronizacao.Aplicada, resultado);
        Assert.Equal(2000L, local.Valor.Valor);
    }

    [Fact]
    public void NoEmpateAMenorChaveOrdinalEhDescartada()
    {
        var local = Cenario.NovaTransacao(Base, Cenario.Dados(valor: 2000));

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(valor: 1000), Cenario.Em(Base), null);

        Assert.Equal(ResultadoSincronizacao.DescartadaPorDesempate, resultado);
        Assert.Equal(2000L, local.Valor.Valor);
    }

    // A propriedade que a regra de desempate existe para garantir: dois servidores
    // (ou o mesmo servidor em dois reprocessamentos) que recebem os mesmos deltas em
    // ordens diferentes terminam no MESMO estado.
    [Fact]
    public void ConvergeIndependenteDaOrdemDeChegada()
    {
        var deltaA = Cenario.Dados(valor: 1000, descricao: "Aparelho A");
        var deltaB = Cenario.Dados(valor: 2000, descricao: "Aparelho B");

        var servidorUm = Cenario.NovaTransacao(Antes);
        servidorUm.AplicarAtualizacaoRemota(deltaA, Cenario.Em(Base), null);
        servidorUm.AplicarAtualizacaoRemota(deltaB, Cenario.Em(Base), null);

        var servidorDois = Cenario.NovaTransacao(Antes);
        servidorDois.AplicarAtualizacaoRemota(deltaB, Cenario.Em(Base), null);
        servidorDois.AplicarAtualizacaoRemota(deltaA, Cenario.Em(Base), null);

        Assert.Equal(servidorUm.Valor.Valor, servidorDois.Valor.Valor);
        Assert.Equal(servidorUm.Descricao, servidorDois.Descricao);
        Assert.Equal(servidorUm.AtualizadoEm, servidorDois.AtualizadoEm);
        Assert.Equal(servidorUm.EstaExcluida, servidorDois.EstaExcluida);
    }

    // Mesma propriedade com exclusao no meio, que e o par mais perigoso.
    [Fact]
    public void ConvergeComExclusaoEAtualizacaoNoMesmoCarimbo()
    {
        var atualizacao = Cenario.Dados(valor: 5000, descricao: "Editado");

        var servidorUm = Cenario.NovaTransacao(Antes);
        servidorUm.AplicarAtualizacaoRemota(atualizacao, Cenario.Em(Base), null);
        servidorUm.AplicarAtualizacaoRemota(Cenario.Dados(), Cenario.Em(Base), Cenario.Em(Base));

        var servidorDois = Cenario.NovaTransacao(Antes);
        servidorDois.AplicarAtualizacaoRemota(Cenario.Dados(), Cenario.Em(Base), Cenario.Em(Base));
        servidorDois.AplicarAtualizacaoRemota(atualizacao, Cenario.Em(Base), null);

        Assert.True(servidorUm.EstaExcluida);
        Assert.True(servidorDois.EstaExcluida);
        Assert.Equal(servidorUm.Valor.Valor, servidorDois.Valor.Valor);
        Assert.Equal(servidorUm.ExcluidoEm, servidorDois.ExcluidoEm);
    }

    // Exclusao remota mais nova vence atualizacao local mais velha: e assim que a
    // exclusao feita no celular chega ao registro que o desktop tinha editado antes.
    [Fact]
    public void ExclusaoRemotaMaisNovaVenceAtualizacaoLocalMaisVelha()
    {
        var local = Cenario.NovaTransacao(Base);

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(), Cenario.Em(Depois), Cenario.Em(Depois));

        Assert.Equal(ResultadoSincronizacao.Aplicada, resultado);
        Assert.True(local.EstaExcluida);
        Assert.Equal(Depois, Instante.ParaTexto(local.ExcluidoEm.GetValueOrDefault()));
    }

    [Fact]
    public void ExclusaoRemotaMaisVelhaNaoDerrubaAtualizacaoLocalMaisNova()
    {
        var local = Cenario.NovaTransacao(Base);

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(), Cenario.Em(Antes), Cenario.Em(Antes));

        Assert.Equal(ResultadoSincronizacao.DescartadaPorSerMaisAntiga, resultado);
        Assert.False(local.EstaExcluida);
    }

    // O inverso, e o caso que mais surpreende: uma atualizacao remota mais NOVA que
    // a exclusao local ressuscita a linha. E o comportamento correto de LWW — o
    // outro aparelho editou depois, sem saber da exclusao. Manter apagado faria os
    // dois divergirem para sempre, cada um com um estado final diferente.
    [Fact]
    public void AtualizacaoRemotaMaisNovaRessuscitaLinhaExcluida()
    {
        var local = Cenario.NovaTransacao(Antes);
        local.MarcarExcluida(Cenario.Em(Base));

        var resultado = local.AplicarAtualizacaoRemota(
            Cenario.Dados(valor: 8888, descricao: "Editado depois"),
            Cenario.Em(Depois),
            null);

        Assert.Equal(ResultadoSincronizacao.Aplicada, resultado);
        Assert.False(local.EstaExcluida);
        Assert.Null(local.ExcluidoEm);
        Assert.Equal(8888L, local.Valor.Valor);
    }

    [Fact]
    public void AtualizacaoRemotaMaisVelhaNaoRessuscita()
    {
        var local = Cenario.NovaTransacao(Antes);
        local.MarcarExcluida(Cenario.Em(Base));

        var resultado = local.AplicarAtualizacaoRemota(
            Cenario.Dados(valor: 8888),
            Cenario.Em(Antes),
            null);

        Assert.Equal(ResultadoSincronizacao.DescartadaPorSerMaisAntiga, resultado);
        Assert.True(local.EstaExcluida);
    }

    // Diferenca abaixo do milissegundo e empate, porque e o que sobra depois de
    // passar pelo Postgres e pelo Date do JavaScript. Se nao fosse, a mesma
    // comparacao daria resultados diferentes antes e depois de gravar.
    [Fact]
    public void DiferencaAbaixoDoMilissegundoContaComoEmpate()
    {
        var local = Cenario.NovaTransacao(Base);
        var quaseIgual = Cenario.Em(Base).AddTicks(9_000);

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(), quaseIgual, null);

        Assert.Equal(ResultadoSincronizacao.DescartadaPorSerIdentica, resultado);
    }

    // Versao vencedora e adotada na integra, inclusive o carimbo de exclusao.
    [Fact]
    public void VersaoVencedoraEhAdotadaNaIntegra()
    {
        var local = Cenario.NovaTransacao(Base);

        local.AplicarAtualizacaoRemota(
            new DadosTransacao(
                TipoMovimento.Entrada,
                Centavos.De(31337),
                DataMovimento.Analisar("2026-10-02"),
                Cenario.OutraCategoria,
                "Reembolso",
                Cenario.Conta),
            Cenario.Em(Depois),
            null);

        Assert.Equal(TipoMovimento.Entrada, local.Tipo);
        Assert.Equal(31337L, local.Valor.Valor);
        Assert.Equal("2026-10-02", local.Data.ToString());
        Assert.Equal(Cenario.OutraCategoria, local.CategoriaId);
        Assert.Equal("Reembolso", local.Descricao);
        Assert.Equal(Cenario.Conta, local.ContaId);
    }

    // Fuso diferente nao muda quem vence: a comparacao acontece em UTC.
    [Fact]
    public void CarimboEmOutroFusoEhComparadoEmUtc()
    {
        var local = Cenario.NovaTransacao(Base);
        var mesmoInstanteOutroFuso = new DateTimeOffset(2026, 9, 14, 9, 0, 0, TimeSpan.FromHours(-3));

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(), mesmoInstanteOutroFuso, null);

        Assert.Equal(ResultadoSincronizacao.DescartadaPorSerIdentica, resultado);
    }

    // Quem chega depois com conteudo identico so avanca o carimbo — nao muda dado,
    // e nao volta como "descartada" indevidamente.
    [Fact]
    public void ConteudoIdenticoComCarimboMaisNovoAvancaOCarimbo()
    {
        var local = Cenario.NovaTransacao(Base);

        var resultado = local.AplicarAtualizacaoRemota(Cenario.Dados(), Cenario.Em(Depois), null);

        Assert.Equal(ResultadoSincronizacao.Aplicada, resultado);
        Assert.Equal(Depois, Instante.ParaTexto(local.AtualizadoEm));
    }
}
