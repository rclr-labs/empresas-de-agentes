---
name: task-envelope
description: Contrato de entrada (Task Envelope) e saída (Delivery Report) entre papéis — use ao receber uma tarefa, ao delegar para outro papel, e antes de concluir qualquer tarefa
metadata:
  paperclip:
    tags:
      - governanca
      - entrega
---

# Task Envelope & Delivery Report

Todo trabalho chega como **Task Envelope** e sai como **Delivery Report**.
O `id` de cada status abaixo é o mesmo declarado em
`metadata.task_protocol.statuses` do `COMPANY.md` deste pacote — divergir
daqui reprova o pacote (`E22`).

## Entrada — Task Envelope

```yaml
task_id: "TASK-142"
assignee: "<slug do papel responsável>"
acceptance_criteria:
  - "critério objetivo e verificável, no formato Given/When/Then"
definition_of_done:
  - "Testes verdes"
  - "Critério de verificação (skill criterio-de-verificacao, quando existir) atendido"
```

`acceptance_criteria` vazio ou ambíguo → não implementar; responder
`needs_clarification`.

## Saída — Delivery Report

```yaml
task_id: "TASK-142"
agent: "<slug do papel que executou>"
status: done | partial | blocked | needs_clarification | failed
verification:
  commands_run:
    - cmd: "comando ou checagem que prova o resultado"
      result: pass
acceptance_criteria_status:
  - criterion: "o mesmo critério declarado no envelope de entrada"
    met: true
    evidence: "nome do teste, log ou artefato que prova"
```

**Nunca** declarar `done` sem comando executado em
`verification.commands_run` — a mesma regra de "pronto é verificado" que
`criterio-de-verificacao` já exige antes de a tarefa entrar na fila.

## O que cada status faz

| Status | O que acontece |
|---|---|
| `done` | A plataforma acorda o que esta tarefa bloqueava |
| `partial` | Vira issue de follow-up para o restante |
| `blocked` | A plataforma acorda quando a dependência resolver |
| `needs_clarification` | Quem recebe a pergunta responde; nenhum trabalho novo começa |
| `failed` | Escala para o papel declarado em `escalate_to` (ver `metadata.task_protocol.statuses` em `COMPANY.md` deste pacote), com o histórico das tentativas |
