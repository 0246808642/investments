import type { Categoria, TipoMovimento } from '../types';
import { agoraISO } from '../types';

interface CategoriaPadrao {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoMovimento;
  readonly cor: string;
  /** Marcadas de fabrica: as que aparecem em quase todo mes de quase todo mundo. */
  readonly favorita: boolean;
}

/**
 * Os ids sao fixos de proposito. Se o app for instalado em dois aparelhos, cada
 * um semeia as mesmas categorias com os mesmos ids — na sincronizacao futura
 * elas se reconhecem como o mesmo registro em vez de virar duplicata.
 */
export const CATEGORIAS_PADRAO: readonly CategoriaPadrao[] = [
  // Saidas
  { id: '00000000-0000-4000-8000-000000000001', nome: 'Mercado', tipo: 'saida', cor: '#ea580c', favorita: true },
  { id: '00000000-0000-4000-8000-000000000002', nome: 'Transporte', tipo: 'saida', cor: '#0284c7', favorita: true },
  { id: '00000000-0000-4000-8000-000000000003', nome: 'Moradia', tipo: 'saida', cor: '#7c3aed', favorita: false },
  { id: '00000000-0000-4000-8000-000000000004', nome: 'Saúde', tipo: 'saida', cor: '#db2777', favorita: false },
  { id: '00000000-0000-4000-8000-000000000005', nome: 'Lazer', tipo: 'saida', cor: '#a16207', favorita: false },
  { id: '00000000-0000-4000-8000-000000000006', nome: 'Outros', tipo: 'saida', cor: '#64748b', favorita: false },
  // Entradas
  { id: '00000000-0000-4000-8000-000000000007', nome: 'Salário', tipo: 'entrada', cor: '#10b981', favorita: true },
  { id: '00000000-0000-4000-8000-000000000008', nome: 'Extra', tipo: 'entrada', cor: '#14b8a6', favorita: false },
];

export function construirCategoriasPadrao(): Categoria[] {
  const timestamp = agoraISO();
  return CATEGORIAS_PADRAO.map((padrao) => ({
    ...padrao,
    updatedAt: timestamp,
    deletedAt: null,
  }));
}

/**
 * Recoloracao v1 -> v2. As cores originais reprovavam nos limiares de contraste
 * (laranja, azul-claro e amarelo abaixo de 3:1 sobre branco) e de separacao para
 * daltonismo. Como as categorias ja foram gravadas no IndexedDB de quem abriu o
 * app antes, trocar so o seed nao alcancaria esses aparelhos — dai a migracao.
 * A troca so acontece se a cor ainda for a original: cor personalizada fica.
 */
export const RECOLORACAO_V2: readonly { id: string; de: string; para: string }[] = [
  { id: '00000000-0000-4000-8000-000000000001', de: '#f97316', para: '#ea580c' },
  { id: '00000000-0000-4000-8000-000000000002', de: '#0ea5e9', para: '#0284c7' },
  { id: '00000000-0000-4000-8000-000000000003', de: '#8b5cf6', para: '#7c3aed' },
  { id: '00000000-0000-4000-8000-000000000004', de: '#ec4899', para: '#db2777' },
  { id: '00000000-0000-4000-8000-000000000005', de: '#eab308', para: '#a16207' },
];
