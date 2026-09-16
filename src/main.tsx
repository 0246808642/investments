import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { descartarSessaoNaoPersistente } from './api/sessao';
import { renovarSessaoSePerto } from './api/renovacao';
import { iniciarSincronizacaoAutomatica } from './api/sincronizador';
import { registrarServiceWorker } from './notificacoes/notificacoes';
import { iniciarIdioma } from './i18n';
import { iniciarTema } from './tema/tema';
import './index.css';

// Antes de montar: a primeira pintura tem que sair ja no tema escolhido, senao
// quem usa tema escuro leva um flash branco a cada abertura do app.
iniciarTema();
// O <html lang> tem que sair certo na primeira pintura: leitor de tela e
// corretor do navegador dependem dele.
iniciarIdioma();

// Quem nao marcou "manter conectado" e fechou o navegador perde a sessao aqui,
// antes de qualquer tela ler o token. E assincrono e nao bloqueia a montagem: no
// pior caso a UI mostra "logado" por um quadro e corrige em seguida, que e menos
// pior do que segurar a primeira pintura esperando o IndexedDB.
// A sincronizacao comeca DEPOIS do descarte, e nao em paralelo: o primeiro
// ciclo le a sessao, e comecar antes poderia mandar o lote com um token que
// estava justamente sendo jogado fora.
void descartarSessaoNaoPersistente()
  .catch(() => {
    // IndexedDB bloqueado: sem conseguir ler a sessao nao ha o que descartar, e
    // a sincronizacao ainda assim precisa comecar — ela le a sessao de novo e
    // decide sozinha se ha algo para enviar.
  })
  .then(iniciarSincronizacaoAutomatica);

const raiz = document.getElementById('root');
if (raiz === null) {
  throw new Error('Elemento #root nao encontrado no index.html');
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Depois do render: o service worker existe para as notificacoes de alerta, nao
// para a primeira pintura, e registrar antes so atrasaria a tela. Nenhuma
// permissao e pedida aqui — isso acontece no clique, dentro da folha de alertas.
void registrarServiceWorker();

/*
 * Estica o prazo da sessao enquanto o app for usado.
 *
 * Duas entradas, e as duas sao necessarias. A primeira cobre quem abre e fecha o
 * app; a segunda cobre o contrario — app instalado que passa semanas em segundo
 * plano no celular e volta pelo alternador de tarefas, sem nunca "abrir" de novo.
 * Sem a segunda, justamente o uso de PWA cairia na tela de login.
 *
 * `visibilitychange` e nao `focus`: e o evento que o iOS e o Android disparam ao
 * trazer o app de volta. A propria funcao decide se ha o que renovar, entao
 * chamar a cada volta nao custa requisicao nenhuma.
 */
void renovarSessaoSePerto();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void renovarSessaoSePerto();
  }
});
