using System.Globalization;
using Financeiro.Domain.Comum;
using Financeiro.Domain.Sincronizacao;

namespace Financeiro.Domain.Transacoes;

// Lancamento ja realizado. E a unica coisa que entra no saldo do mes.
//
// O id vem de fora, gerado pelo cliente offline. O servidor nunca cria
// identidade: ele recebe versoes de uma linha que ja existe em algum aparelho.
public sealed class Transacao : EntidadeSincronizavel<TransacaoId>
{
    // Limite de descricao. Vira varchar(200) na Infrastructure; sem teto, um
    // cliente com defeito escreve megabytes numa coluna que a UI mostra em uma
    // linha. 200 cabe folgado qualquer descricao de lancamento real.
    public const int TamanhoMaximoDescricao = 200;

    private Transacao(
        TransacaoId id,
        UsuarioId usuarioId,
        DadosTransacao dados,
        DateTimeOffset atualizadoEm,
        DateTimeOffset? excluidoEm)
        : base(ValidarId(id), usuarioId, atualizadoEm, excluidoEm)
    {
        var validados = Validar(dados);
        Tipo = validados.Tipo;
        Valor = validados.Valor;
        Data = validados.Data;
        CategoriaId = validados.CategoriaId;
        Descricao = validados.Descricao;
        ContaId = validados.ContaId;
    }

    // Construtor sem argumentos para materializacao por ORM.
    private Transacao()
    {
        Descricao = string.Empty;
    }

    public TipoMovimento Tipo { get; private set; }

    // Sempre positivo. O sinal vem de Tipo.
    public Centavos Valor { get; private set; }

    public DataMovimento Data { get; private set; }

    public CategoriaId CategoriaId { get; private set; }

    public string Descricao { get; private set; }

    // Preenchido quando o lancamento nasceu de uma conta recorrente; nulo se avulso.
    public ContaId? ContaId { get; private set; }

    // Efeito no saldo, com o sinal ja aplicado. Transacao excluida nao movimenta.
    public Centavos EfeitoNoSaldo => EstaExcluida ? Centavos.Zero : Tipo.AplicarSinal(Valor);

    protected override string Assinatura => MontarAssinatura(ParaDados());

    // Snapshot do conteudo, para mapear para DTO e para comparar versoes.
    public DadosTransacao ParaDados() => new(Tipo, Valor, Data, CategoriaId, Descricao, ContaId);

    // Primeira versao de uma linha que chega ao servidor, ainda ativa.
    public static Transacao Criar(
        TransacaoId id,
        UsuarioId usuarioId,
        DadosTransacao dados,
        DateTimeOffset atualizadoEm)
        => new(id, usuarioId, dados, atualizadoEm, excluidoEm: null);

    // Reconstroi uma linha a partir de um snapshot completo — do banco, ou de um
    // delta remoto de uma linha que o servidor ainda nao conhece e que ja chega
    // excluida (o aparelho criou e apagou offline, antes de qualquer sincronizacao).
    public static Transacao Reconstituir(
        TransacaoId id,
        UsuarioId usuarioId,
        DadosTransacao dados,
        DateTimeOffset atualizadoEm,
        DateTimeOffset? excluidoEm)
        => new(id, usuarioId, dados, atualizadoEm, excluidoEm);

    // Versao vinda de outro aparelho. Decide por last-write-wins e, vencendo,
    // adota o snapshot remoto na integra — inclusive limpando ExcluidoEm quando a
    // versao vencedora esta ativa. Uma atualizacao remota mais nova que uma
    // exclusao local realmente ressuscita a linha: e o comportamento convergente de
    // LWW, e o inverso (manter apagado) faria os dois aparelhos divergirem para
    // sempre, cada um com um estado final diferente.
    //
    // A validacao de conteudo acontece antes da decisao: delta remoto malformado e
    // erro de dominio (o caso de uso reporta o item como rejeitado), enquanto delta
    // remoto velho e descarte silencioso.
    public ResultadoSincronizacao AplicarAtualizacaoRemota(
        DadosTransacao dados,
        DateTimeOffset atualizadoEm,
        DateTimeOffset? excluidoEm)
    {
        var validados = Validar(dados);
        var resultado = DecidirAplicacaoRemota(atualizadoEm, excluidoEm, MontarAssinatura(validados));

        if (resultado == ResultadoSincronizacao.Aplicada)
        {
            AplicarDados(validados);
            DefinirCarimbos(atualizadoEm, excluidoEm);
        }

        return resultado;
    }

