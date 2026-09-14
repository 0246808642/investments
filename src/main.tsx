import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { descartarSessaoNaoPersistente } from './api/sessao';
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
void descartarSessaoNaoPersistente();

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
