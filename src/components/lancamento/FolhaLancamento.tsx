import { useCallback, useEffect, useRef, useState } from 'react';
import { criarTransacao } from '../../db/consultas';
import type { Categoria, Centavos, DataISO, TipoMovimento, Transacao } from '../../types';
import { ehDataISO, hoje, ZERO } from '../../types';
import { useCategorias } from '../../hooks/useCategorias';
import { useTravaScroll } from '../../hooks/useTravaScroll';
import { CampoValor } from './CampoValor';

/** Igual a duration-200 das classes; se mudar uma, mude a outra. */
const DURACAO_SAIDA = 200;

export interface FolhaLancamentoProps {
  /** Chamado quando a folha terminou de sair; quem monta deve desmontar aqui. */
  aoFechar: () => void;
  /** Opcional: recebe a transacao recem gravada, para toast ou scroll. */
  aoLancar?: (transacao: Transacao) => void;
}

/**
 * Bottom sheet do lancamento. A ordem dos campos e a ordem do polegar: valor
 * (ja focado), tipo, categoria, e so depois o que quase sempre fica no default
 * (data e descricao). Salvar grava e fecha.
 *
 * Monta so quando aberta — assim o estado nasce limpo e o autofoco acontece
 * dentro do gesto do usuario, que e o que o iOS exige para subir o teclado.
 */
export function FolhaLancamento({ aoFechar, aoLancar }: FolhaLancamentoProps): React.JSX.Element {
  const [visivel, setVisivel] = useState(false);
  const [tipo, setTipo] = useState<TipoMovimento>('saida');
  const [valor, setValor] = useState<Centavos>(ZERO);
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [data, setData] = useState<DataISO>(hoje);
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { categorias, carregando } = useCategorias(tipo);
  const saindo = useRef<number | null>(null);

  useTravaScroll(true);

  // Entrada: primeiro quadro com a folha embaixo, segundo quadro ja no lugar.
  useEffect(() => {
    const quadro = requestAnimationFrame(() => setVisivel(true));
    return () => cancelAnimationFrame(quadro);
  }, []);

  useEffect(
    () => () => {
      if (saindo.current !== null) {
        window.clearTimeout(saindo.current);
      }
    },
    [],
  );

  const fechar = useCallback((): void => {
    if (saindo.current !== null) {
      return;
    }
    setVisivel(false);
    saindo.current = window.setTimeout(aoFechar, DURACAO_SAIDA);
  }, [aoFechar]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') {
        fechar();
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fechar]);

  // Trocar o tipo troca o universo de categorias: a escolhida so sobrevive se
  // pertencer ao novo tipo.
  function trocarTipo(novo: TipoMovimento): void {
    setTipo(novo);
    setCategoria((atual) => (atual !== null && atual.tipo === novo ? atual : null));
  }

  function trocarData(evento: React.ChangeEvent<HTMLInputElement>): void {
    const texto = evento.target.value;
    if (ehDataISO(texto)) {
      setData(texto);
    }
  }

  const podeSalvar = valor !== ZERO && categoria !== null && !salvando;

  async function salvar(): Promise<void> {
    if (categoria === null || !podeSalvar) {
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const transacao = await criarTransacao({
        tipo,
        valor,
        data,
        categoriaId: categoria.id,
        descricao: descricao.trim(),
        contaId: null,
      });
      aoLancar?.(transacao);
      fechar();
    } catch {
      setErro('Nao foi possivel salvar. Tente de novo.');
      setSalvando(false);
    }
  }

  function aoEnviar(evento: React.FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    void salvar();
  }

  function classesDoTipo(alvo: TipoMovimento): string {
    const ativo = tipo === alvo;
    if (alvo === 'entrada') {
      return ativo
        ? 'bg-entrada text-superficie border-entrada'
        : 'bg-entrada-suave text-entrada border-entrada-borda';
    }
    return ativo
      ? 'bg-saida text-superficie border-saida'
      : 'bg-saida-suave text-saida border-saida-borda';
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Fechar"
        onClick={fechar}
        className={`absolute inset-0 h-full w-full cursor-default bg-tinta transition-opacity duration-200 ${
          visivel ? 'opacity-40' : 'opacity-0'
        }`}
      />

      <form
        onSubmit={aoEnviar}
        role="dialog"
        aria-modal="true"
        aria-label="Novo lançamento"
        className={`absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-folha bg-superficie shadow-2xl transition-transform duration-200 ease-out ${
          visivel ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-superficie-borda" />

        <div className="space-y-5 px-4 pt-4">
          <CampoValor valor={valor} aoMudar={setValor} tipo={tipo} />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => trocarTipo('saida')}
              aria-pressed={tipo === 'saida'}
              className={`min-h-toque flex-1 rounded-xl border text-base font-semibold transition-colors ${classesDoTipo(
                'saida',
              )}`}
            >
              Saída
            </button>
            <button
              type="button"
              onClick={() => trocarTipo('entrada')}
              aria-pressed={tipo === 'entrada'}
              className={`min-h-toque flex-1 rounded-xl border text-base font-semibold transition-colors ${classesDoTipo(
                'entrada',
              )}`}
            >
              Entrada
            </button>
          </div>

          <div>
            <span className="text-sm font-medium text-tinta-suave">Categoria</span>
            {carregando ? (
              <p className="mt-2 text-sm text-tinta-suave">Carregando...</p>
            ) : categorias.length === 0 ? (
              <p className="mt-2 text-sm text-tinta-suave">Nenhuma categoria deste tipo.</p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {categorias.map((item) => {
                  const selecionada = categoria !== null && categoria.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCategoria(item)}
                      aria-pressed={selecionada}
                      style={selecionada ? { backgroundColor: item.cor } : undefined}
                      className={`min-h-toque flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-medium transition-colors ${
                        selecionada
                          ? 'border-transparent text-superficie'
                          : 'border-superficie-borda bg-superficie text-tinta'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          selecionada ? 'bg-superficie' : ''
                        }`}
                        style={selecionada ? undefined : { backgroundColor: item.cor }}
                      />
                      <span className="truncate">{item.nome}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-tinta-suave">Data</span>
            <input
              type="date"
              value={data}
              onChange={trocarData}
              className="min-h-toque mt-1 w-full rounded-xl border border-superficie-borda bg-superficie px-3 text-base text-tinta"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-tinta-suave">Descrição (opcional)</span>
            <input
              type="text"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder="Ex.: almoço com o time"
              className="min-h-toque mt-1 w-full rounded-xl border border-superficie-borda bg-superficie px-3 text-base text-tinta placeholder:text-tinta-suave"
            />
          </label>

          {erro !== null ? (
            <p role="alert" className="text-sm font-medium text-saida">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 mt-5 border-t border-superficie-borda bg-superficie px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="submit"
            disabled={!podeSalvar}
            className="min-h-toque w-full rounded-xl bg-tinta text-base font-semibold text-superficie transition-colors disabled:bg-superficie-borda disabled:text-tinta-suave"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
