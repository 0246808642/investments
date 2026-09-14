import { db } from './db';
import type { Centavos, MesISO } from '../types';
import { ZERO } from '../types';

/** Chave do registro unico da tabela `alertas`. */
export const CHAVE_ALERTAS = 'alertas';

export interface Limite {
  ativo: boolean;
  valor: Centavos;
}

/**
 * Os dois limites do app e a memoria de quem ja foi avisado.
 *
 * As duas marcas de "ja avisei" existem para o alerta nao virar ruido: sem elas
 * cada lancamento novo depois do estouro dispararia uma notificacao igual, e em
 * duas horas a pessoa desliga o alerta inteiro. Elas tambem se desfazem sozinhas
 * quando a condicao deixa de valer — excluir um lancamento e voltar para baixo
 * do teto rearma o aviso para o proximo estouro de verdade.
 */
export interface ConfiguracaoDeAlertas {
  chave: typeof CHAVE_ALERTAS;
  /** Teto de SAIDAS do mes corrente. Reinicia sozinho na virada do mes. */
  teto: Limite;
  /** Piso do saldo acumulado. Nao tem recorte de mes: vale sempre. */
  piso: Limite;
  /** Mes cujo estouro de teto ja foi notificado; null enquanto nao estourou. */
  tetoAvisadoEm: MesISO | null;
  /** True enquanto o saldo estiver abaixo do piso E o aviso ja tiver saido. */
  pisoAvisado: boolean;
}

export const ALERTAS_PADRAO: ConfiguracaoDeAlertas = {
  chave: CHAVE_ALERTAS,
  teto: { ativo: false, valor: ZERO },
  piso: { ativo: false, valor: ZERO },
  tetoAvisadoEm: null,
  pisoAvisado: false,
};

export async function lerAlertas(): Promise<ConfiguracaoDeAlertas> {
  const guardado = await db.alertas.get(CHAVE_ALERTAS);
  return guardado ?? ALERTAS_PADRAO;
}

/**
 * Grava os limites escolhidos pelo usuario e REARMA os dois avisos.
 *
 * Rearmar aqui e deliberado: quem acabou de mexer no limite esta olhando para a
 * tela e quer o resultado da mudanca. Manter a marca antiga faria um teto novo,
 * ja estourado, ficar mudo por ter avisado sobre o teto anterior.
 */
export async function salvarLimites(teto: Limite, piso: Limite): Promise<void> {
  await db.alertas.put({
    chave: CHAVE_ALERTAS,
    teto,
    piso,
    tetoAvisadoEm: null,
    pisoAvisado: false,
  });
}

/** Marca de "ja avisei". Escrita so pelo vigia, nunca pela tela de configuracao. */
export async function marcarAviso(
  marcas: Partial<Pick<ConfiguracaoDeAlertas, 'tetoAvisadoEm' | 'pisoAvisado'>>,
): Promise<void> {
  const atual = await lerAlertas();
  await db.alertas.put({ ...atual, ...marcas });
}