    // Escrita nascida no servidor (edicao via API, nao via lote de sync).
    public ResultadoSincronizacao Atualizar(DadosTransacao dados, DateTimeOffset instante)
    {
        if (EstaExcluida)
        {
            throw new ErroDeDominioException("Transacao excluida nao pode ser editada; a exclusao e terminal no cliente");
        }

        var validados = Validar(dados);
        GarantirCarimboMonotonico(instante);

        if (string.Equals(MontarAssinatura(validados), Assinatura, StringComparison.Ordinal))
        {
            // Nada mudou. Nao mexer no carimbo evita gerar trafego de sync para
            // todos os aparelhos por causa de um salvar sem alteracao.
            return ResultadoSincronizacao.DescartadaPorSerIdentica;
        }

        AplicarDados(validados);
        DefinirCarimbos(instante, excluidoEm: null);
        return ResultadoSincronizacao.Aplicada;
    }

    // Exclusao logica. Preenche ExcluidoEm e AtualizadoEm com o mesmo instante:
    // apagar e uma escrita, e precisa disputar o last-write-wins como qualquer
    // outra. Idempotente — apagar duas vezes nao remarca o carimbo, senao um
    // reenvio faria a exclusao vencer edicoes que na verdade sao posteriores.
    public ResultadoSincronizacao MarcarExcluida(DateTimeOffset instante)
    {
        if (EstaExcluida)
        {
            return ResultadoSincronizacao.DescartadaPorSerIdentica;
        }

        GarantirCarimboMonotonico(instante);
        DefinirCarimbos(instante, instante);
        return ResultadoSincronizacao.Aplicada;
    }

    private static TransacaoId ValidarId(TransacaoId id)
        => id.EhVazio
            ? throw new ErroDeDominioException("TransacaoId e obrigatorio e nao pode ser vazio")
            : id;

    // Toda invariante de conteudo da agregada, num lugar so. Roda em toda escrita,
    // venha do cliente ou do lote de sincronizacao.
    private static DadosTransacao Validar(DadosTransacao dados)
    {
        ArgumentNullException.ThrowIfNull(dados);

        if (!Enum.IsDefined(dados.Tipo))
        {
            throw new ErroDeDominioException("Tipo de movimento invalido");
        }

        // Valor estritamente positivo: o sinal vem do tipo. Permitir negativo
        // tornaria o mesmo lancamento representavel de duas formas (saida de -500 e
        // entrada de 500) e o saldo dependeria de qual delas o aparelho gravou.
        // Zero tambem nao passa: nao movimenta saldo e so polui o extrato.
        if (!dados.Valor.EhPositivo)
        {
            throw new ErroDeDominioException(
                "Valor precisa ser positivo; o sinal do lancamento vem do tipo. Recebido " + dados.Valor.ToString());
        }

        // Data precisa ser uma data real de 4 digitos de ano; barra tambem o
        // default(DataMovimento), que entraria como 0001-01-01.
        if (!dados.Data.EhValida)
        {
            throw new ErroDeDominioException("Data do lancamento invalida: " + dados.Data.ToString());
        }

        // Categoria obrigatoria: todo lancamento entra em exatamente um grupo de
        // relatorio. Sem ela, o resumo por categoria perderia linhas em silencio.
        if (dados.CategoriaId.EhVazio)
        {
            throw new ErroDeDominioException("CategoriaId e obrigatorio");
        }

        // ContaId e opcional (lancamento avulso), mas se vier precisa ser um id de
        // verdade — nulo e "nao tem conta", Guid vazio e dado corrompido.
        if (dados.ContaId is { } conta && conta.EhVazio)
        {
            throw new ErroDeDominioException("ContaId, quando informado, nao pode ser vazio");
        }

        ArgumentNullException.ThrowIfNull(dados.Descricao);

        // Descricao vazia e permitida de proposito: o cliente nao obriga o campo, e
        // inventar aqui uma obrigatoriedade que a UI nao tem faria o lote de
        // sincronizacao rejeitar linhas que o usuario ja ve na tela dele.
        var descricao = dados.Descricao.Trim();
        if (descricao.Length > TamanhoMaximoDescricao)
        {
            throw new ErroDeDominioException(
                "Descricao passa de "
                + TamanhoMaximoDescricao.ToString(CultureInfo.InvariantCulture)
                + " caracteres: "
                + descricao.Length.ToString(CultureInfo.InvariantCulture));
        }

        return dados with { Descricao = descricao };
    }

    private static string MontarAssinatura(DadosTransacao dados) => string.Join(
        '|',
        dados.Tipo.ParaTexto(),
        dados.Valor.Valor.ToString(CultureInfo.InvariantCulture),
        dados.Data.ToString(),
        dados.CategoriaId.ToString(),
        dados.ContaId is null ? string.Empty : dados.ContaId.Value.ToString(),
        dados.Descricao);

    private void AplicarDados(DadosTransacao dados)
    {
        Tipo = dados.Tipo;
        Valor = dados.Valor;
        Data = dados.Data;
        CategoriaId = dados.CategoriaId;
        Descricao = dados.Descricao;
        ContaId = dados.ContaId;
    }
}
