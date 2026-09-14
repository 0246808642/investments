using Financeiro.Domain.Comum;
using Financeiro.Domain.Sincronizacao;
using Financeiro.Domain.Transacoes;

namespace Financeiro.Domain.Tests;

public class TransacaoInvariantesTestes
{
    [Fact]
    public void CriaComOsDadosDoCliente()
    {
        var transacao = Cenario.NovaTransacao(
            dados: Cenario.Dados(TipoMovimento.Entrada, 250075, "2026-09-14", "Salario", conta: Cenario.Conta));

        Assert.Equal(Cenario.IdTransacao, transacao.Id);
        Assert.Equal(Cenario.Usuario, transacao.UsuarioId);
        Assert.Equal(TipoMovimento.Entrada, transacao.Tipo);
        Assert.Equal(250075L, transacao.Valor.Valor);
        Assert.Equal("2026-09-14", transacao.Data.ToString());
        Assert.Equal("Salario", transacao.Descricao);
        Assert.Equal(Cenario.Conta, transacao.ContaId);
        Assert.False(transacao.EstaExcluida);
        Assert.Null(transacao.ExcluidoEm);
    }

    // INVARIANTE: valor estritamente positivo. O sinal vem do tipo; com negativo, o
    // mesmo lancamento teria duas representacoes (saida de -500 e entrada de 500) e
    // o saldo dependeria de qual delas o aparelho gravou.
    [Theory]
    [InlineData(0L)]
    [InlineData(-1L)]
    [InlineData(-250000L)]
    public void RecusaValorNaoPositivo(long valor)
    {
        Assert.Throws<ErroDeDominioException>(() => { Cenario.NovaTransacao(dados: Cenario.Dados(valor: valor)); });
    }

    [Fact]
    public void SinalVemDoTipoENaoDoNumero()
    {
        var entrada = Cenario.NovaTransacao(dados: Cenario.Dados(TipoMovimento.Entrada, 1000));
        var saida = Cenario.NovaTransacao(dados: Cenario.Dados(TipoMovimento.Saida, 1000));

        Assert.Equal(1000L, entrada.EfeitoNoSaldo.Valor);
        Assert.Equal(-1000L, saida.EfeitoNoSaldo.Valor);
        Assert.Equal(1000L, saida.Valor.Valor);
    }

    // INVARIANTE: categoria obrigatoria. Todo lancamento entra em exatamente um
    // grupo de relatorio; sem ela o resumo por categoria perderia linha em silencio.
    [Fact]
    public void RecusaCategoriaVazia()
    {
        var dados = new DadosTransacao(
            TipoMovimento.Saida,
            Centavos.De(1000),
            DataMovimento.Analisar("2026-09-14"),
            default,
            "Mercado",
            null);

        Assert.Throws<ErroDeDominioException>(() => { Cenario.NovaTransacao(dados: dados); });
    }

    // INVARIANTE: contaId e opcional, mas quando vem precisa ser id de verdade.
    // Nulo e "lancamento avulso"; Guid vazio e dado corrompido.
    [Fact]
    public void AceitaContaNulaERecusaContaVazia()
    {
        var avulsa = Cenario.NovaTransacao(dados: Cenario.Dados(conta: null));
        Assert.Null(avulsa.ContaId);

        var dados = Cenario.Dados() with { ContaId = default(ContaId) };
        Assert.Throws<ErroDeDominioException>(() => { Cenario.NovaTransacao(dados: dados); });
    }

    // INVARIANTE: descricao limitada. Vira varchar(200) no banco; sem teto, um
    // cliente com defeito escreve megabytes numa coluna que a UI mostra em uma linha.
    [Fact]
    public void RecusaDescricaoAcimaDoLimite()
    {
        var longa = new string('x', Transacao.TamanhoMaximoDescricao + 1);

        Assert.Throws<ErroDeDominioException>(() => { Cenario.NovaTransacao(dados: Cenario.Dados(descricao: longa)); });
    }

    [Fact]
    public void AceitaDescricaoExatamenteNoLimite()
    {
        var limite = new string('x', Transacao.TamanhoMaximoDescricao);

        Assert.Equal(limite, Cenario.NovaTransacao(dados: Cenario.Dados(descricao: limite)).Descricao);
    }

