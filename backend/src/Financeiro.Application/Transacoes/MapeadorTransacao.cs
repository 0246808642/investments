using System.Diagnostics.CodeAnalysis;
using Financeiro.Application.Transacoes.Dtos;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Application.Transacoes;

// Um delta ja convertido para tipos de dominio. Passar isto adiante, em vez do
// DTO cru, garante que nenhuma string de fora circule dentro da aplicacao.
public sealed record TransacaoValidada(
    TransacaoId Id,
    DadosTransacao Dados,
    DateTimeOffset AtualizadoEm,
    DateTimeOffset? ExcluidoEm);

// Borda entre o JSON e o dominio. Cuida SO de formato: id que nao e UUID, data
// que nao e 'YYYY-MM-DD', tipo desconhecido, timestamp sem fuso.
//
// As invariantes de negocio (valor positivo, tamanho da descricao) NAO sao
// checadas aqui de proposito: quem decide isso e a agregada, e duplicar a regra
// nos dois lugares e como as duas versoes acabam divergindo. O caso de uso captura
// ErroDeDominioException da agregada e reporta o item como rejeitado.
public static class MapeadorTransacao
{
    public static TransacaoDto ParaDto(Transacao transacao)
    {
        ArgumentNullException.ThrowIfNull(transacao);

        return new TransacaoDto(
            Id: transacao.Id.ToString(),
            Tipo: transacao.Tipo.ParaTexto(),
            Valor: transacao.Valor.Valor,
            Data: transacao.Data.ToString(),
            CategoriaId: transacao.CategoriaId.ToString(),
            Descricao: transacao.Descricao,
            ContaId: transacao.ContaId?.ToString(),
            UpdatedAt: Instante.ParaTexto(transacao.AtualizadoEm),
            DeletedAt: transacao.ExcluidoEm is null ? null : Instante.ParaTexto(transacao.ExcluidoEm.Value));
    }

    public static IReadOnlyList<TransacaoDto> ParaDtos(IEnumerable<Transacao> transacoes)
    {
        ArgumentNullException.ThrowIfNull(transacoes);

        var dtos = new List<TransacaoDto>();
        foreach (var transacao in transacoes)
        {
            dtos.Add(ParaDto(transacao));
        }

        return dtos;
    }

    public static bool TentarValidar(
        TransacaoEntradaDto? entrada,
        [NotNullWhen(true)] out TransacaoValidada? validada,
        [NotNullWhen(false)] out string? motivo)
    {
        validada = null;

        if (entrada is null)
        {
            motivo = "Item nulo no lote";
            return false;
        }

        if (!TransacaoId.TentarAnalisar(entrada.Id, out var id))
        {
            motivo = "id invalido, esperado UUID no formato 8-4-4-4-12";
            return false;
        }

        if (!TipoMovimentoExtensoes.TentarAnalisar(entrada.Tipo, out var tipo))
        {
            motivo = "tipo invalido, esperado \"entrada\" ou \"saida\"";
            return false;
        }

        if (entrada.Valor is not { } valorBruto)
        {
            motivo = "valor ausente; esperado inteiro em centavos";
            return false;
        }

        if (valorBruto is > Centavos.LimiteSeguro or < -Centavos.LimiteSeguro)
        {
            motivo = "valor fora do intervalo que o cliente consegue representar";
            return false;
        }

        var valor = Centavos.De(valorBruto);

        if (!DataMovimento.TentarAnalisar(entrada.Data, out var data))
        {
            motivo = "data invalida, esperado " + DataMovimento.Formato;
            return false;
        }

        if (!CategoriaId.TentarAnalisar(entrada.CategoriaId, out var categoriaId))
        {
            motivo = "categoriaId invalido ou ausente";
            return false;
        }

        ContaId? contaId = null;
        if (entrada.ContaId is not null)
        {
            if (!ContaId.TentarAnalisar(entrada.ContaId, out var conta))
            {
                motivo = "contaId invalido; use null para lancamento avulso";
                return false;
            }

            contaId = conta;
        }

        if (!Instante.TentarAnalisar(entrada.UpdatedAt, out var atualizadoEm))
        {
            motivo = "updatedAt invalido, esperado ISO-8601 com fuso (ex.: 2026-09-14T12:00:00.000Z)";
            return false;
        }

        DateTimeOffset? excluidoEm = null;
        if (entrada.DeletedAt is not null)
        {
            if (!Instante.TentarAnalisar(entrada.DeletedAt, out var excluido))
            {
                motivo = "deletedAt invalido, esperado ISO-8601 com fuso ou null";
                return false;
            }

            excluidoEm = excluido;
        }

        validada = new TransacaoValidada(
            id,
            new DadosTransacao(tipo, valor, data, categoriaId, entrada.Descricao ?? string.Empty, contaId),
            atualizadoEm,
            excluidoEm);
        motivo = null;
        return true;
    }
}
