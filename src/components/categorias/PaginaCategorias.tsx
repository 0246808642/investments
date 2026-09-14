import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type * as React from 'react';

import {
  alternarFavorita,
  atualizarCategoria,
  contarUsosDaCategoria,
  criarCategoria,
  excluirCategoria,
  listarCategorias,
} from '../../db/consultas';
import type { Categoria, TipoMovimento } from '../../types';
import { MAXIMO_DE_CATEGORIAS } from '../../types';
import type { Textos } from '../../i18n';
import { useTextos } from '../../i18n';

const ANEL_FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

const CAMPO = `min-h-toque w-full rounded-lg border border-superficie-borda bg-superficie px-3 text-base text-tinta md:min-h-0 md:py-2 md:text-sm ${ANEL_FOCO}`;

/**
 * Paleta oferecida ao usuario. Todos os tons foram escolhidos na mesma faixa de
 * luminosidade: as cores precisam ler como UMA familia no grafico de categorias,
 * e precisam passar de 3:1 sobre branco — o ponto de 10px da legenda e pequeno
 * demais para depender de um tom claro.
 */
const PALETA: readonly string[] = [
  '#ea580c',
  '#b45309',
  '#0284c7',
  '#0e7490',
  '#7c3aed',
  '#db2777',
  '#be185d',
  '#047857',
  '#0f766e',
  '#57534e',
  '#37508f',
  '#64748b',
];

/**
 * Lista de categorias, separada por tipo.
 *
 * Duas secoes e nao uma lista com coluna "tipo": a categoria de saida e a de
 * entrada nunca aparecem juntas em lugar nenhum do app — o formulario de
 * lancamento mostra um conjunto de cada vez — e juntar as duas aqui inventaria
 * uma relacao que nao existe.
 *
 * Toda edicao acontece na propria linha. Abrir um modal para trocar uma cor faria
 * a pessoa perder de vista as outras onze cores, que sao exatamente o contexto
 * da escolha.
 */
export function PaginaCategorias(): React.JSX.Element {
  const categorias = useLiveQuery(() => listarCategorias(), []);
  const t = useTextos();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold text-tinta md:text-lg lg:text-xl">
          {t.categorias.titulo}
        </h1>
        <p className="mt-1 max-w-[60ch] text-sm text-tinta-suave">
          {t.categorias.explicacao(MAXIMO_DE_CATEGORIAS)}
        </p>
      </div>

      {categorias === undefined ? (
        <div className="h-64 animate-pulse rounded-xl bg-superficie" />
      ) : (
        <>
          <Secao
            titulo={t.categorias.saidas}
            tipo="saida"
            categorias={categorias.filter((categoria) => categoria.tipo === 'saida')}
          />
          <Secao
            titulo={t.categorias.entradas}
            tipo="entrada"
            categorias={categorias.filter((categoria) => categoria.tipo === 'entrada')}
          />
        </>
      )}
    </div>
  );
}

interface SecaoProps {
  titulo: string;
  tipo: TipoMovimento;
  categorias: readonly Categoria[];
}

