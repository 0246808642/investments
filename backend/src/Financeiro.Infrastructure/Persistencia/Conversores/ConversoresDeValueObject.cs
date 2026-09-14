using Financeiro.Domain.Comum;
using Financeiro.Domain.Transacoes;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Financeiro.Infrastructure.Persistencia.Conversores;

// Conversores dos value objects do dominio para os tipos nativos do Postgres.
//
// A direcao de leitura usa sempre a fabrica validadora do dominio (De/Analisar),
// nao o construtor cru: linha corrompida no banco vira ErroDeDominioException na
// materializacao, em vez de virar uma agregada em estado impossivel circulando
// pelo sistema.
internal static class ConversoresDeValueObject
{
    // uuid. O id nasce no cliente; o servidor so valida o formato.
    public static readonly ValueConverter<TransacaoId, Guid> Transacao =
        new(id => id.Valor, valor => TransacaoId.De(valor));

    public static readonly ValueConverter<UsuarioId, Guid> Usuario =
        new(id => id.Valor, valor => UsuarioId.De(valor));

    public static readonly ValueConverter<CategoriaId, Guid> Categoria =
        new(id => id.Valor, valor => CategoriaId.De(valor));

    public static readonly ValueConverter<ContaId, Guid> Conta =
        new(id => id.Valor, valor => ContaId.De(valor));

    // bigint, NUNCA numeric/decimal. Centavos ja e inteiro no dominio e no fio; um
    // tipo de ponto flutuante aqui reintroduziria o arredondamento que o branded
    // type existe para impedir.
    public static readonly ValueConverter<Centavos, long> Valor =
        new(valor => valor.Valor, bruto => Centavos.De(bruto));

    // date. Ver a justificativa da escolha em ConfiguracaoTransacao.
    public static readonly ValueConverter<DataMovimento, DateOnly> Data =
        new(data => data.Valor, bruto => DataMovimento.De(bruto));

    // varchar(10) com o texto do fio ('entrada' | 'saida'). Guardar o texto
    // canonico em vez do inteiro do enum mantem o banco legivel e amarra a coluna
    // ao mesmo contrato que o cliente usa; renumerar o enum um dia nao reinterpreta
    // silenciosamente as linhas ja gravadas.
    public static readonly ValueConverter<TipoMovimento, string> Tipo =
        new(tipo => tipo.ParaTexto(), texto => TipoMovimentoExtensoes.Analisar(texto));
}
