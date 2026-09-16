/**
 * Renovacao silenciosa da sessao.
 *
 * Mora num modulo proprio, e nao em `sessao.ts`, por causa da direcao das
 * dependencias: `cliente.ts` ja importa `sessao.ts` (e de la que sai o Bearer e e
 * la que o 401 derruba a sessao). Chamar o cliente de dentro de `sessao.ts`
 * fecharia o ciclo. Aqui em cima dos dois, ninguem importa ninguem de volta.
 */
import { renovarNoServidor } from './cliente';
import { lerSessaoValida, salvarSessao } from './sessao';

/**
 * A partir de quanto tempo restante vale a pena renovar.
 *
 * O token dura 30 dias (Jwt:MinutosDeValidade no backend). Renovar com 7 dias ou
 * menos pela frente significa que quem abre o app pelo menos uma vez a cada tres
 * semanas nunca mais ve a tela de login — e, ao mesmo tempo, que abrir o app
 * cinco vezes num dia nao dispara cinco renovacoes por nada.
 *
 * O numero e um limite INFERIOR de folga, nao uma fracao da validade: o cliente
 * nao sabe quanto dura o token que recebeu, so quando ele vence. Se o servidor um
 * dia encurtar o prazo para menos que isto, a renovacao passa a acontecer em toda
 * abertura — mais chamadas, nunca uma sessao perdida. E o lado certo do erro.
 */
const FOLGA_MINIMA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Renova se estiver perto do fim. Nunca lanca.
 *
 * Silenciosa de proposito: e chamada na abertura do app, onde nao ha nada util a
 * dizer para o usuario. Sem rede, a sessao atual continua valendo e a proxima
 * abertura tenta de novo; com token ja recusado, o proprio cliente derruba a
 * sessao no 401 e a tela de conta aparece pelo caminho normal.
 */
export async function renovarSessaoSePerto(agoraMs: number = Date.now()): Promise<void> {
  let sessao;
  try {
    sessao = await lerSessaoValida();
  } catch {
    return;
  }

  if (sessao === null) {
    return;
  }

  const vencimento = Date.parse(sessao.expiraEm);
  if (Number.isNaN(vencimento) || vencimento - agoraMs > FOLGA_MINIMA_MS) {
    return;
  }

  try {
    const resposta = await renovarNoServidor();
    await salvarSessao({
      token: resposta.token,
      expiraEm: resposta.expiraEm,
      email: sessao.email,
      nome: resposta.nome,
      // A escolha de "manter conectado" e do login e sobrevive a renovacao:
      // reescrever como persistente aqui transformaria "so nesta janela" em
      // "para sempre" pelas costas de quem desmarcou a caixa.
      persistente: sessao.persistente ?? true,
    });
  } catch {
    // Vide o comentario do cabecalho: falhar aqui nao pode atrapalhar a abertura.
  }
}
