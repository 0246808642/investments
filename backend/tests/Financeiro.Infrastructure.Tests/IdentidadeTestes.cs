using System.Globalization;
using Financeiro.Application.Abstracoes;
using Financeiro.Domain.Comum;
using Financeiro.Infrastructure.Identidade;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Financeiro.Infrastructure.Tests;

// Identidade real: ASP.NET Identity com store em Postgres e JWT assinado de
// verdade, validado com os mesmos parametros que a API vai usar.
[Collection(ColecaoDeBanco.Nome)]
public sealed class IdentidadeTestes
{
    private const string SenhaValida = "Senha#Forte9";

    private const string NomeValido = "Ana Souza";

    private readonly BancoDeTestes _banco;

    public IdentidadeTestes(BancoDeTestes banco) => _banco = banco;

    [Fact]
    public async Task RegistrarCriaContaEDevolveToken()
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        var resultado = await servico.RegistrarAsync(NovoEmail(), SenhaValida, NomeValido, CancellationToken.None);

        Assert.True(resultado.Sucesso);
        Assert.Empty(resultado.Erros);
        Assert.False(string.IsNullOrWhiteSpace(resultado.Token));
        Assert.NotNull(resultado.Usuario);
        Assert.False(resultado.Usuario.Value.EhVazio);
        Assert.NotNull(resultado.ExpiraEm);
    }

    [Fact]
    public async Task AutenticarComSenhaCertaDevolveToken()
    {
        var email = NovoEmail();

        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        var registro = await servico.RegistrarAsync(email, SenhaValida, NomeValido, CancellationToken.None);
        var login = await servico.AutenticarAsync(email, SenhaValida, CancellationToken.None);

        Assert.True(login.Sucesso);

        // O mesmo usuario nos dois caminhos: registrar e autenticar nao podem
        // produzir identidades diferentes para a mesma conta.
        Assert.Equal(registro.Usuario, login.Usuario);
    }

    [Fact]
    public async Task AutenticarComSenhaErradaFalhaSemDizerQualCampoErrou()
    {
        var email = NovoEmail();

        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        await servico.RegistrarAsync(email, SenhaValida, NomeValido, CancellationToken.None);

        var login = await servico.AutenticarAsync(email, "Senha#Errada9", CancellationToken.None);

        Assert.False(login.Sucesso);
        Assert.Null(login.Token);
        Assert.Null(login.Usuario);

        // Mensagem identica a de e-mail inexistente: mensagens diferentes
        // transformariam a tela de login num verificador de quais e-mails tem conta.
        var inexistente = await servico.AutenticarAsync(NovoEmail(), SenhaValida, CancellationToken.None);
        Assert.Equal(inexistente.Erros, login.Erros);
    }

    [Fact]
    public async Task EmailDuplicadoEhRecusado()
    {
        var email = NovoEmail();

        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        var primeiro = await servico.RegistrarAsync(email, SenhaValida, NomeValido, CancellationToken.None);
        var segundo = await servico.RegistrarAsync(email, SenhaValida, NomeValido, CancellationToken.None);

        Assert.True(primeiro.Sucesso);
        Assert.False(segundo.Sucesso);
        Assert.NotEmpty(segundo.Erros);
        Assert.Null(segundo.Token);
    }

    // Os erros do Identity chegam em lista porque ele devolve varios de uma vez.
    [Fact]
    public async Task SenhaFracaDevolveAsMensagensDoIdentity()
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        var resultado = await servico.RegistrarAsync(NovoEmail(), "abc", NomeValido, CancellationToken.None);

        Assert.False(resultado.Sucesso);
        Assert.NotEmpty(resultado.Erros);
        Assert.Null(resultado.Token);
    }

    // O ponto critico: o UsuarioId que o token carrega e LITERALMENTE o Guid da
    // chave do Identity. Qualquer traducao entre os dois seria um lugar a mais onde
    // uma requisicao pode acabar escopada pela conta errada.
    [Fact]
    public async Task UsuarioIdDoTokenEhOMesmoGuidDaChaveDoIdentity()
    {
        var email = NovoEmail();

        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();
        var gerenciador = escopo.ServiceProvider.GetRequiredService<UserManager<UsuarioDaAplicacao>>();

        var resultado = await servico.RegistrarAsync(email, SenhaValida, NomeValido, CancellationToken.None);
        Assert.True(resultado.Sucesso);
        Assert.NotNull(resultado.Usuario);
        Assert.NotNull(resultado.Token);

        var usuarioNoBanco = await gerenciador.FindByEmailAsync(email);
        Assert.NotNull(usuarioNoBanco);

        // 1. O UsuarioId devolvido e a chave do Identity, sem conversao.
        Assert.Equal(usuarioNoBanco.Id, resultado.Usuario.Value.Valor);

        // 2. E a claim dentro do token assinado tambem.
        var opcoes = OpcoesJwt.Carregar(_banco.Configuracao());
        var manipulador = new JsonWebTokenHandler();

        var validacao = await manipulador.ValidateTokenAsync(resultado.Token, opcoes.ParametrosDeValidacao());

        Assert.True(validacao.IsValid);
        Assert.Null(validacao.Exception);

        var claim = Assert.IsType<string>(validacao.Claims[ClaimsFinanceiro.UsuarioId]);
        Assert.Equal(usuarioNoBanco.Id, Guid.Parse(claim, CultureInfo.InvariantCulture));

        // 3. E 'sub' carrega o mesmo valor, para quem preferir a claim registrada.
        var sub = Assert.IsType<string>(validacao.Claims[JwtRegisteredClaimNames.Sub]);
        Assert.Equal(claim, sub);

        // 4. A claim usa o formato canonico 8-4-4-4-12, o mesmo que UsuarioId.Analisar
        //    espera do outro lado.
        Assert.True(UsuarioId.TentarAnalisar(claim, out var reconstruido));
        Assert.Equal(resultado.Usuario, reconstruido);
    }

    // O token e assinado com a chave configurada: uma chave diferente nao valida.
    // E o que impede alguem de forjar um token com o UsuarioId de outra conta.
    [Fact]
    public async Task TokenAssinadoComOutraChaveNaoValida()
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        var resultado = await servico.RegistrarAsync(NovoEmail(), SenhaValida, NomeValido, CancellationToken.None);
        Assert.NotNull(resultado.Token);

        var intruso = new OpcoesJwt
        {
            Chave = new string('z', 64),
            Emissor = _banco.Emissor,
            Audiencia = _banco.Audiencia,
            MinutosDeValidade = 30,
        };

        var validacao = await new JsonWebTokenHandler()
            .ValidateTokenAsync(resultado.Token, intruso.ParametrosDeValidacao());

        Assert.False(validacao.IsValid);
    }

    // Emissor e audiencia sao validados: um token legitimo de outro sistema que use
    // a mesma chave nao serve aqui.
    [Fact]
    public async Task TokenComOutroEmissorNaoValida()
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        var resultado = await servico.RegistrarAsync(NovoEmail(), SenhaValida, NomeValido, CancellationToken.None);
        Assert.NotNull(resultado.Token);

        var outroEmissor = new OpcoesJwt
        {
            Chave = _banco.ChaveDeAssinatura,
            Emissor = "outro-sistema",
            Audiencia = _banco.Audiencia,
            MinutosDeValidade = 30,
        };

        var validacao = await new JsonWebTokenHandler()
            .ValidateTokenAsync(resultado.Token, outroEmissor.ParametrosDeValidacao());

        Assert.False(validacao.IsValid);
    }

    // A tabela do Identity vive em schema proprio, com historico de migrations
    // proprio: e isso que desacopla o ciclo do Identity do ciclo do dominio.
    [Fact]
    public async Task UsuarioEhGravadoNoSchemaDeIdentidadeENaoNoDoDominio()
    {
        var email = NovoEmail();

        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();
        await servico.RegistrarAsync(email, SenhaValida, NomeValido, CancellationToken.None);

        var contexto = escopo.ServiceProvider.GetRequiredService<IdentidadeDbContext>();
        var tabela = contexto.Model.FindEntityType(typeof(UsuarioDaAplicacao));

        Assert.NotNull(tabela);
        Assert.Equal(IdentidadeDbContext.Esquema, tabela.GetSchema());
    }

    // Um e-mail por conta, garantido tambem pela configuracao do Identity.
    [Fact]
    public void IdentityExigeEmailUnico()
    {
        using var escopo = _banco.Provedor.CreateScope();
        var opcoes = escopo.ServiceProvider
            .GetRequiredService<Microsoft.Extensions.Options.IOptions<IdentityOptions>>();

        Assert.True(opcoes.Value.User.RequireUniqueEmail);
    }

    // E-mails unicos por teste: a suite inteira compartilha um banco, e reusar
    // e-mail faria um teste derrubar o outro por um motivo que nao e o dele.
    private static string NovoEmail()
        => "teste-" + Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture) + "@exemplo.test";

    [Fact]
    public async Task RegistrarGuardaONomeEDevolveNoResultado()
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();
        var email = NovoEmail();

        var resultado = await servico.RegistrarAsync(email, SenhaValida, NomeValido, CancellationToken.None);

        Assert.True(resultado.Sucesso);
        Assert.Equal(NomeValido, resultado.Nome);

        // E o login seguinte devolve o mesmo nome: quem fecha a janela e volta nao
        // pode reencontrar o e-mail na tela.
        var login = await servico.AutenticarAsync(email, SenhaValida, CancellationToken.None);
        Assert.Equal(NomeValido, login.Nome);
    }

    [Fact]
    public async Task NomeColapsaEspacosRepetidos()
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        // "Ana   Maria" e "Ana Maria" sao a mesma pessoa; guardar os dois faria ela
        // parecer duas contas diferentes em qualquer listagem.
        var resultado = await servico.RegistrarAsync(
            NovoEmail(),
            SenhaValida,
            "  Ana   Maria  ",
            CancellationToken.None);

        Assert.Equal("Ana Maria", resultado.Nome);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("A")]
    public async Task RecusaNomeCurtoDemais(string nome)
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        var resultado = await servico.RegistrarAsync(NovoEmail(), SenhaValida, nome, CancellationToken.None);

        Assert.False(resultado.Sucesso);
        Assert.NotEmpty(resultado.Erros);
    }

    [Fact]
    public async Task RecusaNomeAcimaDoTeto()
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        // Um caractere alem do limite. Sem esta recusa a gravacao estouraria no
        // varchar(80) da coluna, e o erro sairia como falha de banco em vez de
        // mensagem de formulario.
        var longo = new string('a', UsuarioDaAplicacao.TamanhoMaximoDoNome + 1);

        var resultado = await servico.RegistrarAsync(NovoEmail(), SenhaValida, longo, CancellationToken.None);

        Assert.False(resultado.Sucesso);
    }

    [Fact]
    public async Task DoisUsuariosPodemTerOMesmoNome()
    {
        await using var escopo = _banco.CriarEscopo();
        var servico = escopo.ServiceProvider.GetRequiredService<IServicoDeIdentidade>();

        // Nome e rotulo de exibicao, nao credencial. Exigir unicidade impediria o
        // segundo "Joao Silva" do mundo de criar conta.
        var primeiro = await servico.RegistrarAsync(NovoEmail(), SenhaValida, "Joao Silva", CancellationToken.None);
        var segundo = await servico.RegistrarAsync(NovoEmail(), SenhaValida, "Joao Silva", CancellationToken.None);

        Assert.True(primeiro.Sucesso);
        Assert.True(segundo.Sucesso);
    }
}
