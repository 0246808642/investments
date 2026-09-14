import { idiomaAtual } from '../i18n/idiomas';

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

/**
 * Formatadores por idioma, criados sob demanda e guardados.
 *
 * `new Intl.DateTimeFormat` custa caro e estas funcoes sao chamadas em laco — uma
 * lista de sessenta lancamentos chama `formatarDataCurta` sessenta vezes. O cache
 * e por (idioma + forma), entao trocar o idioma nao invalida nada: a entrada
 * antiga continua valida para quando a pessoa voltar.
 */
const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(chave: string, opcoes: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const idioma = idiomaAtual();
  const completa = `${idioma}:${chave}`;
  let guardado = formatadores.get(completa);
  if (guardado === undefined) {
    guardado = new Intl.DateTimeFormat(idioma, opcoes);
    formatadores.set(completa, guardado);
  }
  return guardado;
}

/**
 * '2026-09-14' -> "14/09" em portugues e espanhol, "09/14" em ingles.
 *
 * Passou a usar Intl em vez de fatiar a string: dia e mes trocam de ordem entre
 * os idiomas, e "09/14" lido como 9 de setembro por um brasileiro — ou 14 de
 * setembro por um americano — e um erro silencioso num campo de data.
 */
export function formatarDataCurta(data: DataISO): string {
  return formatador('curta', { day: '2-digit', month: '2-digit' }).format(paraDateLocal(data));
}

/** '2026-09-14' -> "14 de set." / "Sep 14" / "14 sept" */
export function formatarDiaEMes(data: DataISO): string {
  return formatador('diaEMes', { day: '2-digit', month: 'short' }).format(paraDateLocal(data));
}

/** '2026-09-14' -> "seg., 14 de set." / "Mon, Sep 14" / "lun, 14 sept" */
export function formatarDataComSemana(data: DataISO): string {
  return formatador('comSemana', { weekday: 'short', day: '2-digit', month: 'short' }).format(
    paraDateLocal(data),
  );
}

/** '2026-09' -> "setembro de 2026" / "September 2026" / "septiembre de 2026" */
export function formatarMesExtenso(mes: MesISO): string {
  return formatador('mesExtenso', { month: 'long', year: 'numeric' }).format(
    paraDateLocal(primeiroDiaDoMes(mes)),
  );
}

/**
 * '2026-09' -> "Setembro de 2026". Existe porque a classe `capitalize` do CSS
 * sobe a inicial de TODA palavra e produz "Setembro De 2026".
 *
 * Em ingles o Intl ja devolve "September 2026" com maiuscula, e subir de novo o
 * que ja esta em caixa alta nao muda nada — a funcao serve aos tres idiomas.
 */
export function formatarMesTitulo(mes: MesISO): string {
  const extenso = formatarMesExtenso(mes);
  return extenso.charAt(0).toLocaleUpperCase(idiomaAtual()) + extenso.slice(1);
}

/** '2026-09' -> "set." / "Sep" / "sept". Rotulo da trilha, onde o nome inteiro nao cabe. */
export function formatarMesAbreviado(mes: MesISO): string {
  return formatador('mesAbreviado', { month: 'short' }).format(paraDateLocal(primeiroDiaDoMes(mes)));
}

/** '2026-09' -> "setembro" / "September" / "septiembre". Sem o ano: ele ja esta no titulo. */
export function formatarMesNome(mes: MesISO): string {
  return formatador('mesNome', { month: 'long' }).format(paraDateLocal(primeiroDiaDoMes(mes)));
}

/**
 * Desloca a data em dias. Passa por Date local de propósito: somar 1 ao campo
 * "dia" da string erraria a virada de mes, de ano e de horario de verao.
 */
export function somarDias(data: DataISO, dias: number): DataISO {
  const referencia = paraDateLocal(data);
  referencia.setDate(referencia.getDate() + dias);
  return deComponentesLocais(referencia);
}

/** Atalho legivel para o chip "Ontem" do formulario de lancamento. */
export function ontem(): DataISO {
  return somarDias(hoje(), -1);
}
