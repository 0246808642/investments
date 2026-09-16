import { useState } from 'react';
import type * as React from 'react';

import { useSessao } from '../../hooks/useSessao';
import { useTextos } from '../../i18n';
import type { Sessao } from '../../db/sincronizacao';
import { REQUISITOS_DE_SENHA } from './FormularioDeConta';
import { ANEL_FOCO, BOTAO_PRIMARIO, BOTAO_TEXTO, CAMPO_TEXTO } from './estilos';

type Aberto = 'nenhum' | 'nome' | 'senha';

export interface PainelDePerfilProps {
  sessao: Sessao;
}

/**
 * Trocar nome e senha, dentro da folha de conta.
 *
 * Os dois ficam FECHADOS por padrao, atras de dois botoes de texto. Sao acoes
 * raras — a pessoa abre esta folha para ver se sincronizou, nao para mudar o
 * nome — e dois formularios sempre abertos empurrariam o que ela veio ver para
 * baixo da dobra.
 *
 * Um de cada vez: abrir o de senha fecha o de nome. Dois formularios abertos com
 * campos parecidos e a receita para digitar a senha nova no campo errado.
 */
export function PainelDePerfil({ sessao }: PainelDePerfilProps): React.JSX.Element {
  const t = useTextos();
  const [aberto, setAberto] = useState<Aberto>('nenhum');
  /** Frase de sucesso da ultima troca. Some assim que outro formulario abre. */
  const [feito, setFeito] = useState<string | null>(null);

  function alternar(qual: Aberto): void {
    setFeito(null);
    setAberto((atual) => (atual === qual ? 'nenhum' : qual));
  }

  return (
    <div className="rounded-lg border border-superficie-borda px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-rotulo font-medium text-tinta">{t.conta.seusDados}</h3>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-expanded={aberto === 'nome'}
            onClick={() => {
              alternar('nome');
            }}
            className={`${BOTAO_TEXTO} ${aberto === 'nome' ? 'bg-superficie-fundo text-tinta' : ''}`}
          >
            {t.conta.alterarNome}
          </button>
          <button
            type="button"
            aria-expanded={aberto === 'senha'}
            onClick={() => {
              alternar('senha');
            }}
            className={`${BOTAO_TEXTO} ${aberto === 'senha' ? 'bg-superficie-fundo text-tinta' : ''}`}
          >
            {t.conta.alterarSenha}
          </button>
        </div>
      </div>

      {aberto === 'nenhum' ? (
        <p className="text-rotulo text-tinta-fraca">{sessao.email}</p>
      ) : null}

      {feito === null ? null : (
        <p aria-live="polite" className="mt-1 text-rotulo font-medium text-entrada">
          {feito}
        </p>
      )}

      {aberto === 'nome' ? (
        <FormularioDeNome
          sessao={sessao}
          aoConcluir={(nome) => {
            setAberto('nenhum');
            setFeito(t.conta.nomeAlterado(nome));
          }}
        />
      ) : null}

      {aberto === 'senha' ? (
        <FormularioDeSenha
          aoConcluir={() => {
            setAberto('nenhum');
            setFeito(t.conta.senhaAlterada);
          }}
        />
      ) : null}
    </div>
  );
}

interface FormularioDeNomeProps {
  sessao: Sessao;
  aoConcluir: (nome: string) => void;
}

function FormularioDeNome({ sessao, aoConcluir }: FormularioDeNomeProps): React.JSX.Element {
  const { alterarNome } = useSessao();
  const t = useTextos();

  // Comeca com o nome atual: trocar "Caique" por "Caique Pinheiro" e editar, nao
  // redigitar. Campo vazio obrigaria a escrever tudo de novo por uma correcao.
  const [nome, setNome] = useState(() => sessao.nome ?? '');
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<readonly string[]>([]);

  async function enviar(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (enviando) {
      return;
    }

    // Mesma normalizacao do servidor, para o "e o mesmo nome" abaixo nao depender
    // de um espaco a mais que o backend ia aparar de qualquer jeito.
    const limpo = nome.trim().replace(/\s+/g, ' ');
    if (limpo.length < 2) {
      setErros([t.conta.nomeCurto]);
      return;
    }
    if (limpo === (sessao.nome ?? '')) {
      setErros([t.conta.nomeIgual]);
      return;
    }

    setEnviando(true);
    setErros([]);
    const resultado = await alterarNome(limpo);
    setEnviando(false);

    if (resultado.ok) {
      aoConcluir(limpo);
      return;
    }
    setErros(resultado.erros.length > 0 ? resultado.erros : [t.conta.erroGenerico]);
  }

  return (
    <form
      onSubmit={(evento) => {
        void enviar(evento);
      }}
      className="mt-3 space-y-3"
    >
      <label className="block">
        <span className="text-rotulo font-medium text-tinta-suave">{t.conta.nomeNovo}</span>
        <input
          type="text"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={80}
          autoFocus
          className={CAMPO_TEXTO}
        />
      </label>

      <ListaDeErros erros={erros} />

      <button type="submit" disabled={enviando} className={BOTAO_PRIMARIO}>
        {enviando ? t.comum.salvando : t.comum.salvar}
      </button>
    </form>
  );
}

