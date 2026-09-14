import { useEffect, useRef } from 'react';
import type { Centavos, TipoMovimento } from '../../types';
import { centavos, formatarMoeda, ZERO } from '../../types';

/** 999.999.999,99 — teto do que cabe com folga em Number.isSafeInteger. */
const MAX_DIGITOS = 11;

export interface CampoValorProps {
  valor: Centavos;
  aoMudar: (valor: Centavos) => void;
  tipo: TipoMovimento;
}

/**
 * Acumulador de digitos: o estado e um inteiro de centavos e o campo exibe
 * formatarMoeda(estado). Cada tecla vira "pega todos os digitos do texto e
 * reconstroi o inteiro", entao digitar 1,2,5,0 preenche da direita ate
 * R$ 12,50 e o backspace so remove o ultimo digito. Nao existe virgula para o
 * usuario errar — e o que segura o lancamento abaixo de 10 segundos.
 */
export function CampoValor({ valor, aoMudar, tipo }: CampoValorProps): React.JSX.Element {
  const campo = useRef<HTMLInputElement>(null);

  // Foco ao abrir a folha: o teclado ja sobe com o cursor no valor.
  useEffect(() => {
    const elemento = campo.current;
    if (elemento === null) {
      return;
    }
    elemento.focus();
    elemento.setSelectionRange(elemento.value.length, elemento.value.length);
  }, []);

  function aoDigitar(evento: React.ChangeEvent<HTMLInputElement>): void {
    const digitos = evento.target.value
      .replace(/\D/g, '')
      .replace(/^0+/, '')
      .slice(0, MAX_DIGITOS);
    aoMudar(digitos === '' ? ZERO : centavos(Number(digitos)));
  }

  // O texto e formatado: se o cursor parar no meio, a proxima tecla entraria
  // entre os digitos. Ancorar no fim mantem o preenchimento da direita.
  function manterCursorNoFim(evento: React.SyntheticEvent<HTMLInputElement>): void {
    const elemento = evento.currentTarget;
    const fim = elemento.value.length;
    if (elemento.selectionStart !== fim || elemento.selectionEnd !== fim) {
      elemento.setSelectionRange(fim, fim);
    }
  }

  const corDoValor = tipo === 'entrada' ? 'text-entrada' : 'text-saida';

  return (
    <label className="block">
      <span className="text-sm font-medium text-tinta-suave">Valor</span>
      <input
        ref={campo}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        aria-label="Valor do lançamento"
        value={formatarMoeda(valor)}
        onChange={aoDigitar}
        onSelect={manterCursorNoFim}
        onFocus={manterCursorNoFim}
        onClick={manterCursorNoFim}
        className={`mt-1 w-full bg-transparent text-4xl font-bold tabular-nums tracking-tight outline-none ${corDoValor}`}
      />
    </label>
  );
}
