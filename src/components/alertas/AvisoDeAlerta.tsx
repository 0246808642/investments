import { useEffect, useRef } from 'react';
import type * as React from 'react';

import { marcarAviso } from '../../db/alertas';
import { useAlertas } from '../../hooks/useAlertas';
import { notificar } from '../../notificacoes/notificacoes';
import { idiomaAtual, useTextos } from '../../i18n';
import { formatarMesNome, formatarMoeda, subtrair } from '../../types';
import { useAbrirAlertas } from './useAbrirAlertas';

interface AvisoDeAlertaProps {
  className?: string;
}

/**
 * O aviso na tela E o vigia que dispara a notificacao do sistema.
 *
 * Os dois moram juntos porque leem exatamente o mesmo estado; separados, seriam
 * duas assinaturas do banco decidindo por conta propria a mesma coisa, e um dia
 * uma delas diria "estourou" enquanto a outra ainda nao.
 *
 * O aviso na tela NAO e dispensavel: ele nao e a notificacao que ja passou, e o
 * estado atual do limite. Enquanto o mes estiver acima do teto, esconder a barra
 * seria esconder um fato. A notificacao, essa sim, sai uma vez so por estouro.
 */
export function AvisoDeAlerta({ className = '' }: AvisoDeAlertaProps): React.JSX.Element | null {
  const { configuracao, carregando, mesVigente, gastosDoMes, saldo, tetoEstourado, pisoRompido } =
    useAlertas();
  const abrir = useAbrirAlertas();
  const t = useTextos();

  // Trava de reentrada: marcar o aviso escreve no banco, o useLiveQuery reexecuta
  // e o efeito roda de novo. Sem a trava, a janela entre disparar e a marca ficar
  // visivel deixaria passar uma segunda notificacao identica.
  const processando = useRef(false);

  useEffect(() => {
    if (carregando || processando.current) {
      return;
    }

    const tetoJaAvisado = configuracao.tetoAvisadoEm === mesVigente;
    const precisaAvisarTeto = tetoEstourado && !tetoJaAvisado;
    const precisaRearmarTeto = !tetoEstourado && configuracao.tetoAvisadoEm !== null;
    const precisaAvisarPiso = pisoRompido && !configuracao.pisoAvisado;
    const precisaRearmarPiso = !pisoRompido && configuracao.pisoAvisado;

    if (!precisaAvisarTeto && !precisaRearmarTeto && !precisaAvisarPiso && !precisaRearmarPiso) {
      return;
    }

    processando.current = true;

    void (async () => {
      try {
        if (precisaAvisarTeto) {
          const excedente = subtrair(gastosDoMes, configuracao.teto.valor);
          await notificar({
            tag: 'teto-de-gastos',
            titulo: t.alertas.notificacaoTeto,
            corpo: t.alertas.notificacaoTetoCorpo(
              nomeCapitalizado(mesVigente),
              formatarMoeda(gastosDoMes),
              formatarMoeda(excedente),
            ),
          });
          await marcarAviso({ tetoAvisadoEm: mesVigente });
        } else if (precisaRearmarTeto) {
          await marcarAviso({ tetoAvisadoEm: null });
        }

        if (precisaAvisarPiso) {
          await notificar({
            tag: 'saldo-minimo',
            titulo: t.alertas.notificacaoPiso,
            corpo: t.alertas.notificacaoPisoCorpo(
              formatarMoeda(saldo),
              formatarMoeda(configuracao.piso.valor),
            ),
          });
          await marcarAviso({ pisoAvisado: true });
        } else if (precisaRearmarPiso) {
          await marcarAviso({ pisoAvisado: false });
        }
      } finally {
        processando.current = false;
      }
    })();
  }, [carregando, configuracao, mesVigente, gastosDoMes, saldo, tetoEstourado, pisoRompido, t]);

  if (!tetoEstourado && !pisoRompido) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {tetoEstourado ? (
        <Barra
          titulo={t.alertas.tetoEstourado(formatarMesNome(mesVigente))}
          detalhe={t.alertas.tetoDetalhe(
            formatarMoeda(gastosDoMes),
            formatarMoeda(configuracao.teto.valor),
            formatarMoeda(subtrair(gastosDoMes, configuracao.teto.valor)),
          )}
          aoAjustar={abrir}
        />
      ) : null}

      {pisoRompido ? (
        <Barra
          titulo={t.alertas.pisoRompido}
          detalhe={t.alertas.pisoDetalhe(
            formatarMoeda(saldo),
            formatarMoeda(configuracao.piso.valor),
          )}
          aoAjustar={abrir}
        />
      ) : null}
    </div>
  );
}

interface BarraProps {
  titulo: string;
  detalhe: string;
  aoAjustar: () => void;
}

/**
 * `role="status"` e nao `alert`: o leitor de tela anuncia quando chegar num
 * intervalo, sem interromper o que a pessoa esta fazendo. `alert` e para o que
 * exige acao imediata, e aqui nao ha nada a fazer no ato.
 */
function Barra({ titulo, detalhe, aoAjustar }: BarraProps): React.JSX.Element {
  const t = useTextos();

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-saida-borda bg-saida-suave px-4 py-3 md:px-5"
    >
      <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-md bg-saida" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-saida-forte">{titulo}</p>
        <p className="mt-0.5 text-sm tabular-nums text-tinta-suave">{detalhe}</p>
      </div>

      <button
        type="button"
        onClick={aoAjustar}
        className="flex min-h-toque shrink-0 items-center rounded-lg border border-saida-borda bg-superficie px-3 text-sm font-medium text-saida-forte md:min-h-0 md:py-1.5 md:hover:bg-saida-suave focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
      >
        {t.alertas.ajustar}
      </button>
    </div>
  );
}

/** "setembro" -> "Setembro". A classe capitalize do CSS subiria toda palavra. */
function nomeCapitalizado(mes: Parameters<typeof formatarMesNome>[0]): string {
  const nome = formatarMesNome(mes);
  return nome.charAt(0).toLocaleUpperCase(idiomaAtual()) + nome.slice(1);
}
