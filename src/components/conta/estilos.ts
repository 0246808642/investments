/**
 * Classes compartilhadas das pecas de conta. Existem como constante porque o
 * anel de foco e o campo de texto ja foram definidos em lancamento/ e repetir a
 * string a mao em quatro arquivos e como o rotulo diverge.
 */

export const ANEL_FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

/**
 * Alvo de 44px com dedo (<md) e relaxado em md+. text-base e obrigatorio em
 * <md: abaixo de 16px o iOS da auto-zoom ao focar o campo.
 */
export const CAMPO_TEXTO = `min-h-toque mt-1.5 w-full rounded-lg border border-superficie-borda bg-superficie px-3 text-base text-tinta placeholder:text-tinta-fraca md:min-h-0 md:py-2 md:text-sm ${ANEL_FOCO}`;

/**
 * Acao primaria. Mesmo indigo do resto do app: num conteudo que e quase todo
 * cinza, branco e numero, o quase-preto nao destacava a acao — ele se confundia
 * com o proprio texto.
 */
export const BOTAO_PRIMARIO = `min-h-toque w-full rounded-lg bg-marca px-4 text-base font-semibold text-marca-contraste shadow-sm transition-colors hover:bg-marca-forte disabled:bg-superficie-borda disabled:text-tinta-suave disabled:shadow-none md:min-h-0 md:py-2.5 md:text-sm ${ANEL_FOCO}`;

/** Acao secundaria em texto (trocar de modo, sair, ver detalhes). */
export const BOTAO_TEXTO = `rounded-md px-2 py-1.5 text-rotulo font-medium text-tinta-suave transition-colors hover:bg-superficie-fundo hover:text-tinta ${ANEL_FOCO}`;
