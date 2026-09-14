/**
 * Notificacao de sistema, do jeito que o Android exige.
 *
 * No desktop `new Notification(...)` funciona; no Chrome do Android ele lanca
 * TypeError e a unica porta e `registration.showNotification()` — por isso tudo
 * aqui passa pelo service worker, inclusive no desktop. Um caminho so, testado
 * no aparelho que importa.
 *
 * Nada disso e push de verdade: o aviso sai do proprio app, entao ele depende do
 * app estar aberto (ou do service worker ainda vivo em segundo plano). Push com
 * o app fechado precisa de VAPID e de um endpoint no backend para disparar.
 */

export type EstadoDaPermissao = 'indisponivel' | 'pendente' | 'concedida' | 'negada';

/** Some da UI inteira quando o navegador nao tem as APIs (iOS fora da tela inicial, por ex.). */
export function suportaNotificacao(): boolean {
  return (
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
  );
}

export function estadoDaPermissao(): EstadoDaPermissao {
  if (!suportaNotificacao()) {
    return 'indisponivel';
  }
  switch (Notification.permission) {
    case 'granted':
      return 'concedida';
    case 'denied':
      return 'negada';
    default:
      return 'pendente';
  }
}

/**
 * So chame de dentro de um clique. Navegador ignora (ou pune) pedido de
 * permissao disparado no carregamento, e o usuario que ve a caixa sem ter pedido
 * nada clica "bloquear" — decisao que nao da para desfazer pela pagina.
 */
export async function pedirPermissao(): Promise<EstadoDaPermissao> {
  if (!suportaNotificacao()) {
    return 'indisponivel';
  }
  await Notification.requestPermission();
  return estadoDaPermissao();
}

export async function registrarServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Sem service worker o app inteiro continua funcionando; so o aviso de
    // sistema fica indisponivel, e a UI ja trata esse caso.
  }
}

export interface Aviso {
  titulo: string;
  corpo: string;
  /**
   * Identidade da notificacao. Duas com a mesma tag se substituem em vez de
   * empilhar — e o que impede a bandeja de virar uma pilha de "limite estourado".
   */
  tag: string;
}

/** `true` quando a notificacao foi mesmo entregue ao sistema. */
export async function notificar({ titulo, corpo, tag }: Aviso): Promise<boolean> {
  if (estadoDaPermissao() !== 'concedida') {
    return false;
  }
  try {
    const registro = await navigator.serviceWorker.ready;
    await registro.showNotification(titulo, {
      body: corpo,
      tag,
      icon: '/icone.svg',
      badge: '/icone.svg',
      lang: 'pt-BR',
    });
    return true;
  } catch {
    return false;
  }
}
