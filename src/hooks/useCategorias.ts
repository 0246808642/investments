import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listarCategorias } from '../db/consultas';
import type { Categoria, TipoMovimento } from '../types';

export interface CategoriasDoTipo {
  categorias: Categoria[];
  carregando: boolean;
}

/**
 * Categorias do tipo pedido, ja ordenadas pela consulta. Reativo via
 * useLiveQuery: se o seed ou uma edicao mexer na tabela, a grade se atualiza
 * sozinha sem a folha precisar recarregar.
 */
export function useCategorias(tipo: TipoMovimento): CategoriasDoTipo {
  const todas = useLiveQuery(() => listarCategorias(), []);
  const categorias = useMemo(
    () => (todas ?? []).filter((categoria) => categoria.tipo === tipo),
    [todas, tipo],
  );
  return { categorias, carregando: todas === undefined };
}
