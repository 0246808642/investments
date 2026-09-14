import { useCallback, useEffect, useRef, useState } from 'react';

import type { Limite } from '../../db/alertas';
import { salvarLimites } from '../../db/alertas';
import { useAlertas } from '../../hooks/useAlertas';
import { useTravaScroll } from '../../hooks/useTravaScroll';
import { useTextos } from '../../i18n';
import type { EstadoDaPermissao } from '../../notificacoes/notificacoes';
import { estadoDaPermissao, pedirPermissao } from '../../notificacoes/notificacoes';
import type { Centavos } from '../../types';
import { ZERO, centavos, formatarMoeda } from '../../types';

/** Igual a duration-200 das classes; se mudar uma, mude a outra. */
const DURACAO_SAIDA = 200;

const ANEL_FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

/** 999.999.999,99 — teto do que cabe com folga em Number.isSafeInteger. */
const MAX_DIGITOS = 11;

export interface FolhaAlertasProps {
  aoFechar: () => void;
}

/**
 * Configuracao dos dois limites.
 *
 * Cada limite e uma linha com chave liga/desliga e valor. Desligado, o campo
 * some em vez de ficar cinza: campo desabilitado ainda ocupa a mesma altura e
 * ainda parece que da para digitar.
 *
 * A permissao de notificacao e pedida DAQUI, num clique explicito, e nunca no
 * carregamento do app — caixa de permissao que aparece sozinha e respondida com
 * "bloquear", e bloqueio a pagina nao consegue desfazer.
 */
