import type * as React from 'react';

import { sincronizarAgora } from '../../api/sincronizador';
import { useSincronizacao } from '../../hooks/useSincronizacao';
import type { Textos } from '../../i18n';
import { useTextos } from '../../i18n';
import { formatarInstante } from '../../types';
import { ANEL_FOCO, BOTAO_TEXTO } from './estilos';

/**
 * O estado da copia no servidor, dentro da folha de conta.
 *
 * Fica aqui e nao na barra do app de proposito: sincronizacao que funciona nao
 * tem nada a dizer, e um indicador permanente na barra gastaria espaco fixo para
 * mostrar "ok" o tempo todo. Quem abre esta folha esta perguntando exatamente
 * isto — "meus lancamentos estao guardados?" — e e aqui que a resposta cabe.
 *
 * O botao de sincronizar agora existe para o caso em que a pessoa NAO confia no
 * automatico (acabou de voltar a rede, quer ver a fila zerar antes de fechar o
 * app). Ele nao e o caminho normal: o ciclo roda sozinho a cada escrita, a cada
 * volta ao primeiro plano e a cada cinco minutos.
 */
export function PainelDeSincronizacao(): React.JSX.Element {
  const { situacao, falha, pendentes, ultimaEm, carregando } = useSincronizacao();
  const t = useTextos();

  const sincronizando = situacao === 'sincronizando';
  const quando = ultimaEm === null ? '' : formatarInstante(ultimaEm);

  return (
    <div className="rounded-lg border border-superficie-borda px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-rotulo font-medium text-tinta">{t.conta.sincronizacao}</h3>
        <button
          type="button"
          disabled={sincronizando}
          onClick={() => {
            void sincronizarAgora();
          }}
          className={`${BOTAO_TEXTO} shrink-0 disabled:text-tinta-fraca disabled:hover:bg-transparent ${ANEL_FOCO}`}
        >
          {t.conta.sincronizarAgora}
        </button>
      </div>

      {/* aria-live: a fila zerando enquanto a folha esta aberta e informacao, e
          quem usa leitor de tela nao tem como perceber isso sozinho. */}
      <p aria-live="polite" className={`text-rotulo ${falha === null ? 'text-tinta-suave' : 'text-saida'}`}>
        {carregando ? ' ' : linhaDeEstado({ sincronizando, falha, pendentes, textos: t })}
      </p>

      <p className="mt-0.5 text-rotulo text-tinta-fraca">
        {quando === '' ? t.conta.nuncaSincronizou : t.conta.sincronizadoEm(quando)}
      </p>
    </div>
  );
}

interface LinhaDeEstadoArgs {
  sincronizando: boolean;
  falha: ReturnType<typeof useSincronizacao>['falha'];
  pendentes: number;
  textos: Textos;
}

/**
 * Uma frase so, na ordem do que a pessoa precisa saber: o que esta acontecendo
 * agora, o que impediu, o que falta, e — quando nao ha nada disso — que esta
 * tudo guardado.
 */
function linhaDeEstado({ sincronizando, falha, pendentes, textos: t }: LinhaDeEstadoArgs): string {
  if (sincronizando) {
    return t.conta.sincronizando;
  }

  switch (falha) {
    case 'rede':
      return t.conta.erroRede;
    case 'servidor':
      return t.conta.erroServidor;
    case 'naoAutorizado':
      return t.conta.sessaoCaiu;
    case 'requisicaoInvalida':
    case 'respostaInvalida':
      return t.conta.erroResposta;
    case null:
      break;
  }

  return pendentes > 0 ? t.conta.esperandoEnvio(pendentes) : t.conta.tudoSincronizado;
}
