namespace Financeiro.Application.Abstracoes;

// Um lote de sincronizacao e atomico: ou todos os deltas aceitos entram, ou
// nenhum entra. Metade de um lote gravada deixaria o cliente marcando como
// sincronizado um estado que o servidor nao tem.
public interface IUnidadeDeTrabalho
{
    Task SalvarAlteracoesAsync(CancellationToken cancellationToken);

    // A leitura do pull acontece dentro da mesma transacao da escrita do push, para
    // que a resposta reflita exatamente o estado que acabou de ser gravado.
    Task<T> ExecutarEmTransacaoAsync<T>(
        Func<CancellationToken, Task<T>> operacao,
        CancellationToken cancellationToken);
}
