import { useState } from 'react';
import type { Transacao } from '../../types';
import { BotaoFlutuante } from './BotaoFlutuante';
import { FolhaLancamento } from './FolhaLancamento';

export interface NovoLancamentoProps {
  /** Opcional: recebe a transacao recem gravada, para toast ou scroll. */
  aoLancar?: (transacao: Transacao) => void;
}

/**
 * Unidade que o App monta: FAB + folha, com o aberto/fechado por conta propria.
 * A folha so existe no DOM quando aberta, entao cada lancamento comeca do
 * zero — sem valor nem categoria sobrando do anterior.
 */
export function NovoLancamento({ aoLancar }: NovoLancamentoProps): React.JSX.Element {
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <BotaoFlutuante aoTocar={() => setAberta(true)} />
      {aberta ? (
        <FolhaLancamento
          aoFechar={() => setAberta(false)}
          {...(aoLancar === undefined ? {} : { aoLancar })}
        />
      ) : null}
    </>
  );
}
