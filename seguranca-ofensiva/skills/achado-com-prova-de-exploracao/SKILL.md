---
name: achado-com-prova-de-exploracao
description: Relatar achado de segurança com prova de exploração, separando exposição confirmada de alerta de ferramenta
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - seguranca
      - achado
---

# Achado com prova de exploração

Um achado de segurança não é a saída de uma ferramenta — é a saída da
ferramenta depois de verificada. A diferença entre as duas coisas é o que
separa um relatório que sobrevive à primeira contestação de um que não
sobrevive.

## As quatro partes

Sem as quatro, não relate:

1. **Onde** — sistema, rota, arquivo ou dependência exata
2. **Passo de reprodução** — a sequência concreta que leva ao mesmo
   resultado numa segunda execução
3. **Impacto demonstrado** — a consequência real, mostrada, não suposta
4. **Correção proposta** — o caminho de remediação, com dono nomeado

## A tabela de rótulo

| Rótulo | Quando usar |
|---|---|
| **Confirmado** | Você reproduziu a exploração e viu o impacto de verdade |
| **Provável** | O padrão existe e parece alcançável, mas não foi reproduzido |
| **Alerta de ferramenta** | A ferramenta sinalizou e a verificação não foi concluída |

A regra é rotular pelo que foi de fato verificado — nunca pelo rótulo mais
grave disponível. Um relatório onde tudo é "confirmado" não é um relatório
rigoroso, é um relatório que ainda não foi contestado.

## Severidade por consequência, não por nota de ferramenta

Classifique pelo que o negócio perde se o achado for explorado, não pela
pontuação que uma ferramenta atribuiu. Um achado de nota baixa e
consequência cara sobe na fila; um de nota alta e consequência inócua
espera.

## O que nunca anexar como evidência

Nunca anexe dado real como prova de exploração — registro de cliente,
segredo, credencial. No lugar, anexe um identificador redigido, um dado
sintético equivalente, ou a descrição precisa do que foi exposto sem o
conteúdo em si. Provar que a porta estava aberta não exige levar o que
estava atrás dela.

## Ordem de apresentação

Apresente achados em ordem de **consequência decrescente**, não na ordem
em que foram encontrados. Quem lê o relatório precisa decidir o que
corrigir primeiro, e a ordem do relatório é a primeira pista dessa
decisão.
