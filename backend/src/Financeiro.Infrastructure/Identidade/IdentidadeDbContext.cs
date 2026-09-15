using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Financeiro.Infrastructure.Identidade;

// Contexto do ASP.NET Identity, SEPARADO do FinanceiroDbContext.
//
// Mesmo banco, schema proprio ('identidade') e tabela de historico de migrations
// propria. O motivo e de ciclo de vida: identidade e infraestrutura, nao dominio
// financeiro. Num contexto unico, uma atualizacao do ASP.NET Identity que mude o
// schema dele entraria como migration do dominio, e uma migration de lancamento
// nao poderia ser aplicada sem arrastar junto a de token de login. Separados, cada
// um avanca no proprio ritmo, e a tabela de historico separada e o que torna isso
// verdade para o EF e nao so na intencao.
//
// Os nomes de tabela sao os padrao do Identity (AspNetUsers, AspNetRoles, ...) de
// proposito: sao artefato do framework, nao vocabulario do dominio, e renomear so
// dificultaria reconhecer o que veio da caixa.
public sealed class IdentidadeDbContext
    : IdentityDbContext<UsuarioDaAplicacao, IdentityRole<Guid>, Guid>
{
    public const string Esquema = "identidade";

    public const string TabelaDeHistorico = "__historico_migracoes";

    public IdentidadeDbContext(DbContextOptions<IdentidadeDbContext> opcoes)
        : base(opcoes)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.HasDefaultSchema(Esquema);
        base.OnModelCreating(builder);

        // O teto vive no modelo, e nao so na validacao do endpoint: quem escrever
        // direto pelo DbContext um dia (uma rotina de importacao, um seed) esbarra
        // no mesmo limite que a API impoe.
        builder.Entity<UsuarioDaAplicacao>()
            .Property(usuario => usuario.Nome)
            .HasMaxLength(UsuarioDaAplicacao.TamanhoMaximoDoNome);
    }
}
