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
    public UsuarioDaAplicacao()
    {
        // O id nasce aqui, antes de qualquer ida ao banco, para que o servico ja
        // possa emitir o token com o UsuarioId definitivo sem um segundo round-trip.
        Id = Guid.NewGuid();
    }

    // Projecao para o tipo do dominio. E so uma troca de invólucro: o Guid e o
    // mesmo, nao ha traducao nem tabela de correspondencia.
    public UsuarioId ParaUsuarioId() => UsuarioId.De(Id);
}
