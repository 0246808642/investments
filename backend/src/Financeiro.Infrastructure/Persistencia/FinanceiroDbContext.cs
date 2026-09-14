using Financeiro.Domain.Transacoes;
using Financeiro.Infrastructure.Persistencia.Configuracoes;
using Microsoft.EntityFrameworkCore;

namespace Financeiro.Infrastructure.Persistencia;

// Contexto do dominio financeiro. Separado do IdentidadeDbContext de proposito:
// identidade e preocupacao de infraestrutura e tem ciclo de vida proprio
// (atualizacao do ASP.NET Identity muda o schema dele). Misturar os dois faria a
// migration de uma tabela de lancamento carregar junto a tabela de tokens de
// login, e uma atualizacao do Identity viraria migration do dominio.
public sealed class FinanceiroDbContext : DbContext
{
    public const string Esquema = EsquemaTransacoes.Esquema;

    // Tabela de historico propria, no schema proprio: o EF de cada contexto so
    // enxerga as migrations dele.
    public const string TabelaDeHistorico = "__historico_migracoes";

    public FinanceiroDbContext(DbContextOptions<FinanceiroDbContext> opcoes)
        : base(opcoes)
    {
    }

    public DbSet<Transacao> Transacoes => Set<Transacao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.HasDefaultSchema(Esquema);
        modelBuilder.ApplyConfiguration(new ConfiguracaoTransacao());

        base.OnModelCreating(modelBuilder);
    }
}
