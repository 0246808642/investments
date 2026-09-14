import { useCallback, useEffect, useRef, useState } from 'react';
import { criarTransacao } from '../../db/consultas';
import type { Categoria, Centavos, DataISO, TipoMovimento, Transacao } from '../../types';
import { ehDataISO, formatarDataComSemana, formatarMoeda, hoje, ontem, ZERO } from '../../types';
import { useCategorias } from '../../hooks/useCategorias';
import type { Textos } from '../../i18n';
import { useTextos } from '../../i18n';
import { useTravaScroll } from '../../hooks/useTravaScroll';
import { CampoValor } from './CampoValor';

/** Igual a duration-200 das classes; se mudar uma, mude a outra. */
const DURACAO_SAIDA = 200;

const FOCAVEIS =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const ANEL_FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

/** Alvo de 44px em <md (dedo) e relaxado em md+ (ha ponteiro). */
const CAMPO_TEXTO = `min-h-toque w-full rounded-lg border border-superficie-borda bg-superficie px-3 text-base text-tinta md:min-h-0 md:py-2 md:text-sm ${ANEL_FOCO}`;

/** Pergunta que abre cada bloco. E rotulo de campo, nao enfeite: some se o campo sumir. */
const PERGUNTA = 'text-rotulo font-medium text-tinta-suave';

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
 * A ordem dos campos e a ordem das perguntas que a pessoa responde:
 *
 *   1. saida ou entrada   decide TUDO que vem abaixo (cor, categorias, copy)
 *   2. quanto             ja focado, teclado numerico sobe junto
 *   3. em que / de onde    grade de categorias do tipo escolhido
 *   4. quando             "Hoje" ja marcado; o calendario e o caso raro
 *   5. nota               fechada por padrao: opcional nao ocupa altura
 *
 * O tipo subiu para o topo porque ele reescreve o resto do formulario: escolher
 * o valor antes e escolher quanto de um lancamento que ainda nao existe.
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
  const [notaAberta, setNotaAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { categorias, carregando } = useCategorias(tipo);
  const t = useTextos();
  const saindo = useRef<number | null>(null);
  const dialogo = useRef<HTMLFormElement>(null);
  const campoNota = useRef<HTMLInputElement>(null);

  const ehEntrada = tipo === 'entrada';

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

  function abrirNota(): void {
    setNotaAberta(true);
    // Um quadro depois: o campo ainda nao existe no DOM no clique.
    requestAnimationFrame(() => campoNota.current?.focus());
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
      setErro(t.lancamento.erroAoSalvar);
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
        aria-label={t.comum.fechar}
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
        aria-label={ehEntrada ? t.lancamento.novaEntrada : t.lancamento.novaSaida}
        className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-folha bg-superficie shadow-folha transition duration-200 ease-out md:inset-0 md:m-auto md:h-fit md:max-h-[86vh] md:max-w-lg md:rounded-xl md:shadow-modal ${
          visivel
            ? 'translate-y-0 md:translate-y-0 md:scale-100 md:opacity-100'
            : 'translate-y-full md:translate-y-1 md:scale-[0.98] md:opacity-0'
        }`}
      >
        {/* Puxador: afordancia de arraste, so faz sentido com dedo. */}
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-superficie-borda md:hidden" />

        <div className="hidden items-center justify-between px-5 pt-4 md:flex">
          <h2 className="text-base font-medium text-tinta">
            {ehEntrada ? t.lancamento.novaEntrada : t.lancamento.novaSaida}
          </h2>
          <button
            type="button"
            onClick={fechar}
            aria-label={t.comum.fechar}
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
          <SeletorDeTipo tipo={tipo} aoTrocar={trocarTipo} textos={t} />

          <CampoValor valor={valor} aoMudar={setValor} tipo={tipo} />

          <div>
            <span className={PERGUNTA}>
              {ehEntrada ? t.lancamento.deOndeVeio : t.lancamento.foiComOQue}
            </span>
            {carregando ? (
              <p className="mt-2 text-rotulo text-tinta-suave">{t.comum.carregando}</p>
            ) : categorias.length === 0 ? (
              <p className="mt-2 text-rotulo text-tinta-suave">
                {t.lancamento.semCategoriaDoTipo(
                  ehEntrada ? t.comum.entrada : t.comum.saida,
                )}
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
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

          <SeletorDeData
            data={data}
            aoMudarData={setData}
            aoDigitarData={trocarData}
            textos={t}
          />

          {/*
            Nota fechada por padrao. Quase todo lancamento se resolve com valor,
            categoria e data; deixar o campo aberto cobrava a altura dele de
            todo mundo para servir a minoria que escreve alguma coisa.
          */}
          {notaAberta ? (
            <label className="block">
              <span className={PERGUNTA}>{t.lancamento.nota}</span>
              <input
                ref={campoNota}
                type="text"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder={t.lancamento.exemploNota}
                className={`mt-1 ${CAMPO_TEXTO} placeholder:text-tinta-fraca`}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={abrirNota}
              className={`-ml-1 flex min-h-toque items-center rounded-lg px-1 text-sm font-medium text-marca md:min-h-0 md:py-1 md:hover:bg-marca-suave ${ANEL_FOCO}`}
            >
              {t.lancamento.adicionarNota}
            </button>
          )}

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
            className={`min-h-toque w-full rounded-lg bg-marca text-base font-semibold text-marca-contraste shadow-sm transition-colors hover:bg-marca-forte disabled:bg-superficie-fundo disabled:text-tinta-suave disabled:shadow-none md:min-h-0 md:py-2.5 md:text-sm ${ANEL_FOCO}`}
          >
            {rotuloDoBotao({ salvando, valor, categoria, ehEntrada, textos: t })}
          </button>
        </div>
      </form>
    </div>
  );
}

interface RotuloDoBotaoArgs {
  salvando: boolean;
  valor: Centavos;
  categoria: Categoria | null;
  ehEntrada: boolean;
  textos: Textos;
}

/**
 * O botao diz o que falta enquanto falta, e o que vai acontecer quando da.
 * "Salvar" desabilitado e um beco sem saida: a pessoa ve que nao pode e nao
 * descobre por que.
 */
function rotuloDoBotao({
  salvando,
  valor,
  categoria,
  ehEntrada,
  textos: t,
}: RotuloDoBotaoArgs): string {
  if (salvando) {
    return t.comum.salvando;
  }
  if (valor === ZERO) {
    return t.lancamento.digiteOValor;
  }
  if (categoria === null) {
    return ehEntrada ? t.lancamento.escolhaOrigem : t.lancamento.escolhaCategoria;
  }
  return ehEntrada
    ? t.lancamento.registrarEntrada(formatarMoeda(valor))
    : t.lancamento.registrarSaida(formatarMoeda(valor));
}

interface SeletorDeTipoProps {
  tipo: TipoMovimento;
  aoTrocar: (tipo: TipoMovimento) => void;
  textos: Textos;
}

/**
 * Segmentado num trilho unico, e nao dois botoes soltos: com duas pilulas
 * coloridas lado a lado, "vermelho aceso" e "verde apagado" competiam e nao
 * havia como saber, de relance, qual estava valendo. Aqui o selecionado e o
 * unico que levanta do trilho.
 */
function SeletorDeTipo({ tipo, aoTrocar, textos: t }: SeletorDeTipoProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={t.lancamento.tipo}
      className="grid grid-cols-2 gap-1 rounded-lg bg-superficie-fundo p-1"
    >
      <Segmento
        rotulo={t.lancamento.saiuDinheiro}
        selecionado={tipo === 'saida'}
        classeAtiva="text-saida"
        aoTocar={() => {
          aoTrocar('saida');
        }}
      />
      <Segmento
        rotulo={t.lancamento.entrouDinheiro}
        selecionado={tipo === 'entrada'}
        classeAtiva="text-entrada"
        aoTocar={() => {
          aoTrocar('entrada');
        }}
      />
    </div>
  );
}

interface SegmentoProps {
  rotulo: string;
  selecionado: boolean;
  classeAtiva: string;
  aoTocar: () => void;
}

function Segmento({ rotulo, selecionado, classeAtiva, aoTocar }: SegmentoProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={selecionado}
      className={`min-h-toque rounded-md text-sm font-semibold transition-colors md:min-h-0 md:py-2 ${ANEL_FOCO} ${
        selecionado
          ? `bg-superficie shadow-sm ${classeAtiva}`
          : 'text-tinta-suave md:hover:text-tinta'
      }`}
    >
      {rotulo}
    </button>
  );
}

interface SeletorDeDataProps {
  data: DataISO;
  aoMudarData: (data: DataISO) => void;
  aoDigitarData: (evento: React.ChangeEvent<HTMLInputElement>) => void;
  textos: Textos;
}

/**
 * Quase todo lancamento e de hoje ou de ontem. Dois atalhos resolvem esses dois
 * casos com um toque; o input de data fica para o resto — e nao para o comeco,
 * onde ele obrigava a ler "09/14/2026" (o formato vem do locale do navegador,
 * nao do nosso) so para confirmar que era hoje mesmo.
 */
function SeletorDeData({
  data,
  aoMudarData,
  aoDigitarData,
  textos: t,
}: SeletorDeDataProps): React.JSX.Element {
  const dataDeHoje = hoje();
  const dataDeOntem = ontem();
  const outroDia = data !== dataDeHoje && data !== dataDeOntem;

  return (
    <div>
      <span className={PERGUNTA}>{t.lancamento.quando}</span>

      <div className="mt-2 flex flex-wrap gap-2">
        <ChipDeData
          rotulo={t.lancamento.hoje}
          selecionado={data === dataDeHoje}
          aoTocar={() => {
            aoMudarData(dataDeHoje);
          }}
        />
        <ChipDeData
          rotulo={t.lancamento.ontem}
          selecionado={data === dataDeOntem}
          aoTocar={() => {
            aoMudarData(dataDeOntem);
          }}
        />

        <label className="min-w-0 flex-1">
          <span className="sr-only">{t.lancamento.outroDia}</span>
          <input
            type="date"
            value={data}
            onChange={aoDigitarData}
            className={`${CAMPO_TEXTO} ${outroDia ? 'border-marca-borda bg-marca-suave text-marca' : 'text-tinta-suave'}`}
          />
        </label>
      </div>

      {/* Confirmacao por extenso: o input de data mostra o dia no formato do
          navegador, que pode ser MM/DD. A linha abaixo nao tem essa ambiguidade. */}
      <p className="mt-1.5 text-xs text-tinta-fraca">{formatarDataComSemana(data)}</p>
    </div>
  );
}

interface ChipDeDataProps {
  rotulo: string;
  selecionado: boolean;
  aoTocar: () => void;
}

function ChipDeData({ rotulo, selecionado, aoTocar }: ChipDeDataProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={selecionado}
      className={`min-h-toque shrink-0 rounded-lg border px-4 text-sm font-medium transition-colors md:min-h-0 md:py-2 ${ANEL_FOCO} ${
        selecionado
          ? 'border-marca-borda bg-marca-suave text-marca'
          : 'border-superficie-borda bg-superficie text-tinta-suave md:hover:border-superficie-forte md:hover:text-tinta'
      }`}
    >
      {rotulo}
    </button>
  );
}
