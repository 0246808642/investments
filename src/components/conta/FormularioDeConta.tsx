import { useEffect, useId, useRef, useState } from 'react';
import type * as React from 'react';

import { useSessao } from '../../hooks/useSessao';
import type { Textos } from '../../i18n';
import { useTextos } from '../../i18n';
import { ANEL_FOCO, BOTAO_PRIMARIO, CAMPO_TEXTO } from './estilos';

/** Barato de proposito: quem decide se o e-mail existe e o servidor. */
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RequisitoDeSenha {
  /** Chave no dicionario; o rotulo sai traduzido na hora de desenhar. */
  readonly chave: keyof Textos['conta']['requisitos'];
  readonly atende: (senha: string) => boolean;
}

/**
 * ESPELHO da politica do ASP.NET Identity configurada em
 * `backend/src/Financeiro.Infrastructure/InjecaoDeDependencia.cs`:
 * RequiredLength = 8, RequireDigit, RequireLowercase, RequireUppercase,
 * RequireNonAlphanumeric = false.
 *
 * A lista existe aqui para o usuario ver o que falta ENQUANTO digita. Exigir
 * menos do que o servidor exige seria pior do que nao validar nada: a pessoa
 * passaria pela nossa checagem para levar a recusa dele, sem entender por que.
 * Se a regra do backend mudar, esta lista muda junto — sao um par.
 */
export const REQUISITOS_DE_SENHA: readonly RequisitoDeSenha[] = [
  { chave: 'tamanho', atende: (s) => s.length >= 8 },
  { chave: 'maiuscula', atende: (s) => /\p{Lu}/u.test(s) },
  { chave: 'minuscula', atende: (s) => /\p{Ll}/u.test(s) },
  { chave: 'numero', atende: (s) => /\d/.test(s) },
];

/**
 * Espelha UsuarioDaAplicacao.TamanhoMinimoDoNome no backend. A validacao local
 * adianta o obvio; a do servidor continua sendo a que vale.
 */
const TAMANHO_MINIMO_DO_NOME = 2;

export type ModoDeConta = 'entrar' | 'registrar';

export interface FormularioDeContaProps {
  /** Verbo com que o formulario abre. O usuario troca pelo seletor do topo. */
  modoInicial: ModoDeConta;
  /** Chamado apos entrar/registrar com sucesso. Quem monta fecha a folha aqui. */
  aoConcluir?: () => void;
  /**
   * Foca o e-mail ao montar. So ligue quando o formulario aparece por gesto do
   * usuario (folha/modal) — e o que o iOS exige para subir o teclado.
   */
  focarAoMontar?: boolean;
}

/** Validacao local: adianta o obvio, nunca substitui a do servidor. */
function validar(
  modo: ModoDeConta,
  email: string,
  senha: string,
  confirmacao: string,
  nome: string,
  t: Textos,
): string[] {
  const erros: string[] = [];

  // So no cadastro: quem entra ja tem nome guardado, e pedir de novo seria um
  // campo a mais para digitar sem nada em troca.
  if (modo === 'registrar') {
    if (nome.length === 0) {
      erros.push(t.conta.informeNome);
    } else if (nome.length < TAMANHO_MINIMO_DO_NOME) {
      erros.push(t.conta.nomeCurto);
    }
  }

  if (email.length === 0) {
    erros.push(t.conta.informeEmail);
  } else if (!FORMATO_EMAIL.test(email)) {
    erros.push(t.conta.emailInvalido);
  }

  if (senha.length === 0) {
    erros.push(t.conta.informeSenha);
    return erros;
  }

  if (modo === 'entrar') {
    return erros;
  }

  // No cadastro, o que falta vem item a item: "senha fraca" manda a pessoa
  // adivinhar qual das quatro regras ela quebrou.
  const faltando = REQUISITOS_DE_SENHA.filter((requisito) => !requisito.atende(senha));
  if (faltando.length > 0) {
    erros.push(t.conta.senhaPrecisa(faltando.map((r) => t.conta.requisitos[r.chave]).join(', ')));
  }

  if (confirmacao.length === 0) {
    erros.push(t.conta.repitaParaConfirmar);
  } else if (confirmacao !== senha) {
    erros.push(t.conta.senhasDiferentes);
  }

  return erros;
}

