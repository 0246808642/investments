/*
 * Service worker minimo. Ele existe por UM motivo hoje: no Android o Chrome so
 * aceita notificacao emitida por um service worker registrado — `new
 * Notification()` direto da pagina lanca erro no celular, que e justamente o
 * aparelho que precisa ser avisado.
 *
 * Nao ha cache aqui de proposito. Estrategia de cache muda o que o usuario ve
 * depois de um deploy e merece sua propria decisao; o app ja funciona offline
 * pelo IndexedDB. Quando entrar cache, entra aqui, versionado.
 */

self.addEventListener('install', () => {
  // Assume o lugar do worker anterior sem esperar a aba fechar.
  void self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

/** Tocar na notificacao traz a aba que ja existe; so abre outra se nao houver. */
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          return janela.focus();
        }
      }
      return self.clients.openWindow('/');
    }),
  );
});
