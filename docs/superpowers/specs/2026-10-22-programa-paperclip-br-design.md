# Programa Paperclip BR — desenho e decisões

**Data:** 2026-10-22
**Autor:** Best Code
**Estado:** aprovado; item B em execução

## O pedido original

Quatro coisas, pedidas juntas:

1. Versão brasileira do `papercliporg.com`, publicando exemplos de empresas
   por tipo de negócio
2. Tradução do Paperclip para português, com custo em reais
3. Pacotes de empresa por setor
4. As fábricas do janus como concorrente do Paperclip

## Decomposição

São quatro projetos independentes, com custo separado por ordens de
grandeza:

| | Projeto | Tamanho |
|---|---|---|
| **A** | Site BR sob marca própria | Médio — o site do `papercliporg.com` não está no repo open source |
| **B** | Acervo de pacotes `agentcompanies/v1` | Pequeno, conteúdo puro |
| **C1** | `BRL` em `SUBSCRIPTION_CURRENCIES` | Uma linha |
| **C2** | pt-BR na UI web | Enorme — internacionalizar 1399 componentes |
| **D** | Fábricas do janus | Brainstorm próprio |

**Ordem decidida: B → C1 → A → C2 → D.**

## Decisão 1 — não forkear o Paperclip

Medição do upstream em 2026-10-22, nos últimos 30 dias:

| Métrica | Valor |
|---|---|
| Commits | 981 (~33/dia) |
| Commits em 7 dias | 226 |
| Autores ativos | 35 |
| Arquivos distintos tocados | 6.915 |
| Tamanho | 8.291 arquivos ts/tsx, 2,6 M linhas |

Churn por área, mesmo período:

| Área | Commits | Leitura |
|---|---|---|
| `docs/companies` (a spec) | 0 | Congelada |
| `packages/plugins/sdk` | 29 | Costura estável |
| `cli` | 30 | Estável |
| `packages/shared/src` | 159 | Esquenta |
| `ui/src` | 252 | Quente |
| `server/src` | 636 | Núcleo — 65% de todo commit |

**O SDK de plugin é 22× mais estável que o núcleo.** Arquivo mais churnado:
`server/src/services/heartbeat.ts`, 132 commits em 30 dias.

### A linha de irreversibilidade

`packages/db/src/migrations` é uma cadeia de migração de banco. Ao
adicionar migração que diverge da cadeia do upstream, os dois lados passam
a reivindicar números de versão e **nunca mais há merge limpo de schema**.
Todo outro custo de fork é dor recorrente; esse é via de mão única.

### Regra de decisão adotada

> Customização atrás de costura — adapter, driver de ambiente, workspace
> provider, painel de UI, skills, pacotes de empresa — vira **plugin**, e
> não custa manutenção.
>
> Customização que muda modelo de dados, ciclo de orquestração ou
> migrações não é customizar o Paperclip: é construir outro produto. Esse
> produto já existe e é o **janus**.

### Caso particular: i18n num fork

Extrair string crua reescreve os nós de texto do JSX — as mesmas linhas
que todo commit de feature toca. Num fork, cada um dos 1399 componentes
vira zona de conflito permanente. Como PR aceita, cada tela extraída fica
permanente e sem conflito. **O fork torna a C2 mais difícil, não mais
fácil.**

## Decisão 2 — marca própria no site

A licença MIT cobre o software. Não cobre a marca Paperclip nem o texto e
o layout do `papercliporg.com`, que não estão no repo e portanto não foram
licenciados.

Decisão: o site BR nasce com **marca Best Code**, como recurso brasileiro
sobre operar empresas de agentes — cobrindo Paperclip agora e janus
depois. Mesmo conteúdo, mesmo SEO, sem reposicionamento quando o item D
entrar, e sem construir audiência sob marca de terceiro para depois
concorrer com ela.

## Decisão 3 — o acervo é o entregável de Fase 1 produtizado

Achado que reenquadrou o item B. Os entregáveis #2 e #3 da proposta de
implantação são *"desenho do organograma de agentes com fronteira de
permissão por papel"* e *"política de orçamento, escalonamento e portões
de aprovação"* — vendidos como Fase 1, duas semanas.

Um pacote `agentcompanies/v1` codifica exatamente isso: `agents/` é o
organograma, o frontmatter carrega a fronteira, `requirements.secrets`
declara o que o papel toca. Cada pacote escrito converte duas semanas de
descoberta em template de partida, e torna a Opção C da proposta (piloto
antes do compromisso) quase gratuita de entregar.

## Decisão 4 — portabilidade, não lock-in

A spec `agentcompanies/v1` é vendor-neutral por desenho e declara-o:
*"intended to be usable by any agent-company runtime, not only
Paperclip"*. Implementar o formato no janus é uso previsto. O acervo roda
nos dois, e é o único ativo do programa que sobrevive integralmente ao
item D.

## Decisão 5 — cliente em repositório privado

Variação de cliente contém nome sob sigilo e não entra no acervo público.
Separação adotada:

| Repositório | Visibilidade | Conteúdo |
|---|---|---|
| `empresas-de-agentes` | público (a confirmar no push) | pacotes genéricos |
| `empresas-de-agentes-clientes` | **privado** | variações por cliente |

A variação referencia o genérico por `sources` / `usage: referenced`
(§12), não por cópia — um organograma, não N cópias divergentes.

## Pendências registradas

- [ ] **Pinagem:** após o primeiro push do acervo, trocar `branch: main`
      por `commit: <sha>` + `sha256` nas entradas de `sources` do repo de
      clientes. Modo estrito falha fechado sem commit.
- [ ] **C1:** PR para `packages/shared/src/subscriptions.ts:5` acrescentando
      `"BRL"` a `SUBSCRIPTION_CURRENCIES`.
- [ ] **Câmbio (segunda metade do item "custos em reais"):** camada de
      conversão de custo de uso USD→BRL exige fonte de cotação e
      data-de-referência. Projeto próprio, não decidido aqui.
- [ ] **C2:** extração de i18n incremental, tela por tela, upstream. O
      scaffolding existe e está montado (`ui/src/i18n/index.ts`), com
      adoção em 1 de 1399 componentes e `pt-BR.json` já presente com 3
      strings.
- [ ] **A:** site, após B render.
- [ ] **D:** fábricas do janus — brainstorm próprio.
