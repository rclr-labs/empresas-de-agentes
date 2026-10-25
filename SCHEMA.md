# SCHEMA — como `agentcompanies/v1` é estendido neste acervo

Este documento descreve a extensão própria deste acervo sobre o formato
`agentcompanies/v1`: onde ela mora, quais chaves ela introduz, e as duas
decisões — princípio de extensão e exclusão da persona do prompt — que o
resto do código assume como verdadeiras.

## 1. Princípio: extensão só sob `metadata.*`

Tudo que este acervo adiciona ao formato — persona, fronteira de permissão,
capacidades, memória, contexto, orçamento, portões humanos — mora dentro de
`metadata.*`, em todo arquivo (`COMPANY.md`, `AGENTS.md`, `SKILL.md`,
`TEAM.md`, `TASK.md`). Nenhuma extensão cria chave de topo nova.

A razão é mensurável, não estética: o `docs/companies` upstream — a própria
especificação — teve **zero commits em 30 dias**. A spec está congelada.
Uma chave de topo nova é um campo que uma ferramenta de terceiro, validando
contra a spec congelada, não conhece — e dependendo de como valida, pode
rejeitar o arquivo inteiro. Uma chave sob `metadata` é, para essa mesma
ferramenta, apenas um objeto que ela ignora: o pacote continua válido.

Isto inclui o **Paperclip**, a implementação open-source do formato. Um
pacote escrito aqui tem de abrir no Paperclip sem erro, mesmo que o
Paperclip não leia `metadata.persona` — e só continua assim enquanto a
extensão não sai de `metadata`.

Consequência prática: ao propor um campo novo, a primeira pergunta não é
"que nome ele tem", é "ele cabe em `metadata`, ou meu formato quer ser
top-level". Se quer ser top-level, a resposta é esperar a spec descongelar
e propor upstream — não declarar e torcer.

## 2. Chaves canônicas

Sete chaves, todas dentro de `metadata`:

| Chave | Onde aparece | O que declara |
|---|---|---|
| `persona` | `AGENTS.md` | Como o agente se apresenta a um humano: nome de exibição, ícone, pronomes, resumo de uma linha, histórico, forças, pergunta de assinatura |
| `boundary` | `AGENTS.md` | O que o papel pode e não pode fazer, em prosa — a fronteira legível por humano |
| `capabilities` | `AGENTS.md` | A mesma fronteira, em forma validável: leitura, escrita, execução, rede, delegação, aprovação — ver `capabilities/v1.md` |
| `memory` | `AGENTS.md` | Escopo e retenção de memória do agente |
| `context` | `AGENTS.md` | De onde o agente lê contexto antes de agir, e o que fica fora |
| `budget` | `COMPANY.md` | Teto de gasto, moeda, limiar de alerta e destinatário |
| `human_gates` | `COMPANY.md` | A lista de ações que não acontecem sem assinatura humana nomeada |

`capability_vocabulary` também vive em `metadata` (normalmente em
`COMPANY.md`) e declara qual versão do vocabulário de capacidades o pacote
segue — hoje, sempre `capabilities/v1`.

## 3. Alias pt-BR

Quatorze chaves de `metadata.*` têm um alias em português, aceito na
leitura e nunca emitido na escrita. `normalizeAliases` (em `tools/rules.mjs`)
reescreve o alias para o canônico ao carregar o pacote; quando as duas
formas coexistem no mesmo arquivo, o canônico vence e o alias é descartado
com aviso — nenhum dos dois é perdido em silêncio.

| Alias pt-BR | Canônico |
|---|---|
| `fronteira` | `boundary` |
| `pode` | `can` |
| `nao_pode` | `cannot` |
| `capacidades` | `capabilities` |
| `orcamento` | `budget` |
| `moeda` | `currency` |
| `teto_mensal` | `monthly_cap` |
| `alerta_em` | `alert_at` |
| `destinatario_do_alerta` | `alert_to` |
| `alerta_para` | `alert_to` |
| `portoes_humanos` | `human_gates` |
| `memoria` | `memory` |
| `contexto` | `context` |
| `vocabulario_de_capacidades` | `capability_vocabulary` |

Dois aliases diferentes apontam para o mesmo canônico (`destinatario_do_alerta`
e `alerta_para`, ambos → `alert_to`): é por isso que a colisão entre dois
aliases para a mesma chave — não só alias contra canônico — tem checagem
própria em `normalizeAliases`.

Pacote novo escrito a partir deste acervo usa sempre a forma canônica. O
alias existe para não quebrar um pacote escrito antes desta convenção, não
para dar duas formas igualmente válidas de escrever pacote novo.

## 4. Exemplo completo de `AGENTS.md`

```markdown
---
name: Gerente
title: Gerente
slug: gerente
reportsTo: null
skills: []
metadata:
  persona:
    display_name: Fixture Silva
    icon: "🧪"
    pronouns: ela/dela
    headline: Persona de fixture
    background:
      - Existe para o teste ter o que carregar
    strengths: [parsing]
    signature_question: "Isso carregou?"
  boundary:
    can: [ler o repositório]
    cannot: [fazer deploy]
  capabilities:
    read: [repository]
    write: []
    execute: { allow: [], deny: [] }
    network: false
    delegate: []
    approve: [deploy-producao]
  memory: { scope: project, retention: project, writes: [] }
  context: { sources: [], excludes: [] }
---

# Gerente

Corpo do agente.
```

`capabilities.approve` referencia `deploy-producao` — o `id` de um dos
`human_gates` declarados em `COMPANY.md` (seção 5). É essa referência que
amarra "o que este papel pode aprovar" a "o que exige assinatura humana":
sem o `id`, não há como o validador confirmar que o portão referenciado
existe.

## 5. Exemplo completo de `COMPANY.md`

```markdown
---
name: Pacote Mínimo
description: Exemplo de pacote completo
slug: pacote-minimo
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 100.00
    alert_at: 0.7
    alert_to: gerente
  human_gates:
    - id: deploy-producao
      description: deploy em produção
      signer: pessoa nomeada no kickoff
---

# Pacote Mínimo

Corpo do pacote.
```

Note o `id` em cada entrada de `human_gates` — é a diferença entre um
portão que só um humano lê (a lista de frases do `software-house/COMPANY.md`
anterior a esta extensão) e um portão que um papel pode referenciar de
dentro de `capabilities.approve`. Sem `id`, a referência não tem o que
apontar.

## 6. A persona não entra no prompt

`metadata.persona` existe para o humano que olha o organograma, para o
Studio que desenha o card do agente, e para quem está decidindo se aquele
papel é o certo para a tarefa. Ela não entra no prompt do modelo.

A razão é custo sem retorno: `background` e `strengths` são texto que seria
enviado em **toda chamada** ao modelo, e não mudam nenhum comportamento —
o agente não age diferente por saber que a própria persona tem três linhas
de histórico. Pagar esse custo em cada chamada, para um benefício que existe
só na tela, é o tipo de gasto que confirma por que `budget` e `alert_to`
precisam existir no primeiro lugar.

A única parte da persona que chega a um emissor de runtime é
`persona.headline` — e só como a `description` do agente, o resumo de uma
linha que uma plataforma usa para listar o papel. `display_name`, `icon`,
`pronouns`, `background`, `strengths` e `signature_question` ficam fora de
qualquer emissor: eles servem para construir a página, não a chamada.
