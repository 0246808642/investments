/**
 * Falhas do cliente HTTP como uniao fechada. Sao quatro situacoes que a UI trata
 * de forma diferente e que um `Error` generico embaralharia:
 *
 * - 'rede': o servidor nao foi alcancado. Nada foi enviado, nada se perdeu;
 *   repetir mais tarde resolve. E o caso do app aberto no metro.
 * - 'naoAutorizado' (401): o token morreu ou nunca existiu. Repetir NAO resolve
 *   enquanto nao houver login novo — por isso a sessao local cai junto.
 * - 'requisicaoInvalida' (4xx): o dado enviado esta errado. Repetir o mesmo
 *   corpo da o mesmo 400 para sempre.
 * - 'servidor' (5xx): problema do outro lado. Repetir pode resolver, mas com
 *   backoff — nao em loop apertado.
 * - 'respostaInvalida': status 200 com corpo que nao casa com o contrato. Trata
 *   como falha explicita em vez de deixar `undefined` vazar para dentro do banco.
 */
export type FalhaApi =
  | { readonly tipo: 'rede'; readonly mensagem: string }
  | { readonly tipo: 'naoAutorizado'; readonly mensagem: string; readonly detalhes: readonly string[] }
  | { readonly tipo: 'requisicaoInvalida'; readonly status: number; readonly mensagem: string; readonly detalhes: readonly string[] }
  | { readonly tipo: 'servidor'; readonly status: number; readonly mensagem: string; readonly detalhes: readonly string[] }
  | { readonly tipo: 'respostaInvalida'; readonly mensagem: string };

export class ErroApi extends Error {
  readonly falha: FalhaApi;

  constructor(falha: FalhaApi) {
    super(falha.mensagem);
    this.name = 'ErroApi';
    this.falha = falha;
  }
}

export function ehErroApi(erro: unknown): erro is ErroApi {
  return erro instanceof ErroApi;
}

/** True quando insistir mais tarde faz sentido (rede caiu ou servidor tropecou). */
export function vaiAdiantarRepetir(falha: FalhaApi): boolean {
  return falha.tipo === 'rede' || falha.tipo === 'servidor';
}

/**
 * Lista de mensagens para mostrar no formulario. O Identity devolve varias de
 * uma vez ("senha curta" + "email ja usado"), entao a UI precisa da lista, nao
 * de uma string so.
 */
export function detalhesDe(erro: unknown): string[] {
  if (!ehErroApi(erro)) {
    return [erro instanceof Error ? erro.message : 'Erro inesperado.'];
  }
  const { falha } = erro;
  if (falha.tipo === 'rede' || falha.tipo === 'respostaInvalida') {
    return [falha.mensagem];
  }
  return falha.detalhes.length > 0 ? [...falha.detalhes] : [falha.mensagem];
}

/** Uma linha so, para o indicador de status. */
export function mensagemDe(erro: unknown): string {
  const [primeira] = detalhesDe(erro);
  return primeira ?? 'Erro inesperado.';
}
