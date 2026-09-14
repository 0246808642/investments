using Financeiro.Application.Transacoes;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Application.Tests;

// A borda entre o JSON e o dominio. O que passa daqui ja esta em tipos de
// dominio; nenhuma string de fora circula dentro da aplicacao.
public class MapeadorTransacaoTestes
{
    [Fact]
    public void ValidaDeltaCompletoDoCliente()
    {
        const string conta = "44444444-4444-4444-8444-444444444444";

        Assert.True(MapeadorTransacao.TentarValidar(
            Cenario.Entrada(tipo: "entrada", valor: 250075, contaId: conta),
            out var validada,
            out var motivo));

        Assert.Null(motivo);
        Assert.Equal(TipoMovimento.Entrada, validada.Dados.Tipo);
        Assert.Equal(250075L, validada.Dados.Valor.Valor);
        Assert.Equal("2026-09-14", validada.Dados.Data.ToString());
        Assert.Equal(conta, validada.Dados.ContaId?.ToString());
        Assert.Null(validada.ExcluidoEm);
    }

    [Fact]
    public void ItemNuloVoltaComMotivo()
    {
        Assert.False(MapeadorTransacao.TentarValidar(null, out var validada, out var motivo));
        Assert.Null(validada);
        Assert.NotNull(motivo);
    }

    [Fact]
    public void DescricaoAusenteViraTextoVazio()
    {
        Assert.True(MapeadorTransacao.TentarValidar(Cenario.Entrada(descricao: null), out var validada, out _));
        Assert.Equal(string.Empty, validada.Dados.Descricao);
    }

    [Fact]
    public void ValorAusenteEhRecusado()
    {
        Assert.False(MapeadorTransacao.TentarValidar(Cenario.Entrada(valor: null), out _, out var motivo));
        Assert.NotNull(motivo);
    }

    // Acima do inteiro seguro do JavaScript o valor voltaria arredondado para o
    // cliente — melhor recusar na borda do que devolver dinheiro errado.
    [Theory]
    [InlineData(Centavos.LimiteSeguro + 1)]
    [InlineData(long.MinValue)]
    public void ValorForaDoIntervaloSeguroEhRecusado(long valor)
    {
        Assert.False(MapeadorTransacao.TentarValidar(Cenario.Entrada(valor: valor), out _, out var motivo));
        Assert.NotNull(motivo);
    }

    // A borda NAO checa invariante de negocio: valor zero passa daqui e e a
    // agregada que rejeita. Duplicar a regra nos dois lugares e como as duas
    // versoes acabam divergindo.
    [Fact]
    public void BordaNaoDuplicaInvarianteDeNegocio()
    {
        Assert.True(MapeadorTransacao.TentarValidar(Cenario.Entrada(valor: 0), out var validada, out _));
        Assert.Equal(0L, validada.Dados.Valor.Valor);
    }

    [Fact]
    public void ContaIdNuloEhLancamentoAvulso()
    {
        Assert.True(MapeadorTransacao.TentarValidar(Cenario.Entrada(contaId: null), out var validada, out _));
        Assert.Null(validada.Dados.ContaId);
    }

    [Fact]
    public void DeletedAtInvalidoEhRecusado()
    {
        Assert.False(MapeadorTransacao.TentarValidar(
            Cenario.Entrada(deletedAt: "ontem"),
            out _,
            out var motivo));

        Assert.NotNull(motivo);
    }

    [Fact]
    public void DeletedAtEmOutroFusoViraUtc()
    {
        Assert.True(MapeadorTransacao.TentarValidar(
            Cenario.Entrada(deletedAt: "2026-09-14T09:00:00.000-03:00"),
            out var validada,
            out _));

        Assert.Equal("2026-09-14T12:00:00.000Z", Instante.ParaTexto(validada.ExcluidoEm.GetValueOrDefault()));
    }

    [Fact]
    public void SaidaUsaOsNomesEOsTiposDoContratoDeFio()
    {
        var transacao = Cenario.Transacao(
            valor: 123456,
            data: "2026-09-14",
            descricao: "Mercado",
            atualizadoEm: "2026-09-14T12:00:00.000Z");

        var dto = MapeadorTransacao.ParaDto(transacao);

        Assert.Equal(Cenario.IdA, dto.Id);
        Assert.Equal("saida", dto.Tipo);
        Assert.Equal(123456L, dto.Valor);
        Assert.Equal("2026-09-14", dto.Data);
        Assert.Equal("2026-09-14T12:00:00.000Z", dto.UpdatedAt);
        Assert.Null(dto.DeletedAt);
    }

    [Fact]
    public void IdaEVoltaPeloMapeadorNaoPerdeNada()
    {
        Assert.True(MapeadorTransacao.TentarValidar(
            Cenario.Entrada(tipo: "entrada", valor: 999, descricao: "Cafe"),
            out var validada,
            out _));

        var transacao = Transacao.Reconstituir(
            validada.Id,
            Cenario.Usuario,
            validada.Dados,
            validada.AtualizadoEm,
            validada.ExcluidoEm);

        var dto = MapeadorTransacao.ParaDto(transacao);

        Assert.Equal(Cenario.IdA, dto.Id);
        Assert.Equal("entrada", dto.Tipo);
        Assert.Equal(999L, dto.Valor);
        Assert.Equal("Cafe", dto.Descricao);
        Assert.Equal("2026-09-14T12:00:00.000Z", dto.UpdatedAt);
    }
}