    // Descricao vazia e permitida de proposito: o cliente nao obriga o campo, e
    // inventar a obrigatoriedade aqui faria o sync rejeitar linhas que o usuario ja
    // ve na tela dele. O que fazemos e normalizar o espaco em branco.
    [Fact]
    public void AceitaDescricaoVaziaEAparaEspacos()
    {
        Assert.Equal(string.Empty, Cenario.NovaTransacao(dados: Cenario.Dados(descricao: "   ")).Descricao);
        Assert.Equal("Mercado", Cenario.NovaTransacao(dados: Cenario.Dados(descricao: "  Mercado  ")).Descricao);
    }

    // INVARIANTE: data real de 4 digitos de ano. Barra tambem o default do struct,
    // que entraria como 0001-01-01 sem passar por nenhum construtor.
    [Fact]
    public void RecusaDataInvalidaOuNaoInicializada()
    {
        var dados = Cenario.Dados() with { Data = default };

        Assert.Throws<ErroDeDominioException>(() => { Cenario.NovaTransacao(dados: dados); });
    }

    // INVARIANTE: toda agregada tem dono. Registro sem usuario vazaria entre contas.
    [Fact]
    public void RecusaUsuarioVazio()
    {
        Assert.Throws<ErroDeDominioException>(() =>
        {
            Transacao.Criar(Cenario.IdTransacao, default, Cenario.Dados(), Cenario.Em("2026-09-14T12:00:00.000Z"));
        });
    }

    // INVARIANTE: id obrigatorio. Ele vem do cliente; vazio significa que o cliente
    // nao gerou id nenhum, e gravar assim criaria uma linha que nunca sincroniza.
    [Fact]
    public void RecusaIdVazio()
    {
        Assert.Throws<ErroDeDominioException>(() =>
        {
            Transacao.Criar(default, Cenario.Usuario, Cenario.Dados(), Cenario.Em("2026-09-14T12:00:00.000Z"));
        });
    }

    [Fact]
    public void NormalizaCarimboParaUtcComMilissegundo()
    {
        var transacao = Transacao.Criar(
            Cenario.IdTransacao,
            Cenario.Usuario,
            Cenario.Dados(),
            new DateTimeOffset(2026, 9, 14, 9, 0, 0, TimeSpan.FromHours(-3)));

        Assert.Equal("2026-09-14T12:00:00.000Z", Instante.ParaTexto(transacao.AtualizadoEm));
        Assert.Equal(TimeSpan.Zero, transacao.AtualizadoEm.Offset);
    }

    [Fact]
    public void AtualizaConteudoEAvancaCarimbo()
    {
        var transacao = Cenario.NovaTransacao();

        var resultado = transacao.Atualizar(
            Cenario.Dados(descricao: "Mercado do mes", valor: 2000),
            Cenario.Em("2026-09-14T13:00:00.000Z"));

        Assert.Equal(ResultadoSincronizacao.Aplicada, resultado);
        Assert.Equal(2000L, transacao.Valor.Valor);
        Assert.Equal("Mercado do mes", transacao.Descricao);
        Assert.Equal("2026-09-14T13:00:00.000Z", Instante.ParaTexto(transacao.AtualizadoEm));
    }

    // Salvar sem mudar nada nao pode avancar o carimbo: isso geraria trafego de
    // sincronizacao para todos os aparelhos por causa de um clique a toa.
    [Fact]
    public void AtualizacaoSemMudancaNaoMexeNoCarimbo()
    {
        var transacao = Cenario.NovaTransacao();

        var resultado = transacao.Atualizar(Cenario.Dados(), Cenario.Em("2026-09-14T13:00:00.000Z"));

        Assert.Equal(ResultadoSincronizacao.DescartadaPorSerIdentica, resultado);
        Assert.Equal("2026-09-14T12:00:00.000Z", Instante.ParaTexto(transacao.AtualizadoEm));
    }

