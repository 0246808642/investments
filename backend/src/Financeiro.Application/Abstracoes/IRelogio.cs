namespace Financeiro.Application.Abstracoes;

// Relogio do servidor. E porta (e nao DateTimeOffset.UtcNow espalhado) porque a
// regra inteira de sincronizacao e uma comparacao de carimbos: sem controlar o
// tempo, nenhum teste de conflito seria deterministico.
//
// A implementacao deve devolver UTC. O dominio normaliza de novo (UTC truncado em
// milissegundo) antes de gravar, entao um implementador distraido nao quebra a
// regra — so perde precisao que nao seria comparavel de qualquer forma.
public interface IRelogio
{
    DateTimeOffset Agora { get; }
}
