namespace Financeiro.Api.Endpoints;

// Os unicos contratos de fio que nascem na API. Nao ha DTO de identidade na
// Application de proposito: IServicoDeIdentidade nao expoe entidade de usuario,
// so email/senha entrando e token saindo. Transacao, essa sim, usa os DTOs ja
// definidos na Application — aqui nao se inventa nada.

// Campos anulaveis porque vem de JSON de fora: declarar nao-anulavel seria mentir
// para o compilador e cobrar o preco com NullReferenceException na primeira
// requisicao sem corpo.
internal sealed record RequisicaoDeCredenciais(string? Email, string? Senha);

// Registro pede um campo a mais que o login. Contrato proprio em vez de um Nome
// opcional no de credenciais: assim o login nao aceita calado um campo que ele
// ignora, e o OpenAPI descreve cada rota pelo que ela realmente le.
internal sealed record RequisicaoDeRegistro(string? Email, string? Senha, string? Nome);

// ExpiraEm sai como ISO-8601 UTC com 'Z', igual a updatedAt/deletedAt das
// transacoes — um formato de instante so no contrato inteiro.
//
// Nome e anulavel: conta criada antes da coluna existir nao tem nome, e o cliente
// cai para o e-mail nesse caso.
internal sealed record RespostaDeToken(string Token, string ExpiraEm, string? Nome);

// Alteracao de nome. Contrato proprio, de um campo so: reaproveitar o de registro
// faria a rota anunciar que le e-mail e senha, que ela nao le — e um cliente que
// acreditasse no anuncio mandaria credencial por uma rota que a ignora.
internal sealed record RequisicaoDeNome(string? Nome);

// Alteracao de senha. A atual e obrigatoria mesmo com token valido: token vazado
// ou aparelho destravado nao podem virar tomada de conta.
internal sealed record RequisicaoDeSenha(string? SenhaAtual, string? SenhaNova);
