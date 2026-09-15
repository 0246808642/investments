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
