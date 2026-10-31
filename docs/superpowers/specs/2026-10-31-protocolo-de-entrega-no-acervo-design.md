# Protocolo de entrega (Task Envelope/Delivery Report) no acervo

**Data:** 2026-10-31
**Autor:** Best Code
**Estado:** proposto, aguardando revisão

## Origem

O cliente Jacto (`sdlc-ai-centric`, branch `develop`) construiu, por conta
própria, um pacote de 7 agentes para o mesmo runtime-alvo (Paperclip) e
chegou às mesmas regras de design que este acervo já tinha fechado — stack é
skill não papel, um dono por tarefa, ninguém aprova o próprio trabalho.
Onde o pacote dele é mais forte: o protocolo de entrada/saída (`Task
Envelope`/`Delivery Report`) mapeia campo a campo para o ciclo de vida da
issue no Paperclip (`done/partial/blocked/needs_clarification/failed`).
Hoje esse protocolo vive só como prosa YAML dentro de um `SKILL.md`, sem
nenhuma validação cruzando o que está escrito ali com o que o pacote
declara em outro lugar — exatamente a classe de defeito que `E10`
(`prosa-contradiz-capacidade`) já existe para caçar, só que numa fronteira
diferente.

Este documento propõe fechar essa lacuna no nosso acervo, mantendo todas as
garantias que o pacote do cliente não tem: schema validável, bindings
multi-runtime, persona fora do prompt.

## O que já temos e este desenho não muda

- `metadata.human_gates` com `signer` nomeado e `triggers` de comando
- `metadata.capabilities` em vocabulário fechado, cruzado com `boundary`
- `bindings/*.yml` com os quatro estados (`translates`/`preserves`/`loses`/`not_emitted`)
- Persona fora do prompt, exceto `signature_question`

## Decisão 1 — nova chave `metadata.task_protocol`, só em `COMPANY.md`

Segue o princípio já fechado em `SCHEMA.md` §1: extensão sob `metadata.*`,
nunca chave de topo nova. `task_protocol` é de empresa, não de papel —
mesma razão de `human_gates` viver em `COMPANY.md` e não em cada
`AGENTS.md`: o status de uma entrega é um contrato entre todos os papéis,
não uma preferência de um papel isolado.

```yaml
metadata:
  task_protocol:
    version: 1
    envelope_required: [task_id, assignee, acceptance_criteria, definition_of_done]
    report_required: [task_id, agent, status, verification, acceptance_criteria_status]
    skill_ref: task-envelope        # opcional — nome do skill que documenta o protocolo em prosa
    statuses:
      - id: done
        description: todos os critérios atendidos e verificados
        on_runtime: wake_blocked
      - id: partial
        description: parte entregue; o restante vira issue de follow-up
        on_runtime: create_followup_issue
      - id: blocked
        description: dependência externa não resolvida
        on_runtime: wake_on_unblock
      - id: needs_clarification
        description: requisito ambíguo
        on_runtime: notify_assignee_chain
      - id: failed
        description: esgotou budget.max_iterations
        on_runtime: escalate_to_role
        escalate_to: tech-lead
```

**`on_runtime` é vocabulário fechado**, igual `capabilities.read`/`write` —
cinco valores: `wake_blocked`, `create_followup_issue`, `wake_on_unblock`,
`notify_assignee_chain`, `escalate_to_role`. Entra em `capabilities/v1.md`
como uma terceira lista fechada, não como propriedade nova do `capabilities`
existente — não é uma capacidade de papel, é semântica de protocolo.

**Opcional e aditivo**, como `human_gates`: pacote sem `task_protocol`
continua válido. Zero dos 8 pacotes publicados quebra.

## Decisão 2 — a skill em prosa continua existindo, mas passa a ser verificada contra a declaração

Não propomos gerar `skills/task-envelope/SKILL.md` por código — isso seria
um gerador novo para um ganho pequeno. Propomos que ele continue escrito à
mão, como `criterio-de-verificacao` hoje, e que o validador cruze os dois:
o conjunto de `status:` documentado no corpo do skill referenciado por
`task_protocol.skill_ref` tem que ser exatamente `statuses[].id`.

Isso é a mesma family de regra que `E10`, numa fronteira nova: prosa e
declaração têm que concordar, e divergência reprova, não avisa.

## Decisão 3 — duas regras novas no validador

| Código proposto | Regra | O que rejeita |
|---|---|---|
| `E21` | `protocolo-mapa-invalido` | `task_protocol.statuses[].on_runtime` fora do vocabulário fechado, ou `escalate_to_role` sem `escalate_to` nomeando um papel que existe no pacote |
| `E22` | `protocolo-skill-diverge` | Pacote declara `task_protocol.skill_ref` apontando para uma skill cujo corpo documenta um enum de `status` diferente do declarado em `statuses[].id` (conjunto, não ordem) |

Aviso novo, não erro — `W06` `protocolo-sem-skill`: pacote declara
`task_protocol` mas nenhum papel anexa a skill de `skill_ref`. Não reprova
porque o protocolo pode ser consumido só pela plataforma (ex. pelo Studio),
sem nenhum papel precisar ler a prosa.

## Decisão 4 — nova linha na tabela de bindings (`SCHEMA.md` §8.1)

| Runtime | Estado | Por quê |
|---|---|---|
| `paperclip` | **translates** | `statuses[].id` mapeia 1:1 para o ciclo de vida nativo da issue (`done`/`blocked`/`in_review`) — é o único runtime com rastreador de issue embutido |
| `claude-code` | `not_emitted` | Mecanismo real não existe hoje (sem rastreador de issue no runtime); `falta`: "sem rastreador de issue, o status fica documentado, não automatizado" |
| `opencode` (V2) | `not_emitted` | Mesma lacuna — `ConfigAgent.Info` não tem conceito de issue |
| `portable` | **preserves** | Desenho próprio; nenhum runtime concreto por trás para agir |

Nenhuma célula nova é `loses` — o dado sempre sobrevive no `COMPANY.md`
emitido; o que varia é se o runtime **age** sobre ele.

`janus` continua fora da tabela, pela razão já registrada em `SCHEMA.md`
§8.2: não tem formato de papel persistente — e, portanto, não tem onde
amarrar `task_protocol` a uma issue, porque não tem issue.

## O que isto NÃO propõe

- Não propõe adotar `skills_hint`/`skills_loaded` do pacote do cliente —
  é uma ideia boa (carregar skill antes de editar código é a primeira ação
  obrigatória), mas é ortogonal a este desenho: pode entrar depois como
  campo opcional de `envelope_required`/`report_required`, sem reabrir esta
  decisão.
- Não propõe gerador de skill a partir do schema (Decisão 2).
- Não propõe migrar os 8 `COMPANY.md` existentes — isso é rollout, decisão
  separada de quando e para quais pacotes, depois que o schema e o
  validador existirem.

## Próximo passo

Plano de implementação (writing-plans): schema (`capabilities/v1`),
validador (`tools/rules.mjs`, dois erros + um aviso), teste adversarial
(`test/rules-governanca.test.mjs`), `SCHEMA.md` (documentar `E21`/`E22`/`W06`
e a nova linha de bindings), e `software-house` como primeiro adotante —
hoje não tem `skills/task-envelope`, então ganha a skill nova e
`metadata.task_protocol` no mesmo lote, provando a regra contra um pacote
real em vez de só um fixture.