interface FormularioDeSenhaProps {
  aoConcluir: () => void;
}

function FormularioDeSenha({ aoConcluir }: FormularioDeSenhaProps): React.JSX.Element {
  const { alterarSenha } = useSessao();
  const t = useTextos();

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<readonly string[]>([]);

  /** As mesmas quatro regras do cadastro, pela mesma lista — nao uma copia dela. */
  const faltando = REQUISITOS_DE_SENHA.filter((requisito) => !requisito.atende(nova));

  function validar(): string[] {
    const problemas: string[] = [];
    if (atual.length === 0) {
      problemas.push(t.conta.informeSenhaAtual);
    }
    if (nova.length === 0) {
      problemas.push(t.conta.informeSenhaNova);
      return problemas;
    }
    if (faltando.length > 0) {
      problemas.push(t.conta.senhaPrecisa(faltando.map((r) => t.conta.requisitos[r.chave]).join(', ')));
    }
    if (nova === atual) {
      problemas.push(t.conta.senhaNovaIgual);
    }
    if (confirmacao !== nova) {
      problemas.push(t.conta.senhasDiferentes);
    }
    return problemas;
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (enviando) {
      return;
    }

    const problemas = validar();
    if (problemas.length > 0) {
      setErros(problemas);
      return;
    }

    setEnviando(true);
    setErros([]);
    const resultado = await alterarSenha(atual, nova);
    setEnviando(false);

    if (resultado.ok) {
      // Saem da memoria assim que deixam de ser necessarias.
      setAtual('');
      setNova('');
      setConfirmacao('');
      setVisivel(false);
      aoConcluir();
      return;
    }
    setErros(resultado.erros.length > 0 ? resultado.erros : [t.conta.erroGenerico]);
  }

  return (
    <form
      onSubmit={(evento) => {
        void enviar(evento);
      }}
      className="mt-3 space-y-3"
    >
      <label className="block">
        <span className="text-rotulo font-medium text-tinta-suave">{t.conta.senhaAtual}</span>
        <input
          type="password"
          value={atual}
          onChange={(evento) => setAtual(evento.target.value)}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          className={CAMPO_TEXTO}
        />
      </label>

      <div>
        <label className="block">
          <span className="text-rotulo font-medium text-tinta-suave">{t.conta.senhaNova}</span>
          <div className="relative">
            <input
              type={visivel ? 'text' : 'password'}
              value={nova}
              onChange={(evento) => setNova(evento.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`${CAMPO_TEXTO} pr-20`}
            />
            <button
              type="button"
              onClick={() => setVisivel((atualVisivel) => !atualVisivel)}
              aria-pressed={visivel}
              className={`absolute inset-y-0 right-0 mt-1.5 rounded-lg px-3 text-rotulo font-medium text-tinta-suave transition-colors hover:text-tinta ${ANEL_FOCO}`}
            >
              {visivel ? t.conta.ocultar : t.conta.mostrar}
            </button>
          </div>
        </label>

        {/* O checklist ao vivo, igual ao do cadastro: recusar no envio com "senha
            fraca" faria a pessoa adivinhar qual das quatro regras quebrou. */}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {REQUISITOS_DE_SENHA.map((requisito) => {
            const ok = requisito.atende(nova);
            return (
              <li
                key={requisito.chave}
                className={`text-rotulo ${ok ? 'text-entrada' : 'text-tinta-fraca'}`}
              >
                {ok ? '✓ ' : '• '}
                {t.conta.requisitos[requisito.chave]}
              </li>
            );
          })}
        </ul>
      </div>

      <label className="block">
        <span className="text-rotulo font-medium text-tinta-suave">{t.conta.repitaSenhaNova}</span>
        <input
          type={visivel ? 'text' : 'password'}
          value={confirmacao}
          onChange={(evento) => setConfirmacao(evento.target.value)}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={confirmacao.length > 0 && confirmacao !== nova}
          className={CAMPO_TEXTO}
        />
      </label>

      <ListaDeErros erros={erros} />

      <button type="submit" disabled={enviando} className={BOTAO_PRIMARIO}>
        {enviando ? t.comum.salvando : t.comum.salvar}
      </button>
    </form>
  );
}

interface ListaDeErrosProps {
  erros: readonly string[];
}

/**
 * Todos os motivos de uma vez, como no cadastro: mostrar so o primeiro faz a
 * pessoa corrigir, reenviar e levar outra recusa.
 */
function ListaDeErros({ erros }: ListaDeErrosProps): React.JSX.Element | null {
  const primeiro = erros[0];
  if (primeiro === undefined) {
    return null;
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-saida-borda bg-saida-suave px-3 py-2.5 text-rotulo font-medium text-saida-forte"
    >
      {erros.length === 1 ? (
        <p>{primeiro}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4">
          {erros.map((mensagem) => (
            <li key={mensagem}>{mensagem}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
