/**
 * O nome do produto, em UM lugar.
 *
 * Ele aparecia escrito a mao em quatro arquivos — sidebar, barra superior, folha
 * de conta e folha de impressao — com um comentario em dois deles dizendo que a
 * fonte unica era o <title> do index.html, o que nunca foi verdade. Renomear o
 * app exigia achar as quatro copias e nao esquecer nenhuma.
 *
 * NAO e traduzido: nome de produto nao muda de idioma. Por isso mora aqui, e nao
 * no dicionario de `src/i18n`.
 *
 * Os dois lugares que NAO conseguem importar daqui sao `index.html` (<title>) e
 * `public/manifest.webmanifest` — HTML e JSON estaticos, lidos antes de qualquer
 * modulo. Esses dois precisam ser trocados a mao junto com este arquivo.
 */
export const NOME_DO_APP = 'Investments';
