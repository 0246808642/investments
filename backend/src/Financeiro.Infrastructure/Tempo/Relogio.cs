using Financeiro.Application.Abstracoes;
using Financeiro.Domain.Comum;

namespace Financeiro.Infrastructure.Tempo;

// Relogio do servidor. Devolve UTC ja normalizado (truncado em milissegundo), a
// mesma precisao que o cliente produz com toISOString() e que o dominio usa para
// comparar carimbos. Normalizar aqui, e nao so no dominio, evita que um carimbo
// com 7 casas escape para um lugar que ainda nao passou pelo Instante.
public sealed class Relogio : IRelogio
{
    public DateTimeOffset Agora => Instante.Normalizar(DateTimeOffset.UtcNow);
}
