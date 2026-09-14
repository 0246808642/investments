/**
 * Campos que todo registro carrega. Existem para a sincronizacao futura com o
 * backend ASP.NET Core: o id e gerado no cliente (para poder criar offline sem
 * pedir numero ao servidor), updatedAt resolve conflito por ultima escrita e
 * deletedAt permite propagar exclusoes. Nao trocar id por inteiro sequencial.
 */
export interface BaseEntity {
  /** UUID v4 gerado no cliente. */
  id: string;
  /** Timestamp ISO completo (com hora e fuso) da ultima escrita. */
  updatedAt: string;
  /** Timestamp ISO da exclusao logica, ou null se o registro esta ativo. */
  deletedAt: string | null;
}

/** Os campos proprios de uma entidade, sem os herdados de BaseEntity. */
export type Rascunho<T extends BaseEntity> = Omit<T, keyof BaseEntity>;

/**
 * crypto.randomUUID so existe em contexto seguro (https ou localhost). Ao abrir
 * o app no celular pelo IP da maquina (http://192.168.x.x:5173) ele e undefined,
 * entao caimos no gerador manual — getRandomValues funciona em qualquer contexto.
 */
export function novoId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // versao 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variante RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** Timestamp ISO do instante atual, para updatedAt / deletedAt. */
export function agoraISO(): string {
  return new Date().toISOString();
}

/**
 * Predicado usado em TODA consulta. O IndexedDB nao indexa null, entao o filtro
 * de soft delete acontece em memoria em vez de virar um where() no Dexie.
 */
export function ativo<T extends BaseEntity>(registro: T): boolean {
  return registro.deletedAt === null;
}
