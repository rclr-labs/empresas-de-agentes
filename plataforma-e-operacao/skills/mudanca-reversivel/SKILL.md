---
name: mudanca-reversivel
description: Preparar mudança de infraestrutura com plano revisável e caminho de reversão escrito, e separar o que descreve do que altera
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - plataforma
      - mudanca
---

# Mudança reversível

Toda mudança de infraestrutura começa descrita, nunca aplicada direto. A
diferença entre descrever e aplicar é a diferença entre um erro que se
corrige antes de rodar e um erro que já aconteceu.

## A tabela que separa agente de portão humano

| Capacidade de agente | Portão humano |
|---|---|
| `plan` | `apply` |
| `template` | `upgrade` |
| `diff` | `destroy` |

Só a primeira coluna é capacidade de agente. A segunda altera o ambiente
de um jeito que não se desfaz só lendo o plano de volta — por isso ela
nunca aparece em `execute.allow` de nenhum papel que use esta skill, e
sempre espera a assinatura do portão `aplicar-mudanca-em-ambiente`.

## As quatro partes de um plano entregável

Um plano sem as quatro não está pronto para revisão:

1. **O que muda** — exatamente, sem generalização
2. **O que não muda** — nomeado, não implícito; um plano que mostra
   mudança que ninguém pediu é defeito a investigar antes de seguir
3. **Como se desfaz** — o caminho de reversão, escrito, não suposto
4. **Em quanto tempo** — a estimativa de reversão, porque "reverte" sem
   prazo não ajuda quem decide se vale o risco de aplicar agora

## Blue/green e canário

Quando há cliente em produção, a mudança sobe **ao lado** do que está
rodando, é **verificada**, e só então o tráfego é cortado para ela. A
verificação pós-corte não é opcional — é a parte que confirma que o que
subiu está realmente saudável antes de ficar com todo o tráfego.

## Rollback não pede confirmação

Rollback é o caminho seguro, e hesitar nele é que custa caro. Quando a
verificação pós-corte falha, o rollback acontece automaticamente — esperar
confirmação humana no meio de uma reversão é o oposto do que a reversão
existe para garantir, que é voltar ao estado conhecido o mais rápido
possível.
