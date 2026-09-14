import { useCallback, useEffect, useRef, useState } from 'react';
import { criarTransacao } from '../../db/consultas';
import type { Categoria, Centavos, DataISO, TipoMovimento, Transacao } from '../../types';
import { ehDataISO, hoje, ZERO } from '../../types';
import { useCategorias } from '../../hooks/useCategorias';
import { useTravaScroll } from '../../hooks/useTravaScroll';
import { CampoValor } from './CampoValor';

/** Igual a duration-200 das classes; se mudar uma, mude a outra. */
const DURACAO_SAIDA = 200;

const FOCAVEIS =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const ANEL_FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

/** Alvo de 44px em <md (dedo) e relaxado em md+ (ha ponteiro). */
const CAMPO_TEXTO = `min-h-toque mt-1 w-full rounded-lg border border-superficie-borda bg-superficie px-3 text-base text-tinta md:min-h-0 md:py-2 md:text-sm ${ANEL_FOCO}`;

export interface FolhaLancamentoProps {
  /** Chamado quando a folha terminou de sair; quem monta deve desmontar aqui. */
  aoFechar: () => void;
  /** Opcional: recebe a transacao recem gravada, para toast ou scroll. */
  aoLancar?: (transacao: Transacao) => void;
}

/**
 * Formulario de lancamento. Um componente so, dois containers: bottom sheet
 * subindo em <md (zona do polegar, teclado do celular) e modal centrado em md+
 * — folha colada embaixo numa tela de 1440px jogaria o formulario para o canto
 * mais distante do olho.
 *
 * A ordem dos campos e a ordem do polegar: valor (ja focado), tipo, categoria,
 * e so depois o que quase sempre fica no default (data e descricao).
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
  const dialogo = useRef<HTMLFormElement>(null);

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

  /** Focaveis que existem de verdade: o que esta em md:hidden / hidden md:flex nao conta. */
  function focaveisVisiveis(raiz: HTMLElement): HTMLElement[] {
    return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
      (elemento) => elemento.getClientRects().length > 0,
    );
  }

  /**
   * Tab preso dentro do dialogo e Enter submetendo quando podeSalvar. Enter em
   * botao continua sendo "acionar o botao": senao escolher categoria pelo
   * teclado salvaria o lancamento no meio do caminho.
   */
  function aoTeclarNoDialogo(evento: React.KeyboardEvent<HTMLFormElement>): void {
    if (evento.key === 'Enter') {
      const alvo = evento.target;
      const ehBotao =
        alvo instanceof HTMLElement && (alvo.tagName === 'BUTTON' || alvo.tagName === 'TEXTAREA');
      if (ehBotao) {
        return;
      }
      evento.preventDefault();
      if (podeSalvar) {
        void salvar();
      }
      return;
    }

    if (evento.key !== 'Tab') {
      return;
    }
    const raiz = dialogo.current;
    if (raiz === null) {
      return;
    }
    const focaveis = focaveisVisiveis(raiz);
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (primeiro === undefined || ultimo === undefined) {
      return;
    }
    const ativo = document.activeElement;
    if (evento.shiftKey && ativo === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && ativo === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
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
      {/*
        tabIndex -1: o backdrop continua clicavel e continua no leitor de tela,
        mas fica fora do Tab — quem fecha pelo teclado usa Esc ou o botao de
        fechar do cabecalho (md+). Assim o primeiro Tab ja cai no formulario.
      */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fechar"
        onClick={fechar}
        className={`absolute inset-0 h-full w-full cursor-default bg-tinta transition-opacity duration-200 ${
          visivel ? 'opacity-40' : 'opacity-0'
        }`}
      />

      <form
        ref={dialogo}
        onSubmit={aoEnviar}
        onKeyDown={aoTeclarNoDialogo}
        role="dialog"
        aria-modal="true"
        aria-label="Novo lançamento"
        className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-folha bg-superficie shadow-folha transition duration-200 ease-out md:inset-0 md:m-auto md:h-fit md:max-h-[86vh] md:max-w-lg md:rounded-xl md:shadow-modal ${
          visivel
            ? 'translate-y-0 md:translate-y-0 md:scale-100 md:opacity-100'
            : 'translate-y-full md:translate-y-1 md:scale-[0.98] md:opacity-0'
        }`}
      >
        {/* Puxador: afordancia de arraste, so faz sentido com dedo. */}
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-superficie-borda md:hidden" />

        <div className="hidden items-center justify-between px-5 pt-4 md:flex">
          <h2 className="text-base font-medium text-tinta">Novo lançamento</h2>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className={`-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-superficie-fundo hover:text-tinta ${ANEL_FOCO}`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-4 pt-4 md:px-5 md:pt-3">
          <CampoValor valor={valor} aoMudar={setValor} tipo={tipo} />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => trocarTipo('saida')}
              aria-pressed={tipo === 'saida'}
              className={`min-h-toque flex-1 rounded-lg border text-base font-semibold transition-colors md:min-h-0 md:py-2.5 md:text-sm ${ANEL_FOCO} ${classesDoTipo(
                'saida',
              )}`}
            >
              Saída
            </button>
            <button
              type="button"
              onClick={() => trocarTipo('entrada')}
              aria-pressed={tipo === 'entrada'}
              className={`min-h-toque flex-1 rounded-lg border text-base font-semibold transition-colors md:min-h-0 md:py-2.5 md:text-sm ${ANEL_FOCO} ${classesDoTipo(
                'entrada',
              )}`}
            >
              Entrada
            </button>
          </div>

          <div>
            <span className="text-rotulo font-medium text-tinta-suave">Categoria</span>
            {carregando ? (
              <p className="mt-2 text-rotulo text-tinta-suave">Carregando...</p>
            ) : categorias.length === 0 ? (
              <p className="mt-2 text-rotulo text-tinta-suave">Nenhuma categoria deste tipo.</p>
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
                      className={`min-h-toque flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-sm font-medium transition-colors md:min-h-0 md:py-2 ${ANEL_FOCO} ${
                        selecionada
                          ? 'border-transparent text-superficie'
                          : 'border-superficie-borda bg-superficie text-tinta hover:border-superficie-forte'
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
            <span className="text-rotulo font-medium text-tinta-suave">Data</span>
            <input type="date" value={data} onChange={trocarData} className={CAMPO_TEXTO} />
          </label>

          <label className="block">
            <span className="text-rotulo font-medium text-tinta-suave">Descrição (opcional)</span>
            <input
              type="text"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder="Ex.: almoço com o time"
              className={`${CAMPO_TEXTO} placeholder:text-tinta-fraca`}
            />
          </label>

          {erro !== null ? (
            <p role="alert" className="text-rotulo font-medium text-saida">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 mt-5 border-t border-superficie-borda bg-superficie px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-5 md:pb-4">
          <button
            type="submit"
            disabled={!podeSalvar}
            className={`min-h-toque w-full rounded-lg bg-tinta text-base font-semibold text-superficie transition-colors hover:bg-tinta-forte disabled:bg-superficie-borda disabled:text-tinta-suave md:min-h-0 md:py-2.5 md:text-sm ${ANEL_FOCO}`}
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
