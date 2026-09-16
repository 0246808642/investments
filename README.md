# Investments

Controle de gastos pessoais. Web app instalável no celular, com backend próprio.

**Produção:** https://investments-blue.vercel.app

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind |
| Persistência local | IndexedDB (Dexie) |
| Backend | .NET 10 · ASP.NET Core Minimal APIs |
| Banco | PostgreSQL (EF Core) |
| Identidade | ASP.NET Identity + JWT Bearer |
| Hospedagem | Vercel — frontend e API como dois serviços do mesmo projeto |

Frontend e API dividem o mesmo domínio: `/api/*` e `/saude` vão para o container
.NET, o resto para o build estático. Sendo mesma origem, não há CORS no caminho
crítico — nem preflight, nem lista de origens para manter.

---

## Rodando localmente

Pré-requisitos: Node 20+, .NET 10 SDK, Docker.

```bash
# 1. Postgres de desenvolvimento
cd backend && docker compose up -d postgres

# 2. Segredo do token (uma vez por máquina; nunca vai para o repositório)
cd src/Financeiro.Api
dotnet user-secrets init
dotnet user-secrets set "Jwt:Chave" "<48 bytes aleatórios em base64>"

# 3. API — sobe em http://localhost:5148
dotnet run

# 4. Frontend — sobe em http://localhost:5173
cd ../../.. && npm install && npm run dev
```

O Vite faz proxy de `/api` e `/saude` para `localhost:5148`, então o
desenvolvimento tem a mesma forma da produção: o navegador só conhece uma origem.

### Comandos

```bash
npm run dev         # Vite com proxy
npm run build       # tsc --noEmit && vite build
npm run typecheck

cd backend
dotnet test         # 350 testes
dotnet run --project src/Financeiro.Api -- --migrar   # aplica migrations e sai
```

### Trocar a senha de uma conta

Quem **sabe** a senha atual troca dentro do app, na folha de conta: "Seus dados"
→ "Alterar senha" (`POST /api/autenticacao/senha`, que exige a senha atual mesmo
havendo token — aparelho destravado por um minuto não pode virar conta perdida).
O nome de exibição fica ao lado, no mesmo lugar.

O que não existe é "esqueci minha senha": não há envio de e-mail configurado, e
um endpoint que troca senha sem provar quem pediu seria pior do que não ter.
Para esse caso — e só para ele — quem tem a conexão do banco troca pela linha de
comando:

```bash
cd backend/src/Financeiro.Api

# banco local (usa a connection string do appsettings.Development.json)
dotnet run -- --redefinir-senha alguem@exemplo.com

# banco de produção — o ambiente Production ignora o appsettings.Development.json,
# então a conexão vem da DATABASE_URL e nenhum banco é alcançado por engano
ASPNETCORE_ENVIRONMENT=Production DATABASE_URL="postgres://..." dotnet run --no-launch-profile -- --redefinir-senha alguem@exemplo.com
```

Sem a senha no comando ela é lida da entrada padrão, sem eco — assim não fica no
histórico do shell. O comando imprime `host/banco` antes de escrever, e avisa
quando a senha nova não atenderia à política do cadastro (ele aplica mesmo
assim: quem tem o banco na mão é quem decide).

---

## Configuração e segredos

**Nenhum segredo de produção existe neste repositório**, nem no histórico.

| Variável | Onde vive | O que é |
|---|---|---|
| `DATABASE_URL` | Vercel (Sensitive), injetada pelo Neon | Conexão do Postgres |
| `Jwt__Chave` | Vercel (Sensitive) | Chave de assinatura HMAC-SHA256, mín. 32 bytes |
| `PORT` | Vercel (Config) | `8080` — o container roda sem privilégio e não abre porta baixa |
| `CONEXAO_PRODUCAO` | GitHub Secrets | Mesma conexão, usada só pelo passo de migração |
| `VERCEL_TOKEN` | GitHub Secrets | Deploy pelo CI |
| `Jwt:Chave` (local) | `dotnet user-secrets` | Fora da árvore de arquivos |

A aplicação aceita a conexão em dois formatos: `ConnectionStrings:Financeiro` no
formato de palavras-chave do Npgsql (desenvolvimento) ou `DATABASE_URL` no
formato URI (produção). A conversão está em `ConexaoPostgres`.

Nada tem valor padrão de produção: chave ausente ou curta derruba a aplicação na
primeira resolução do serviço, em vez de assinar token com segredo previsível.

> A senha `financeiro_dev`, que aparece no `docker-compose.yml` e nos testes, é do
> Postgres de desenvolvimento — um container que só escuta em `localhost`. É
> fixture, não segredo.

---

## Deploy

`git push` na `main` dispara a GitHub Action:

```
migrations  ──passou──>  vercel deploy --prod
     │
     └──falhou──>  deploy abortado, versão anterior continua servindo
```

As migrations rodam **antes** do tráfego. A Vercel não tem `release_command`,
então o portão vive no CI: nenhuma instância sobe com schema defasado, e migration
quebrada não vira crash loop.

O deploy automático da integração Git fica desligado no `vercel.json` de
propósito — dois caminhos de publicação significariam um deles não esperando a
migração.

---

## Decisões que valem saber antes de mexer

- **Dinheiro é sempre inteiro em centavos**, com *branded type* no TypeScript e
  `readonly record struct` no C#. Float não entra: `0.1 + 0.2 !== 0.3` vira
  centavo perdido em soma de extrato.
- **Data é sempre a string `YYYY-MM-DD`**, nunca `Date`. `Date` carrega hora e
  fuso, e desloca o dia ao passar por `toISOString()`.
- **Exclusão é lógica** (`deletedAt`), nunca `DELETE`.
- **O id nasce no cliente** (UUID v4), inclusive offline. O servidor nunca cria
  identidade.
- **Comentário explica o porquê, nunca o quê.** A convenção vale no repositório
  inteiro.

---

## Estrutura

```
src/                      frontend
├─ types/                 dinheiro, data, modelos
├─ db/                    IndexedDB e consultas
├─ api/                   cliente HTTP, sessão, contratos
└─ components/            UI por feature

backend/
├─ src/Financeiro.Domain           regras e value objects, sem dependências
├─ src/Financeiro.Application      casos de uso e portas
├─ src/Financeiro.Infrastructure   EF Core, Identity, relógio
├─ src/Financeiro.Api              minimal APIs, DI, middleware
└─ tests/                          um projeto de teste por camada
```
