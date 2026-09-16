using Financeiro.Infrastructure.Identidade;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Financeiro.Infrastructure;

// Troca a senha de uma conta pela linha de comando, com acesso direto ao banco.
//
// Existe porque o app nao tem — e hoje nao teria como ter — um "esqueci minha
// senha": nao ha envio de e-mail configurado, e sem ele um fluxo de recuperacao
// pela API seria um endpoint que troca senha sem provar que quem pediu e o dono
// da conta. Enquanto isso nao existe, o caminho honesto e este: quem ja tem a
// connection string do banco ja tem poder total sobre ele, entao a ferramenta
// nao concede nada que o operador nao tivesse.
//
// NAO e endpoint e nao deve virar um. Roda no processo da API so para reusar o
// container de DI (mesma connection string, mesmo hasher, mesmas opcoes), do
// mesmo jeito que `--migrar`.
public static class RedefinidorDeSenha
{
    public sealed record Resultado(bool Ok, string Mensagem, IReadOnlyList<string> Avisos);

    public static async Task<Resultado> RedefinirAsync(
        IServiceProvider provedor,
        string email,
        string senha,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(provedor);
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(senha);

        await using var escopo = provedor.CreateAsyncScope();
        var gerenciador = escopo.ServiceProvider.GetRequiredService<UserManager<UsuarioDaAplicacao>>();

        var usuario = await gerenciador.FindByEmailAsync(email).ConfigureAwait(false);
        if (usuario is null)
        {
            return new Resultado(false, $"Nenhuma conta com o e-mail {email}.", []);
        }

        // A politica de senha e conferida, mas NAO barra: ela existe para orientar
        // quem esta criando conta na tela, e aqui quem decide e o operador com o
        // banco na mao. O que a ferramenta deve a ele e o aviso — uma senha que a
        // tela de cadastro recusaria continua entrando pelo login sem reclamar, e
        // descobrir isso por acaso, meses depois, seria pior.
        var avisos = new List<string>();
        foreach (var validador in gerenciador.PasswordValidators)
        {
            var conferencia = await validador.ValidateAsync(gerenciador, usuario, senha).ConfigureAwait(false);
            if (!conferencia.Succeeded)
            {
                avisos.AddRange(conferencia.Errors.Select(erro => erro.Description));
            }
        }

        usuario.PasswordHash = gerenciador.PasswordHasher.HashPassword(usuario, senha);
        // Carimbo novo: e o que invalida cookie e token de recuperacao emitidos
        // com a senha antiga. Os JWT ja emitidos continuam valendo ate vencerem —
        // eles sao autocontidos e o app nao consulta o carimbo a cada requisicao.
        usuario.SecurityStamp = Guid.NewGuid().ToString("N");

        var atualizacao = await gerenciador.UpdateAsync(usuario).ConfigureAwait(false);
        if (!atualizacao.Succeeded)
        {
            var motivos = string.Join("; ", atualizacao.Errors.Select(erro => erro.Description));
            return new Resultado(false, $"O banco recusou a atualizacao: {motivos}", avisos);
        }

        cancellationToken.ThrowIfCancellationRequested();
        return new Resultado(true, $"Senha de {email} trocada.", avisos);
    }
}
