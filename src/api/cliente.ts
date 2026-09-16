/**
 * Cliente HTTP do backend. Um unico ponto de saida para a rede: e aqui que o
 * Bearer entra, que o JSON vira tipo conferido e que o 401 derruba a sessao.
 */
import { ErroApi } from './erros';
import { limparSessao, lerSessaoValida } from './sessao';
import {
  lerRespostaErro,
  lerRespostaSincronizacao,
  lerRespostaToken,
  type RequisicaoSincronizacaoFio,
  type RespostaSincronizacaoFio,
  type RespostaTokenFio,
} from './contratos';

/**
 * Base das chamadas. Vazia por padrao — ou seja, MESMA ORIGEM do app.
 *
 * Havia um fallback para http://localhost:5148 aqui. Ele saiu porque a API deixou
 * de morar em outro endereco: o frontend e o backend sao dois servicos do mesmo
 * projeto na Vercel, atras do mesmo dominio, e `/api/...` chega ao container por
 * rewrite (ver vercel.json). Nao existe URL de API para configurar.
 *
 * Isso apaga o CORS do caminho critico: requisicao de mesma origem nao dispara
 * preflight e nao depende de lista de origens permitidas — a classe de erro que
 * so aparece em producao, depois do deploy, simplesmente deixa de existir. Em
 * desenvolvimento o mesmo vale, via proxy do Vite (ver vite.config.ts).
 *
 * VITE_API_URL continua sendo lida, como escape: serve para apontar um build
 * local contra uma API publicada. Vazia, o app fala com a propria origem.
 *
 * `import.meta.env` e tipado com index signature solta pelo vite/client, entao a
 * leitura passa por `unknown` antes de qualquer uso — e o jeito de nao deixar um
 * `any` entrar pela porta da configuracao.
 */
function resolverBaseUrl(): string {
  const configurada: unknown = import.meta.env['VITE_API_URL'];
  if (typeof configurada !== 'string' || configurada.trim() === '') {
    return '';
  }
  return configurada.trim().replace(/\/+$/, ''); // sem barra final: os caminhos ja comecam com '/'
}

export const BASE_URL = resolverBaseUrl();

/** Corpo cru da resposta. JSON quando da, texto quando nao, null quando vazio. */
async function lerCorpo(resposta: Response): Promise<unknown> {
  let texto: string;
  try {
    texto = await resposta.text();
  } catch {
    return null;
  }
  if (texto.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return texto; // 500 do pipeline costuma vir em HTML; guarda para a mensagem
  }
}

async function construirErro(status: number, bruto: unknown, autenticada: boolean): Promise<ErroApi> {
  const corpo = lerRespostaErro(bruto);
  const mensagem = corpo?.erro ?? `O servidor respondeu ${status.toString()}.`;
  const detalhes = corpo?.detalhes ?? [];

  if (status === 401) {
    // A sessao morre aqui, e nao no chamador: se cada ponto de chamada tivesse
    // que lembrar de limpar, o que esquecesse deixaria o app sincronizando para
    // sempre com um token morto. So derruba quando a requisicao ia autenticada —
    // 401 no login e "senha errada", nao "sua sessao caiu".
    if (autenticada) {
      await limparSessao();
    }
    return new ErroApi({ tipo: 'naoAutorizado', mensagem, detalhes });
  }
  if (status >= 500) {
    return new ErroApi({ tipo: 'servidor', status, mensagem, detalhes });
  }
  return new ErroApi({ tipo: 'requisicaoInvalida', status, mensagem, detalhes });
}

interface Chamada<T> {
  readonly caminho: string;
  readonly corpo: unknown;
  readonly autenticada: boolean;
  readonly ler: (bruto: unknown) => T | null;
}

async function postar<T>(chamada: Chamada<T>): Promise<T> {
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };

  if (chamada.autenticada) {
    // Confere o vencimento ANTES de gastar a requisicao: token vencido vira 401
    // na certa, e a viagem so serviria para descobrir o que ja da para saber.
    const sessao = await lerSessaoValida();
    if (sessao === null) {
      throw new ErroApi({ tipo: 'naoAutorizado', mensagem: 'Sessao ausente ou expirada. Entre de novo.', detalhes: [] });
    }
    cabecalhos['Authorization'] = `Bearer ${sessao.token}`;
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_URL}${chamada.caminho}`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(chamada.corpo),
    });
  } catch {
    // fetch so rejeita quando nao houve resposta: offline, DNS, CORS, servidor
    // fora do ar. Nada foi processado do outro lado — a fila continua intacta.
    throw new ErroApi({ tipo: 'rede', mensagem: 'Nao foi possivel falar com o servidor. Verifique a conexao.' });
  }

  const bruto = await lerCorpo(resposta);
  if (!resposta.ok) {
    throw await construirErro(resposta.status, bruto, chamada.autenticada);
  }

  const lido = chamada.ler(bruto);
  if (lido === null) {
    throw new ErroApi({ tipo: 'respostaInvalida', mensagem: `Resposta fora do contrato em ${chamada.caminho}.` });
  }
  return lido;
}

export async function registrarNoServidor(
  email: string,
  senha: string,
  nome: string,
): Promise<RespostaTokenFio> {
  return postar({
    caminho: '/api/autenticacao/registrar',
    corpo: { email, senha, nome },
    autenticada: false,
    ler: lerRespostaToken,
  });
}

export async function entrarNoServidor(email: string, senha: string): Promise<RespostaTokenFio> {
  return postar({
    caminho: '/api/autenticacao/login',
    corpo: { email, senha },
    autenticada: false,
    ler: lerRespostaToken,
  });
}

/**
 * Troca o token atual por outro com prazo novo.
 *
 * `autenticada: true` faz o Bearer entrar e, no 401, faz a sessao cair — que e o
 * certo aqui: renovacao recusada significa que este token nao vale mais, e
 * insistir com ele em toda sincronizacao seguinte so gastaria requisicao.
 */
export async function renovarNoServidor(): Promise<RespostaTokenFio> {
  return postar({
    caminho: '/api/autenticacao/renovar',
    corpo: {},
    autenticada: true,
    ler: lerRespostaToken,
  });
}

export async function sincronizarNoServidor(
  requisicao: RequisicaoSincronizacaoFio,
): Promise<RespostaSincronizacaoFio> {
  return postar({
    caminho: '/api/sincronizacao',
    corpo: requisicao,
    autenticada: true,
    ler: lerRespostaSincronizacao,
  });
}
