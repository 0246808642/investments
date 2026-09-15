using Financeiro.Domain.Comum;
using Microsoft.AspNetCore.Identity;

namespace Financeiro.Infrastructure.Identidade;

// Usuario do ASP.NET Identity com chave Guid.
//
// A chave e Guid — e nao a string que o Identity usa por padrao — porque ela
// precisa ser LITERALMENTE o mesmo valor do UsuarioId do dominio. Com chave
// string, toda requisicao faria um parse de texto para Guid antes de escopar a
// consulta, e cada parse e um lugar a mais onde um id malformado vira ou excecao
// ou, pior, um Guid.Empty que casa com a linha de outra conta.
public sealed class UsuarioDaAplicacao : IdentityUser<Guid>
{
    // Teto do nome. Vira varchar(80) na migration; sem limite, um cliente com
    // defeito escreve megabytes numa coluna que a UI mostra num botao de uma linha.
    public const int TamanhoMaximoDoNome = 80;

    // Minimo de 2: uma letra so nao identifica ninguem na lista de contas, e o
    // custo de digitar a segunda e zero.
    public const int TamanhoMinimoDoNome = 2;

    public UsuarioDaAplicacao()
    {
        // O id nasce aqui, antes de qualquer ida ao banco, para que o servico ja
        // possa emitir o token com o UsuarioId definitivo sem um segundo round-trip.
        Id = Guid.NewGuid();
    }

    // Nome de exibicao. NAO e credencial: o login continua sendo por e-mail, e dois
    // usuarios podem se chamar igual — exigir unicidade aqui transformaria um campo
    // de apresentacao em identificador, e o segundo "Joao Silva" nao conseguiria
    // criar conta.
    //
    // Anulavel porque as contas criadas antes desta coluna existirem nao tem nome;
    // a UI cai para o e-mail nesses casos em vez de mostrar vazio.
    public string? Nome { get; set; }

    // Projecao para o tipo do dominio. E so uma troca de invólucro: o Guid e o
    // mesmo, nao ha traducao nem tabela de correspondencia.
    public UsuarioId ParaUsuarioId() => UsuarioId.De(Id);
}