/**
 * Entrar e criar conta sao o mesmo formulario com outro verbo — mesmos campos,
 * mesma ordem, mesma validacao. Separar em dois componentes duplicaria o
 * tratamento de erro e faria o usuario perder o e-mail ja digitado ao trocar.
 *
 * Os erros chegam do backend como LISTA e aparecem todos: mostrar so o primeiro
 * faz o usuario corrigir, reenviar e levar outra recusa.
 */
export function FormularioDeConta({
  modoInicial,
  aoConcluir,
  focarAoMontar,
}: FormularioDeContaProps): React.JSX.Element {
  const { entrar, registrar } = useSessao();
  const t = useTextos();

  const [modo, setModo] = useState<ModoDeConta>(modoInicial);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [manterConectado, setManterConectado] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<readonly string[]>([]);

  const campoEmail = useRef<HTMLInputElement>(null);
  const idErros = useId();
  const idRequisitos = useId();
  const idManter = useId();

  const criando = modo === 'registrar';

  useEffect(() => {
    if (focarAoMontar === true) {
      campoEmail.current?.focus();
    }
  }, [focarAoMontar]);

  /**
   * Troca de verbo. Mantem o e-mail (quase sempre o mesmo) e descarta as senhas:
   * a senha de entrar nao e a que se quer cadastrar, e o autoComplete do campo
   * muda junto.
   *
   * Idempotente de proposito: o seletor chama com o modo ja ativo o tempo todo, e
   * limpar o que a pessoa digitou por causa de um clique sem efeito seria cruel.
   */
  function irPara(novo: ModoDeConta): void {
    if (enviando || novo === modo) {
      return;
    }
    setModo(novo);
    setSenha('');
    setConfirmacao('');
    setSenhaVisivel(false);
    setErros([]);
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (enviando) {
      return;
    }

    const emailLimpo = email.trim();
    // Mesma normalizacao do servidor: apara as pontas e colapsa espacos repetidos,
    // para "Ana   Maria" nao virar um nome diferente de "Ana Maria".
    const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
    const locais = validar(modo, emailLimpo, senha, confirmacao, nomeLimpo, t);
    if (locais.length > 0) {
      setErros(locais);
      return;
    }

    setEnviando(true);
    setErros([]);
    try {
      const resultado = criando
        ? await registrar(emailLimpo, senha, nomeLimpo, manterConectado)
        : await entrar(emailLimpo, senha, manterConectado);

      if (resultado.ok) {
        // Saem da memoria assim que deixam de ser necessarias.
        setSenha('');
        setConfirmacao('');
        setSenhaVisivel(false);
        aoConcluir?.();
        return;
      }

      setErros(
        resultado.erros.length > 0 ? resultado.erros : [t.conta.erroGenerico],
      );
    } catch {
      setErros([t.conta.erroRede]);
    } finally {
      setEnviando(false);
    }
  }

  const temErro = erros.length > 0;
  const rotuloAcao = criando ? t.conta.criarConta : t.conta.entrar;
  const rotuloEnviando = criando ? t.conta.criandoConta : t.conta.entrando;
  const primeiroErro = erros[0];

  // A confirmacao so acusa divergencia depois de a pessoa ter digitado alguma
  // coisa: acusar no primeiro caractere e acusar todo mundo, sempre.
  const confirmacaoDivergente = criando && confirmacao.length > 0 && confirmacao !== senha;

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        void enviar(evento);
      }}
      className="space-y-5"
    >
      {/*
        Os dois caminhos ficam VISIVEIS de saida, e nao escondidos num link de
        rodape. Quem chega para criar conta nao deve descobrir que da, depois de
        ler um formulario de login inteiro — e o segmentado e o mesmo controle
        que a folha de lancamento usa para "saiu/entrou", entao a gramatica do
        app se repete em vez de inventar outra.
      */}
      <div
        role="group"
        aria-label={t.conta.entrarOuCriar}
        className="grid grid-cols-2 gap-1 rounded-lg bg-superficie-fundo p-1"
      >
        <Segmento
          rotulo={t.conta.entrar}
          selecionado={!criando}
          aoTocar={() => {
            irPara('entrar');
          }}
        />
        <Segmento
          rotulo={t.conta.criarConta}
          selecionado={criando}
          aoTocar={() => {
            irPara('registrar');
          }}
        />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-tinta">
          {criando ? t.conta.criarSuaConta : t.conta.bemVindo}
        </h2>
        <p className="text-rotulo text-tinta-suave">
          {criando ? t.conta.subtituloCriar : t.conta.subtituloEntrar}
        </p>
      </div>

      <div className="space-y-4">
        {criando ? (
          <label className="block">
            <span className="text-rotulo font-medium text-tinta-suave">{t.conta.nome}</span>
            <input
              type="text"
              name="nome"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              maxLength={80}
              placeholder={t.conta.exemploNome}
              aria-invalid={temErro}
              {...(temErro ? { 'aria-describedby': idErros } : {})}
              className={CAMPO_TEXTO}
            />
          </label>
        ) : null}

        <label className="block">
          <span className="text-rotulo font-medium text-tinta-suave">{t.conta.email}</span>
          <input
            ref={campoEmail}
            type="email"
            name="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder={t.conta.exemploEmail}
            aria-invalid={temErro}
            {...(temErro ? { 'aria-describedby': idErros } : {})}
            className={CAMPO_TEXTO}
          />
        </label>

        <div>
          <label className="block">
            <span className="text-rotulo font-medium text-tinta-suave">{t.conta.senha}</span>
            <div className="relative">
              <input
                /*
                  key por modo: remonta o campo ao trocar de verbo. Sem isso o
                  gerenciador de senhas continua tratando o mesmo no como
                  current-password e oferece a senha antiga no cadastro.
                */
                key={modo}
                type={senhaVisivel ? 'text' : 'password'}
                name="senha"
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
                autoComplete={criando ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={criando ? 'next' : 'go'}
                aria-invalid={temErro}
                {...descreverSenha(temErro, criando, idErros, idRequisitos)}
                className={`${CAMPO_TEXTO} pr-20`}
              />
              <button
                type="button"
                onClick={() => setSenhaVisivel((visivel) => !visivel)}
                aria-pressed={senhaVisivel}
                className={`absolute inset-y-0 right-0 mt-1.5 rounded-lg px-3 text-rotulo font-medium text-tinta-suave transition-colors hover:text-tinta ${ANEL_FOCO}`}
              >
                {senhaVisivel ? t.conta.ocultar : t.conta.mostrar}
              </button>
            </div>
          </label>

          {criando ? <Requisitos id={idRequisitos} senha={senha} textos={t} /> : null}
        </div>

        {criando ? (
          <div>
            <label className="block">
              <span className="text-rotulo font-medium text-tinta-suave">{t.conta.repitaSenha}</span>
              <input
                type={senhaVisivel ? 'text' : 'password'}
                name="confirmacao"
                value={confirmacao}
                onChange={(evento) => setConfirmacao(evento.target.value)}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={confirmacaoDivergente}
                className={CAMPO_TEXTO}
              />
            </label>
            <p
              aria-live="polite"
              className={`mt-1.5 min-h-[1.125rem] text-rotulo ${
                confirmacaoDivergente ? 'text-saida' : 'text-entrada'
              }`}
            >
              {confirmacao.length === 0
                ? ''
                : confirmacaoDivergente
                  ? t.conta.senhasDiferentes
                  : t.conta.senhasConferem}
            </p>
          </div>
        ) : null}

        {/*
          Marcado por padrao: e o que a pessoa espera de um app de uso diario no
          proprio aparelho. Desmarcar e a escolha consciente de quem esta num
          computador emprestado — e e a ela que a frase de apoio fala.
        */}
        <div className="flex items-start gap-2.5">
          <input
            id={idManter}
            type="checkbox"
            checked={manterConectado}
            onChange={(evento) => setManterConectado(evento.target.checked)}
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border-superficie-forte text-marca accent-marca ${ANEL_FOCO}`}
          />
          <label htmlFor={idManter} className="text-rotulo text-tinta-suave">
            <span className="font-medium text-tinta">{t.conta.manterConectado}</span>
            <span className="block">
              {manterConectado ? t.conta.manterSim : t.conta.manterNao}
            </span>
          </label>
        </div>
      </div>

      {primeiroErro === undefined ? null : (
        <div
          id={idErros}
          role="alert"
          className="rounded-lg border border-saida-borda bg-saida-suave px-3 py-2.5"
        >
          {erros.length === 1 ? (
            <p className="text-rotulo font-medium text-saida-forte">{primeiroErro}</p>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-rotulo font-medium text-saida-forte">
              {erros.map((mensagem) => (
                <li key={mensagem}>{mensagem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-3">
        <button type="submit" disabled={enviando} className={BOTAO_PRIMARIO}>
          {enviando ? rotuloEnviando : rotuloAcao}
        </button>

        {/* O link "ja tem conta?" saiu: o seletor la em cima ja faz esse
            caminho, e repeti-lo aqui gastaria o rodape com navegacao em vez da
            unica coisa que a pessoa quer saber antes de entregar a senha. */}
        <p className="text-center text-rotulo text-tinta-fraca">{t.conta.rodape}</p>
      </div>
    </form>
  );
}

interface SegmentoProps {
  rotulo: string;
  selecionado: boolean;
  aoTocar: () => void;
}

/** Selecionado e o unico que levanta do trilho; o resto e texto apagado. */
function Segmento({ rotulo, selecionado, aoTocar }: SegmentoProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={selecionado}
      className={`min-h-toque rounded-md text-sm font-semibold transition-colors md:min-h-0 md:py-2 ${ANEL_FOCO} ${
        selecionado
          ? 'bg-superficie text-marca shadow-sm'
          : 'text-tinta-suave md:hover:text-tinta'
      }`}
    >
      {rotulo}
    </button>
  );
}

interface RequisitosProps {
  id: string;
  senha: string;
  textos: Textos;
}

/**
 * Checklist ao vivo.
 *
 * Mostra as quatro regras ANTES de a pessoa errar, e vai marcando conforme ela
 * digita. A alternativa — recusar no envio com "senha fraca" — transforma o
 * cadastro num jogo de adivinhacao de regra escondida.
 *
 * `aria-live="polite"` no conjunto, e nao em cada item: quem usa leitor de tela
 * ouve "3 de 4" quando muda, em vez de quatro anuncios a cada tecla.
 */
function Requisitos({ id, senha, textos: t }: RequisitosProps): React.JSX.Element {
  const atendidos = REQUISITOS_DE_SENHA.filter((requisito) => requisito.atende(senha)).length;

  return (
    <div id={id} className="mt-2">
      <p className="sr-only" aria-live="polite">
        {t.conta.requisitosAtendidos(atendidos, REQUISITOS_DE_SENHA.length)}
      </p>

      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {REQUISITOS_DE_SENHA.map((requisito) => {
          const ok = requisito.atende(senha);
          return (
            <li
              key={requisito.chave}
              className={`flex items-center gap-1.5 text-rotulo ${
                ok ? 'text-entrada' : 'text-tinta-fraca'
              }`}
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ok ? <path d="m3.5 8.5 3 3 6-7" /> : <circle cx="8" cy="8" r="5.5" />}
              </svg>
              {t.conta.requisitos[requisito.chave]}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * `exactOptionalPropertyTypes` recusa `aria-describedby={undefined}`, entao o
 * atributo e espalhado ou nao existe — nunca existe valendo undefined.
 */
function descreverSenha(
  temErro: boolean,
  criando: boolean,
  idErros: string,
  idRequisitos: string,
): { 'aria-describedby'?: string } {
  if (temErro && criando) {
    return { 'aria-describedby': `${idErros} ${idRequisitos}` };
  }
  if (temErro) {
    return { 'aria-describedby': idErros };
  }
  if (criando) {
    return { 'aria-describedby': idRequisitos };
  }
  return {};
}
