/**
 * Dinheiro e SEMPRE inteiro em centavos. O branded type impede que um number
 * qualquer (resultado de parseFloat, de uma divisao, de um input) entre no banco
 * sem passar por um dos construtores daqui.
 *
 *   const errado: Centavos = 12.5;        // erro de compilacao
 *   const certo = parseMoeda('12,50');    // Centavos = 1250
 */
export type Centavos = number & { readonly __brand: 'Centavos' };

/** Unico ponto de entrada para virar Centavos. Recusa float e valor fora do range seguro. */
export function centavos(valor: number): Centavos {
  if (!Number.isSafeInteger(valor)) {
    throw new Error(`Valor monetario precisa ser inteiro em centavos; recebido ${valor}`);
  }
  return valor as Centavos;
}

export const ZERO: Centavos = centavos(0);

export function somarLista(valores: readonly Centavos[]): Centavos {
  return centavos(valores.reduce<number>((total, valor) => total + valor, 0));
}

export function somar(...valores: readonly Centavos[]): Centavos {
  return somarLista(valores);
}

export function subtrair(a: Centavos, b: Centavos): Centavos {
  return centavos(a - b);
}

export function negar(valor: Centavos): Centavos {
  return centavos(-valor);
}

/** Insere o ponto de milhar sem converter para float. */
function agruparMilhares(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formata o valor absoluto trabalhando so com string: nenhuma divisao, nenhum float. */
function formatarAbsoluto(absoluto: number): string {
  const digitos = absoluto.toString().padStart(3, '0');
  return `${agruparMilhares(digitos.slice(0, -2))},${digitos.slice(-2)}`;
}

/**
 * Sinal de menos tipografico (U+2212), nao hifen. O hifen e mais estreito que os
 * digitos e serrilha a coluna de valores quando a fonte esta em tabular-nums.
 */
export const MENOS = '−';

/** 123456 -> "R$ 1.234,56" ; -500 -> "−R$ 5,00" */
export function formatarMoeda(valor: Centavos): string {
  return `${valor < 0 ? MENOS : ''}R$ ${formatarAbsoluto(Math.abs(valor))}`;
}

/** Mesma coisa sem o simbolo: 123456 -> "1.234,56". Para campos de input. */
export function formatarMoedaSemSimbolo(valor: Centavos): string {
  return `${valor < 0 ? MENOS : ''}${formatarAbsoluto(Math.abs(valor))}`;
}

/**
 * Forma curta para onde nao cabe o valor inteiro — a celula do calendario em
 * telas grandes. 34000 -> "340" ; -120000 -> "−1,2k" ; 0 -> "".
 * Arredonda para baixo de proposito: e indicador de magnitude, nao extrato.
 */
export function formatarCompacto(valor: Centavos): string {
  if (valor === 0) {
    return '';
  }
  const sinal = valor < 0 ? MENOS : '+';
  const reais = Math.trunc(Math.abs(valor) / 100);

  if (reais === 0) {
    // Abaixo de um real, "0" leria como "nao houve movimento". Mostra os centavos.
    const centavosRestantes = (Math.abs(valor) % 100).toString().padStart(2, '0');
    return `${sinal}0,${centavosRestantes}`;
  }

  if (reais < 1000) {
    return `${sinal}${reais.toString()}`;
  }

  const escala = reais < 1000000 ? { divisor: 1000, sufixo: 'k' } : { divisor: 1000000, sufixo: 'M' };
  const decimos = Math.trunc((reais * 10) / escala.divisor);
  const inteiro = Math.trunc(decimos / 10);
  const decimo = decimos % 10;
  const fracao = decimo === 0 ? '' : `,${decimo.toString()}`;
  return `${sinal}${inteiro.toString()}${fracao}${escala.sufixo}`;
}

/**
 * Le o que o usuario digitou no teclado decimal do celular.
 *
 * Regra: o ultimo separador (, ou .) e decimal quando tem 1 ou 2 digitos depois
 * dele; caso contrario todos os separadores sao de milhar. Isso torna o
 * resultado previsivel nos dois estilos de digitacao:
 *
 *   "12,50"    -> 1250      "12.5"     -> 1250
 *   "1.234,56" -> 123456    "1,234.56" -> 123456
 *   "1.500"    -> 150000    "1500"     -> 150000
 *   "12,"      -> 1200      ""         -> 0
 */
export function parseMoeda(texto: string): Centavos {
  // Aceita tanto o hifen digitado quanto o U+2212 que formatarMoeda emite.
  const limpo = texto.replace(/[^\d.,\-−]/g, '');
  const negativo = /^[-−]/.test(limpo.trimStart());
  const corpo = limpo.replace(/[-−]/g, '');

  const ultimoSeparador = Math.max(corpo.lastIndexOf(','), corpo.lastIndexOf('.'));
  const casasDepois = ultimoSeparador === -1 ? -1 : corpo.length - ultimoSeparador - 1;
  const temDecimal = casasDepois === 1 || casasDepois === 2;

  const somenteDigitos = (trecho: string): string => trecho.replace(/\D/g, '');
  const parteInteira = somenteDigitos(temDecimal ? corpo.slice(0, ultimoSeparador) : corpo);
  const parteDecimal = temDecimal
    ? somenteDigitos(corpo.slice(ultimoSeparador + 1)).padEnd(2, '0').slice(0, 2)
    : '00';

  const total = Number(parteInteira || '0') * 100 + Number(parteDecimal);
  if (!Number.isSafeInteger(total)) {
    return ZERO;
  }
  return centavos(negativo ? -total : total);
}
