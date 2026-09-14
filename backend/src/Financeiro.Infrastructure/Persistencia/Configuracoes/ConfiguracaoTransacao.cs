using Financeiro.Domain.Transacoes;
using Financeiro.Infrastructure.Persistencia.Conversores;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Financeiro.Infrastructure.Persistencia.Configuracoes;

// Mapeamento da agregada Transacao.
//
// NAO existe global query filter escondendo ExcluidoEm aqui, e isso e deliberado:
// o pull do sync TEM que enxergar as linhas excluidas — e so por elas que um
// aparelho que estava offline descobre o que sumiu. Um filtro global seria
// invisivel na leitura do repositorio e apagaria essas linhas do resultado sem
// deixar rastro. Quem quer esconder excluida pede explicitamente (ver
// ListarPorPeriodoAsync).
internal sealed class ConfiguracaoTransacao : IEntityTypeConfiguration<Transacao>
{
    public void Configure(EntityTypeBuilder<Transacao> construtor)
    {
        ArgumentNullException.ThrowIfNull(construtor);

        construtor.ToTable(EsquemaTransacoes.Tabela, EsquemaTransacoes.Esquema);

        // Chave primaria COMPOSTA (UsuarioId, Id), nunca Id sozinho.
        //
        // O id e gerado pelo cliente offline, entao dois usuarios podem emitir o
        // mesmo UUID. Com PK simples isso vira ou violacao de unicidade (o segundo
        // usuario perde o lancamento dele) ou, pior, linha de um usuario alcancavel
        // pela consulta do outro. Com a PK composta, o vazamento entre contas fica
        // estruturalmente impossivel: nao existe linha endereçavel sem o dono.
        //
        // O UsuarioId vem primeiro tambem por motivo de acesso: toda consulta filtra
        // por ele, entao ele e o prefixo natural do indice da PK.
        construtor.HasKey(transacao => new { transacao.UsuarioId, transacao.Id });

        construtor.Property(transacao => transacao.UsuarioId)
            .HasColumnName(EsquemaTransacoes.UsuarioId)
            .HasConversion(ConversoresDeValueObject.Usuario)
            .HasColumnType("uuid")
            .IsRequired();

        construtor.Property(transacao => transacao.Id)
            .HasColumnName(EsquemaTransacoes.Id)
            .HasConversion(ConversoresDeValueObject.Transacao)
            .HasColumnType("uuid")
            .ValueGeneratedNever()
            .IsRequired();

        construtor.Property(transacao => transacao.Tipo)
            .HasColumnName(EsquemaTransacoes.Tipo)
            .HasConversion(ConversoresDeValueObject.Tipo)
            .HasColumnType("varchar(10)")
            .IsRequired();

        // bigint. Dinheiro e inteiro em centavos; numeric/decimal aqui seria uma
        // porta de entrada para valor fracionario que o dominio recusa.
        construtor.Property(transacao => transacao.Valor)
            .HasColumnName(EsquemaTransacoes.Valor)
            .HasConversion(ConversoresDeValueObject.Valor)
            .HasColumnType("bigint")
            .IsRequired();

        // DECISAO: 'date', e nao char(10)/varchar(10).
        //
        // As duas formas guardam 'YYYY-MM-DD' sem hora e sem fuso, mas so uma
        // ordena de forma confiavel. Texto ordena por COLACAO: sob a colacao padrao
        // do banco (aqui pode ser ICU ou uma locale do SO, dependendo de como o
        // cluster foi inicializado) o hifen pode ser tratado como pontuacao
        // ignoravel, e '2026-01-02' e '2026-0102' deixam de ter a ordem que a
        // comparacao lexicografica ingenua sugere. Como ListarPorPeriodoAsync faz
        // BETWEEN e ORDER BY nessa coluna no banco, uma ordem dependente de colacao
        // significaria um extrato de periodo que muda de conteudo conforme o locale
        // do servidor.
        //
        // 'date' e livre de colacao: 4 bytes, ordem cronologica garantida pelo tipo,
        // BETWEEN exato e indice B-tree eficiente. E o mapeamento e 1:1 com o
        // DateOnly que o DataMovimento ja guarda — o Npgsql converte date<->DateOnly
        // sem passar por DateTime, entao nao ha o deslocamento de dia por UTC que o
        // proprio value object foi criado para evitar.
        //
        // Observacao: a coluna de data NAO participa do keyset do pull (que e por
        // AtualizadoEm), entao essa escolha nao interfere naquele caminho.
        construtor.Property(transacao => transacao.Data)
            .HasColumnName(EsquemaTransacoes.Data)
            .HasConversion(ConversoresDeValueObject.Data)
            .HasColumnType("date")
            .IsRequired();

        construtor.Property(transacao => transacao.CategoriaId)
            .HasColumnName(EsquemaTransacoes.CategoriaId)
            .HasConversion(ConversoresDeValueObject.Categoria)
            .HasColumnType("uuid")
            .IsRequired();

        // varchar(200). O teto sai da propria constante da agregada, entao mudar o
        // limite do dominio nao deixa a coluna para tras (nem o contrario: hoje o
        // banco recusaria fisicamente o que a agregada ja recusa).
        construtor.Property(transacao => transacao.Descricao)
            .HasColumnName(EsquemaTransacoes.Descricao)
            .HasMaxLength(Transacao.TamanhoMaximoDescricao)
            .IsRequired();

        // Nulo = lancamento avulso.
        construtor.Property(transacao => transacao.ContaId)
            .HasColumnName(EsquemaTransacoes.ContaId)
            .HasConversion(ConversoresDeValueObject.Conta)
            .HasColumnType("uuid")
            .IsRequired(false);

        // timestamptz nos dois carimbos. O dominio ja normaliza para UTC truncado em
        // milissegundo (ver Instante), entao o offset gravado e sempre zero.
        construtor.Property(transacao => transacao.AtualizadoEm)
            .HasColumnName(EsquemaTransacoes.AtualizadoEm)
            .HasColumnType("timestamptz")
            .IsRequired();

        // Exclusao logica. Nunca existe DELETE: a linha fica, com carimbo.
        construtor.Property(transacao => transacao.ExcluidoEm)
            .HasColumnName(EsquemaTransacoes.ExcluidoEm)
            .HasColumnType("timestamptz")
            .IsRequired(false);

        // Calculadas a partir do estado mapeado; nao sao colunas.
        construtor.Ignore(transacao => transacao.EstaExcluida);
        construtor.Ignore(transacao => transacao.EfeitoNoSaldo);

        // Indice do pull do sync. A ordem das colunas e exatamente a do keyset
        // (usuario, atualizado_em, id), para que a comparacao de tupla vire um
        // unico seek no indice em vez de varredura com filtro.
        construtor.HasIndex(
                transacao => new { transacao.UsuarioId, transacao.AtualizadoEm, transacao.Id })
            .HasDatabaseName(EsquemaTransacoes.IndiceSincronizacao);

        // Indice da consulta por periodo, com Id no fim porque o desempate da
        // ordenacao e por Id.
        construtor.HasIndex(
                transacao => new { transacao.UsuarioId, transacao.Data, transacao.Id })
            .HasDatabaseName(EsquemaTransacoes.IndicePeriodo);
    }
}