    // Relogio do servidor andando para tras e defeito de infraestrutura, nao
    // conflito: calar produziria uma linha com carimbo velho que nunca mais vence
    // um conflito e, na pratica, some do aparelho.
    [Fact]
    public void RecusaEscritaLocalComCarimboRetroativo()
    {
        var transacao = Cenario.NovaTransacao();

        Assert.Throws<ErroDeDominioException>(() =>
        {
            transacao.Atualizar(Cenario.Dados(valor: 5000), Cenario.Em("2026-09-14T11:59:59.999Z"));
        });
    }

    [Fact]
    public void ExclusaoPreencheOsDoisCarimbos()
    {
        var transacao = Cenario.NovaTransacao();

        var resultado = transacao.MarcarExcluida(Cenario.Em("2026-09-15T08:00:00.000Z"));

        Assert.Equal(ResultadoSincronizacao.Aplicada, resultado);
        Assert.True(transacao.EstaExcluida);
        Assert.Equal(transacao.AtualizadoEm, transacao.ExcluidoEm);
        Assert.Equal("2026-09-15T08:00:00.000Z", Instante.ParaTexto(transacao.AtualizadoEm));
        // Transacao excluida nao entra no saldo.
        Assert.True(transacao.EfeitoNoSaldo.EhZero);
    }

    // Apagar duas vezes nao pode remarcar o carimbo: um retry do cliente faria a
    // exclusao vencer edicoes que na verdade sao posteriores a ela.
    [Fact]
    public void ExclusaoEhIdempotente()
    {
        var transacao = Cenario.NovaTransacao();
        transacao.MarcarExcluida(Cenario.Em("2026-09-15T08:00:00.000Z"));

        var segunda = transacao.MarcarExcluida(Cenario.Em("2026-09-16T08:00:00.000Z"));

        Assert.Equal(ResultadoSincronizacao.DescartadaPorSerIdentica, segunda);
        Assert.Equal("2026-09-15T08:00:00.000Z", Instante.ParaTexto(transacao.AtualizadoEm));
    }

    // Edicao local de linha excluida nao existe: no cliente a exclusao e terminal,
    // nao ha tela para editar o que foi apagado. (Ressuscitar por sync e outro caso
    // — la e last-write-wins e esta coberto em SincronizacaoLwwTestes.)
    [Fact]
    public void RecusaEdicaoLocalDeTransacaoExcluida()
    {
        var transacao = Cenario.NovaTransacao();
        transacao.MarcarExcluida(Cenario.Em("2026-09-15T08:00:00.000Z"));

        Assert.Throws<ErroDeDominioException>(() =>
        {
            transacao.Atualizar(Cenario.Dados(valor: 9999), Cenario.Em("2026-09-16T08:00:00.000Z"));
        });
    }

    [Fact]
    public void ReconstituiSnapshotJaExcluido()
    {
        var transacao = Transacao.Reconstituir(
            Cenario.IdTransacao,
            Cenario.Usuario,
            Cenario.Dados(),
            Cenario.Em("2026-09-14T12:00:00.000Z"),
            Cenario.Em("2026-09-14T12:00:00.000Z"));

        Assert.True(transacao.EstaExcluida);
    }

    [Fact]
    public void ParaDadosDevolveOConteudoCorrente()
    {
        var transacao = Cenario.NovaTransacao(dados: Cenario.Dados(descricao: "  Padaria "));

        var dados = transacao.ParaDados();

        Assert.Equal("Padaria", dados.Descricao);
        Assert.Equal(Cenario.Categoria, dados.CategoriaId);
    }

    // A agregada valida antes de mexer em qualquer campo: um delta ruim no meio do
    // lote nao pode deixar a linha em estado partido.
    [Fact]
    public void DeltaInvalidoNaoAlteraEstadoNenhum()
    {
        var transacao = Cenario.NovaTransacao();

        Assert.Throws<ErroDeDominioException>(() =>
        {
            transacao.AplicarAtualizacaoRemota(
                Cenario.Dados(valor: 0, descricao: "Nao deveria entrar"),
                Cenario.Em("2026-09-20T12:00:00.000Z"),
                null);
        });

        Assert.Equal(1000L, transacao.Valor.Valor);
        Assert.Equal("Mercado", transacao.Descricao);
        Assert.Equal("2026-09-14T12:00:00.000Z", Instante.ParaTexto(transacao.AtualizadoEm));
    }
}