export function FolhaAlertas({ aoFechar }: FolhaAlertasProps): React.JSX.Element {
  const { configuracao, carregando } = useAlertas();
  const t = useTextos();

  const [visivel, setVisivel] = useState(false);
  const [teto, setTeto] = useState<Limite | null>(null);
  const [piso, setPiso] = useState<Limite | null>(null);
  const [permissao, setPermissao] = useState<EstadoDaPermissao>(estadoDaPermissao);
  const [salvando, setSalvando] = useState(false);

  const saindo = useRef<number | null>(null);
  const dialogo = useRef<HTMLFormElement>(null);

  useTravaScroll(true);

  useEffect(() => {
    const quadro = requestAnimationFrame(() => setVisivel(true));
    return () => cancelAnimationFrame(quadro);
  }, []);

  // Semeia o formulario na PRIMEIRA leitura e nunca mais: depois disso quem
  // manda e o que a pessoa esta digitando, e um novo quadro do useLiveQuery
  // (disparado por qualquer escrita no banco) apagaria o que ela digitou.
  useEffect(() => {
    if (carregando || teto !== null) {
      return;
    }
    setTeto(configuracao.teto);
    setPiso(configuracao.piso);
  }, [carregando, configuracao, teto]);

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

  async function autorizarNotificacao(): Promise<void> {
    setPermissao(await pedirPermissao());
  }

  const pronto = teto !== null && piso !== null;
  // Limite ligado sem valor nao alerta nunca: o que a pessoa configurou nao
  // aconteceria, e ela so descobriria no mes em que contava com o aviso.
  const faltaValor =
    pronto && ((teto.ativo && teto.valor === ZERO) || (piso.ativo && piso.valor === ZERO));

  async function salvar(): Promise<void> {
    if (!pronto || faltaValor || salvando) {
      return;
    }
    setSalvando(true);
    await salvarLimites(teto, piso);
    fechar();
  }

  function aoEnviar(evento: React.FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    void salvar();
  }

  return (
    <div className="fixed inset-0 z-50">
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
        role="dialog"
        aria-modal="true"
        aria-label={t.alertas.titulo}
        className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-folha bg-superficie shadow-folha transition duration-200 ease-out md:inset-0 md:m-auto md:h-fit md:max-h-[86vh] md:max-w-lg md:rounded-xl md:shadow-modal ${
          visivel
            ? 'translate-y-0 md:translate-y-0 md:scale-100 md:opacity-100'
            : 'translate-y-full md:translate-y-1 md:scale-[0.98] md:opacity-0'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-superficie-borda md:hidden" />

        <div className="flex items-center justify-between px-4 pt-4 md:px-5">
          <h2 className="text-base font-medium text-tinta">{t.alertas.titulo}</h2>
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

        <p className="px-4 pt-1 text-sm text-tinta-suave md:px-5">{t.alertas.explicacao}</p>

        <div className="space-y-4 px-4 pt-5 md:px-5">
          {teto === null || piso === null ? (
            <div className="h-48 animate-pulse rounded-lg bg-superficie-fundo" aria-hidden="true" />
          ) : (
            <>
              <BlocoDeLimite
                titulo={t.alertas.teto}
                explicacao={t.alertas.tetoExplicacao}
                limite={teto}
                aoMudar={setTeto}
              />
              <BlocoDeLimite
                titulo={t.alertas.piso}
                explicacao={t.alertas.pisoExplicacao}
                limite={piso}
                aoMudar={setPiso}
              />
            </>
          )}

          <AvisoDePermissao permissao={permissao} aoAutorizar={() => void autorizarNotificacao()} />
        </div>

        <div className="sticky bottom-0 mt-5 border-t border-superficie-borda bg-superficie px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-5 md:pb-4">
          <button
            type="submit"
            disabled={!pronto || faltaValor || salvando}
            className={`min-h-toque w-full rounded-lg bg-marca text-base font-semibold text-marca-contraste shadow-sm transition-colors hover:bg-marca-forte disabled:bg-superficie-fundo disabled:text-tinta-suave disabled:shadow-none md:min-h-0 md:py-2.5 md:text-sm ${ANEL_FOCO}`}
          >
            {faltaValor ? t.alertas.defina : salvando ? t.comum.salvando : t.alertas.salvar}
          </button>
        </div>
      </form>
    </div>
  );
}

interface BlocoDeLimiteProps {
  titulo: string;
  explicacao: string;
  limite: Limite;
  aoMudar: (limite: Limite) => void;
}

function BlocoDeLimite({
  titulo,
  explicacao,
  limite,
  aoMudar,
}: BlocoDeLimiteProps): React.JSX.Element {
  const t = useTextos();

  return (
    <div className="rounded-lg border border-superficie-borda p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-tinta">{titulo}</p>
          <p className="mt-0.5 text-xs text-tinta-suave">{explicacao}</p>
        </div>
        <Chave
          ligado={limite.ativo}
          rotulo={titulo}
          aoAlternar={() => {
            aoMudar({ ...limite, ativo: !limite.ativo });
          }}
        />
      </div>

      {limite.ativo ? (
        <CampoDeLimite
          valor={limite.valor}
          rotulo={t.alertas.valorDoLimite(titulo)}
          aoMudar={(valor) => {
            aoMudar({ ...limite, valor });
          }}
        />
      ) : null}
    </div>
  );
}

interface ChaveProps {
  ligado: boolean;
  rotulo: string;
  aoAlternar: () => void;
}

/** Interruptor. `role="switch"` e o que faz o leitor de tela falar "ligado/desligado". */
function Chave({ ligado, rotulo, aoAlternar }: ChaveProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={aoAlternar}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${ANEL_FOCO} ${
        ligado ? 'bg-marca' : 'bg-superficie-forte'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-superficie transition-all ${
          ligado ? 'left-[1.375rem]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

interface CampoDeLimiteProps {
  valor: Centavos;
  rotulo: string;
  aoMudar: (valor: Centavos) => void;
}

/**
 * Mesmo acumulador de digitos do campo de valor do lancamento: o estado e um
 * inteiro de centavos e o campo mostra formatarMoeda dele. Duas gramaticas
 * diferentes para digitar dinheiro no mesmo app seria uma a mais.
 */
function CampoDeLimite({ valor, rotulo, aoMudar }: CampoDeLimiteProps): React.JSX.Element {
  function aoDigitar(evento: React.ChangeEvent<HTMLInputElement>): void {
    const digitos = evento.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITOS);
    aoMudar(digitos === '' ? ZERO : centavos(Number(digitos)));
  }

  function manterCursorNoFim(evento: React.SyntheticEvent<HTMLInputElement>): void {
    const elemento = evento.currentTarget;
    const fim = elemento.value.length;
    if (elemento.selectionStart !== fim || elemento.selectionEnd !== fim) {
      elemento.setSelectionRange(fim, fim);
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={rotulo}
      value={formatarMoeda(valor)}
      onChange={aoDigitar}
      onSelect={manterCursorNoFim}
      onFocus={manterCursorNoFim}
      onClick={manterCursorNoFim}
      className={`min-h-toque mt-3 w-full rounded-lg border border-superficie-borda bg-superficie px-3 text-xl font-semibold tabular-nums slashed-zero text-tinta md:min-h-0 md:py-2 ${ANEL_FOCO}`}
    />
  );
}

interface AvisoDePermissaoProps {
  permissao: EstadoDaPermissao;
  aoAutorizar: () => void;
}

/** Diz o que o usuario ganha e o que ele perde, em vez de "notificações: off". */
function AvisoDePermissao({
  permissao,
  aoAutorizar,
}: AvisoDePermissaoProps): React.JSX.Element | null {
  const t = useTextos();

  if (permissao === 'indisponivel') {
    return <p className="text-xs text-tinta-suave">{t.alertas.semSuporte}</p>;
  }

  if (permissao === 'concedida') {
    return <p className="text-xs text-tinta-suave">{t.alertas.concedida}</p>;
  }

  if (permissao === 'negada') {
    return <p className="text-xs text-tinta-suave">{t.alertas.negada}</p>;
  }

  return (
    <div className="rounded-lg bg-superficie-fundo p-3">
      <p className="text-xs text-tinta-suave">{t.alertas.pendente}</p>
      <button
        type="button"
        onClick={aoAutorizar}
        className={`mt-2 flex min-h-toque items-center rounded-lg border border-superficie-forte bg-superficie px-3 text-sm font-medium text-tinta md:min-h-0 md:py-1.5 md:hover:bg-superficie-fundo ${ANEL_FOCO}`}
      >
        {t.alertas.autorizar}
      </button>
    </div>
  );
}