function Secao({ titulo, tipo, categorias }: SecaoProps): React.JSX.Element {
  const [criando, setCriando] = useState(false);
  const t = useTextos();
  const noLimite = categorias.length >= MAXIMO_DE_CATEGORIAS;

  return (
    <section
      aria-label={`${t.categorias.titulo}: ${titulo}`}
      className="rounded-xl border border-superficie-borda bg-superficie"
    >
      <div className="flex items-center justify-between gap-3 border-b border-superficie-borda px-4 py-3 md:px-5">
        <h2 className="text-rotulo font-medium text-tinta-suave">
          {titulo}
          <span className="ml-2 tabular-nums text-tinta-fraca">
            {categorias.length}/{MAXIMO_DE_CATEGORIAS}
          </span>
        </h2>

        {/* No limite o botao sai e entra a explicacao. Botao cinza que nao
            responde faz a pessoa clicar de novo antes de entender por que. */}
        {criando ? null : noLimite ? (
          <p className="text-xs text-tinta-suave">{t.categorias.noLimite(MAXIMO_DE_CATEGORIAS)}</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCriando(true);
            }}
            className={`flex min-h-toque items-center rounded-lg px-2 text-sm font-medium text-marca md:min-h-0 md:py-1.5 md:hover:bg-marca-suave ${ANEL_FOCO}`}
          >
            {t.categorias.novaCategoria}
          </button>
        )}
      </div>

      {criando ? (
        <Editor
          nomeInicial=""
          corInicial={PALETA[0] ?? '#57534e'}
          rotuloDoBotao={t.categorias.criarCategoria}
          aoCancelar={() => {
            setCriando(false);
          }}
          aoConfirmar={async (nome, cor) => {
            await criarCategoria({ nome, cor, tipo, favorita: false });
            setCriando(false);
          }}
        />
      ) : null}

      {categorias.length === 0 && !criando ? (
        <p className="px-4 py-8 text-center text-sm text-tinta-suave md:px-5">
          {t.categorias.nenhumaDoTipo(titulo.toLocaleLowerCase())}
        </p>
      ) : (
        <ul className="divide-y divide-superficie-borda">
          {categorias.map((categoria) => (
            <Linha key={categoria.id} categoria={categoria} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface LinhaProps {
  categoria: Categoria;
}

type ModoDaLinha = 'lendo' | 'editando' | 'excluindo';

function Linha({ categoria }: LinhaProps): React.JSX.Element {
  const [modo, setModo] = useState<ModoDaLinha>('lendo');
  const usos = useLiveQuery(() => contarUsosDaCategoria(categoria.id), [categoria.id]);
  const t = useTextos();

  if (modo === 'editando') {
    return (
      <li>
        <Editor
          nomeInicial={categoria.nome}
          corInicial={categoria.cor}
          rotuloDoBotao={t.comum.salvar}
          aoCancelar={() => {
            setModo('lendo');
          }}
          aoConfirmar={async (nome, cor) => {
            await atualizarCategoria(categoria.id, { nome, cor });
            setModo('lendo');
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex min-h-toque items-center gap-3 px-4 py-3 md:px-5 md:py-2.5">
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 rounded-full"
        style={{ backgroundColor: categoria.cor }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-tinta">{categoria.nome}</p>
        <p className="text-xs tabular-nums text-tinta-fraca">
          {descreverUsos(usos, t)}
          {categoria.favorita ? t.categorias.vemPrimeiro : ''}
        </p>
      </div>

      {modo === 'excluindo' ? null : (
        <Estrela categoria={categoria} />
      )}

      {modo === 'excluindo' ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <p className="text-xs text-tinta-suave">
            {usos !== undefined && usos > 0
              ? t.categorias.lancamentosFicam
              : t.categorias.confirmarExclusao}
          </p>
          <button
            type="button"
            onClick={() => void excluirCategoria(categoria.id)}
            className={`min-h-toque rounded-lg bg-saida px-3 text-sm font-semibold text-superficie shadow-sm md:min-h-0 md:py-1.5 ${ANEL_FOCO}`}
          >
            {t.comum.excluir}
          </button>
          <button
            type="button"
            onClick={() => {
              setModo('lendo');
            }}
            className={`min-h-toque rounded-lg px-2 text-sm font-medium text-tinta-suave md:min-h-0 md:py-1.5 md:hover:text-tinta ${ANEL_FOCO}`}
          >
            {t.comum.cancelar}
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setModo('editando');
            }}
            className={`min-h-toque rounded-lg px-3 text-sm font-medium text-tinta-suave md:min-h-0 md:py-1.5 md:hover:bg-superficie-fundo md:hover:text-tinta ${ANEL_FOCO}`}
          >
            {t.comum.editar}
          </button>
          <button
            type="button"
            onClick={() => {
              setModo('excluindo');
            }}
            aria-label={t.extrato.excluirItem(categoria.nome)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-tinta-fraca md:hover:bg-superficie-fundo md:hover:text-saida ${ANEL_FOCO}`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </svg>
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Favorita e um estado de UMA categoria, entao o controle fica NA linha dela, e
 * nao numa tela de ordenacao a parte: a ordem da grade de lancamento e
 * consequencia, nao um segundo lugar para arrumar.
 *
 * `aria-pressed` e nao `checked`: e um botao que liga e desliga, nao um campo de
 * formulario esperando envio.
 */
function Estrela({ categoria }: { categoria: Categoria }): React.JSX.Element {
  const t = useTextos();
  const marcada = categoria.favorita;

  return (
    <button
      type="button"
      onClick={() => void alternarFavorita(categoria.id)}
      aria-pressed={marcada}
      aria-label={
        marcada ? t.categorias.desfavoritar(categoria.nome) : t.categorias.favoritar(categoria.nome)
      }
      title={marcada ? t.categorias.favoritaDica : t.categorias.favoritarDica}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${ANEL_FOCO} ${
        marcada ? 'text-marca' : 'text-tinta-fraca md:hover:bg-superficie-fundo md:hover:text-tinta'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill={marcada ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
      </svg>
    </button>
  );
}

interface EditorProps {
  nomeInicial: string;
  corInicial: string;
  rotuloDoBotao: string;
  aoCancelar: () => void;
  aoConfirmar: (nome: string, cor: string) => Promise<void>;
}

/** Mesmo editor para criar e para editar: sao o mesmo par de campos. */
function Editor({
  nomeInicial,
  corInicial,
  rotuloDoBotao,
  aoCancelar,
  aoConfirmar,
}: EditorProps): React.JSX.Element {
  const [nome, setNome] = useState(nomeInicial);
  const [cor, setCor] = useState(corInicial);
  const [salvando, setSalvando] = useState(false);
  const t = useTextos();

  const valido = nome.trim() !== '';

  function confirmar(): void {
    if (!valido || salvando) {
      return;
    }
    setSalvando(true);
    void aoConfirmar(nome, cor).finally(() => {
      setSalvando(false);
    });
  }

  return (
    <div className="border-b border-superficie-borda bg-superficie-fundo px-4 py-4 md:px-5">
      <label className="block">
        <span className="text-rotulo font-medium text-tinta-suave">{t.categorias.nome}</span>
        <input
          type="text"
          value={nome}
          autoFocus
          onChange={(evento) => {
            setNome(evento.target.value);
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') {
              evento.preventDefault();
              confirmar();
            }
          }}
          placeholder={t.categorias.exemploNome}
          className={`mt-1 ${CAMPO} placeholder:text-tinta-fraca`}
        />
      </label>

      <fieldset className="mt-3">
        <legend className="text-rotulo font-medium text-tinta-suave">{t.categorias.cor}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PALETA.map((opcao) => {
            const escolhida = opcao === cor;
            return (
              <button
                key={opcao}
                type="button"
                onClick={() => {
                  setCor(opcao);
                }}
                aria-pressed={escolhida}
                aria-label={t.categorias.corOpcao(opcao)}
                style={{ backgroundColor: opcao }}
                // O anel branco por dentro é o que separa a cor escolhida das
                // outras sem depender de contraste entre dois tons vizinhos.
                className={`h-9 w-9 rounded-full transition-transform ${ANEL_FOCO} ${
                  escolhida
                    ? 'ring-2 ring-tinta ring-offset-2 ring-offset-superficie-fundo'
                    : 'md:hover:scale-110'
                }`}
              />
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={!valido || salvando}
          className={`min-h-toque rounded-lg bg-marca px-4 text-sm font-semibold text-marca-contraste shadow-sm transition-colors hover:bg-marca-forte disabled:bg-superficie-borda disabled:text-tinta-suave disabled:shadow-none md:min-h-0 md:py-2 ${ANEL_FOCO}`}
        >
          {valido ? rotuloDoBotao : t.categorias.deUmNome}
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          className={`min-h-toque rounded-lg px-3 text-sm font-medium text-tinta-suave md:min-h-0 md:py-2 md:hover:text-tinta ${ANEL_FOCO}`}
        >
          {t.comum.cancelar}
        </button>
      </div>
    </div>
  );
}

function descreverUsos(usos: number | undefined, t: Textos): string {
  if (usos === undefined) {
    return '—';
  }
  return usos === 0 ? t.categorias.semLancamentos : t.comum.lancamentos(usos);
}
