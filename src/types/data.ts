/**
 * Data e sempre a string 'YYYY-MM-DD'. Nunca um objeto Date no banco: Date
 * carrega hora e fuso, serializa diferente entre navegadores e desloca o dia
 * quando passa por toISOString(). A string e estavel, ordenavel
 * lexicograficamente (logo indexavel e comparavel com between no Dexie) e vai
 * direto para um DateOnly do C# na sincronizacao futura.
 */
export type DataISO = string & { readonly __brand: 'DataISO' };

/** Competencia mensal, 'YYYY-MM'. Mesmo racional da DataISO. */
export type MesISO = string & { readonly __brand: 'MesISO' };

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_MES = /^\d{4}-\d{2}$/;

export function ehDataISO(texto: string): texto is DataISO {
  const partes = FORMATO_DATA.exec(texto);
  if (partes === null) {
    return false;
  }
  const [, ano, mes, dia] = partes;
  if (ano === undefined || mes === undefined || dia === undefined) {
    return false;
  }
  // Confere que a data existe de fato: '2026-02-31' casa com o regex mas nao e dia valido.
  const referencia = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return (
    referencia.getFullYear() === Number(ano) &&
    referencia.getMonth() === Number(mes) - 1 &&
    referencia.getDate() === Number(dia)
  );
}

export function dataISO(texto: string): DataISO {
  if (!ehDataISO(texto)) {
    throw new Error(`Data invalida, esperado YYYY-MM-DD: "${texto}"`);
  }
  return texto;
}

export function ehMesISO(texto: string): texto is MesISO {
  return FORMATO_MES.test(texto);
}

export function mesISO(texto: string): MesISO {
  if (!ehMesISO(texto)) {
    throw new Error(`Mes invalido, esperado YYYY-MM: "${texto}"`);
  }
  return texto;
}

/** Usa os componentes locais de propósito; toISOString() jogaria o dia para tras a noite. */
function deComponentesLocais(referencia: Date): DataISO {
  const ano = referencia.getFullYear().toString().padStart(4, '0');
  const mes = (referencia.getMonth() + 1).toString().padStart(2, '0');
  const dia = referencia.getDate().toString().padStart(2, '0');
  return `${ano}-${mes}-${dia}` as DataISO;
}

export function hoje(): DataISO {
  return deComponentesLocais(new Date());
}

/** Date local a meia-noite. So para formatar e calcular — nao vai para o banco. */
function paraDateLocal(data: DataISO): Date {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}

export function mesDe(data: DataISO): MesISO {
  return data.slice(0, 7) as MesISO;
}

export function mesAtual(): MesISO {
  return mesDe(hoje());
}

export function primeiroDiaDoMes(mes: MesISO): DataISO {
  return `${mes}-01` as DataISO;
}

export function ultimoDiaDoMes(mes: MesISO): DataISO {
  const [ano, numeroDoMes] = mes.split('-').map(Number);
  // Dia 0 do mes seguinte = ultimo dia deste mes.
  const ultimo = new Date(ano ?? 1970, numeroDoMes ?? 1, 0).getDate();
  return `${mes}-${ultimo.toString().padStart(2, '0')}` as DataISO;
}

export function mesAnterior(mes: MesISO): MesISO {
  const [ano, numeroDoMes] = mes.split('-').map(Number);
  return mesDe(deComponentesLocais(new Date(ano ?? 1970, (numeroDoMes ?? 1) - 2, 1)));
}

export function mesSeguinte(mes: MesISO): MesISO {
  const [ano, numeroDoMes] = mes.split('-').map(Number);
  return mesDe(deComponentesLocais(new Date(ano ?? 1970, numeroDoMes ?? 1, 1)));
}

const formatadorDiaEMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const formatadorComSemana = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});
const formatadorMesExtenso = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

/** '2026-09-14' -> "14/09" */
export function formatarDataCurta(data: DataISO): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/** '2026-09-14' -> "14 de set." */
export function formatarDiaEMes(data: DataISO): string {
  return formatadorDiaEMes.format(paraDateLocal(data));
}

/** '2026-09-14' -> "seg., 14 de set." */
export function formatarDataComSemana(data: DataISO): string {
  return formatadorComSemana.format(paraDateLocal(data));
}

/** '2026-09' -> "setembro de 2026" */
export function formatarMesExtenso(mes: MesISO): string {
  return formatadorMesExtenso.format(paraDateLocal(primeiroDiaDoMes(mes)));
}

/**
 * '2026-09' -> "Setembro de 2026". Existe porque a classe `capitalize` do CSS
 * sobe a inicial de TODA palavra e produz "Setembro De 2026".
 */
export function formatarMesTitulo(mes: MesISO): string {
  const extenso = formatarMesExtenso(mes);
  return extenso.charAt(0).toLocaleUpperCase('pt-BR') + extenso.slice(1);
}
