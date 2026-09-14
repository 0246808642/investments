import { useCallback, useEffect, useRef, useState } from 'react';
import type * as React from 'react';

import { definirModoLocal, useModoLocal } from '../../api/modoLocal';
import { useSessao } from '../../hooks/useSessao';
import { useTravaScroll } from '../../hooks/useTravaScroll';
import { useTextos } from '../../i18n';
import { NOME_DO_APP } from '../../marca';
import { FormularioDeConta } from './FormularioDeConta';
import { MarcaDoApp } from './MarcaDoApp';
import { ANEL_FOCO, BOTAO_TEXTO } from './estilos';

/** Igual a duration-200 das classes; se mudar uma, mude a outra. */
const DURACAO_SAIDA = 200;

export interface FolhaDeContaProps {
  aoFechar: () => void;
  /**
   * Por que a folha abriu. Muda so a frase do topo: quem foi barrado tentando
   * lancar precisa saber que foi barrado, e nao achar que clicou errado.
   */
  motivo?: 'lancamento' | 'menu';
}

/**
 * Container da conta: bottom sheet em <md, modal centrado em md+ — o mesmo
 * desenho da folha de lancamento, porque sao o mesmo gesto do usuario.
 *
 * Logado, ela nao mostra o formulario: mostra quem esta logado e o botao de
 * sair. Um formulario de login exibido para quem ja entrou e um beco sem saida
 * com dois campos.
 */
export function FolhaDeConta({ aoFechar, motivo = 'menu' }: FolhaDeContaProps): React.JSX.Element {
  const { sessao, carregando, sair } = useSessao();
  const semConta = useModoLocal();
  const t = useTextos();

  const [visivel, setVisivel] = useState(false);
  const saindo = useRef<number | null>(null);

  useTravaScroll(true);

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

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.conta.suaConta}
        className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-folha bg-superficie shadow-folha transition duration-200 ease-out md:inset-0 md:m-auto md:h-fit md:max-h-[86vh] md:max-w-md md:rounded-xl md:shadow-modal ${
          visivel
            ? 'translate-y-0 md:translate-y-0 md:scale-100 md:opacity-100'
            : 'translate-y-full md:translate-y-1 md:scale-[0.98] md:opacity-0'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-superficie-borda md:hidden" />

        {/*
          Faixa de marca no lugar da linha vazia que so tinha o X. Um formulario
          de login sem nenhum sinal de QUAL produto e nao parece sobrio, parece
          inacabado — e este e o unico lugar do app onde a pessoa precisa
          confiar antes de digitar uma senha.
        */}
        <div className="flex items-center justify-between gap-3 border-b border-superficie-borda bg-superficie-fundo px-4 py-3 md:px-5">
          <p className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marca text-marca-contraste">
              <MarcaDoApp className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-semibold text-tinta">{NOME_DO_APP}</span>
          </p>

          <button
            type="button"
            onClick={fechar}
            aria-label={t.comum.fechar}
            className={`-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-superficie hover:text-tinta ${ANEL_FOCO}`}
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

        <div className="px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:px-5 md:pb-6">
          {carregando ? (
            <div className="h-56 animate-pulse rounded-lg bg-superficie-fundo" aria-hidden="true" />
          ) : sessao === null && semConta ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-base font-medium text-tinta">{t.conta.modoLocal}</h2>
                <p className="text-rotulo text-tinta-suave">{t.conta.modoLocalDetalhe}</p>
              </div>

              <FormularioDeConta modoInicial="entrar" aoConcluir={fechar} />

              <button
                type="button"
                onClick={() => {
                  definirModoLocal(false);
                  fechar();
                }}
                className={`${BOTAO_TEXTO} w-full border border-superficie-forte py-2.5 text-center`}
              >
                {t.conta.voltarAExigirConta}
              </button>
            </div>
          ) : sessao === null ? (
            <>
              {motivo === 'lancamento' ? (
                <p className="mb-4 rounded-lg border border-marca-borda bg-marca-suave px-3 py-2.5 text-rotulo font-medium text-marca">
                  {t.conta.precisaEntrar}
                </p>
              ) : null}
              <FormularioDeConta modoInicial="entrar" aoConcluir={fechar} focarAoMontar />

              {/*
                A saida sem conta fica DEPOIS do formulario e em peso menor: ela
                existe para nao travar quem esta sem rede, nao para competir com o
                caminho que leva os dados para outro aparelho.
              */}
              {semConta ? null : (
                <div className="mt-5 border-t border-superficie-borda pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      definirModoLocal(true);
                      fechar();
                    }}
                    className={`${BOTAO_TEXTO} w-full py-2 text-center`}
                  >
                    {t.conta.usarSemConta}
                  </button>
                  <p className="mt-1 text-center text-rotulo text-tinta-fraca">
                    {t.conta.semContaExplicacao}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-base font-medium text-tinta">{t.conta.suaConta}</h2>
                <p className="text-rotulo text-tinta-suave">
                  {t.conta.conectadoComo}{' '}
                  <span className="font-medium text-tinta">{sessao.email}</span>.
                </p>
              </div>

              <p className="rounded-lg bg-superficie-fundo px-3 py-2.5 text-rotulo text-tinta-suave">
                {t.conta.sairNaoApaga}
              </p>

              <button
                type="button"
                onClick={() => {
                  void sair().then(fechar);
                }}
                className={`${BOTAO_TEXTO} w-full border border-superficie-forte py-2.5 text-center`}
              >
                {t.conta.sair}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
