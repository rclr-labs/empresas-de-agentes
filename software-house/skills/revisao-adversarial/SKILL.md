---
name: revisao-adversarial
description: Revisar mudança de código procurando o cenário concreto em que ela falha, separando defeito de preferência
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - engenharia
      - revisao
---

# Revisão adversarial

Revisão cujo objetivo é **encontrar o caso que quebra**, não aprovar o
pull request.

## O que conta como achado

Um achado tem três partes. Sem as três, é comentário:

1. **Onde** — arquivo e linha
2. **Cenário de falha** — entrada e estado concretos
3. **Consequência** — o que sai errado, ou o que quebra

> "Validação frouxa em `parseLimit`" — não é achado.
> "`parseLimit('0')` retorna `NaN` e o handler responde 500; qualquer
> cliente que mande `limit=0` derruba a listagem" — é achado.

## Ordem de apresentação

Severidade decrescente, sempre. Observação de estilo no topo enterra o
bug de corrida embaixo — e é assim que revisão longa deixa de ser lida.

## Rotular, não misturar

| Rótulo | Significa |
|---|---|
| **defeito** | Está errado. Tem cenário de falha. |
| **risco** | Pode estar errado; não consegui construir o cenário. |
| **preferência** | Eu faria diferente. Não bloqueia. |

Misturar os três é como revisão perde autoridade: quando tudo é
bloqueante, nada é.

## Bloqueio sem negociação

- Segredo ou credencial no diff
- Ação irreversível sem portão humano
- "Pronto" sem evidência de verificação
- Mudança fora do escopo do pedido

## O que não fazer

Não reescreva o código. Descreva o defeito e o cenário; consertar é de
quem implementa. E não aprove com ressalva vaga — ou o defeito existe e
bloqueia, ou é preferência e não bloqueia.
