---
name: orcamento-de-erro
description: Definir indicador e objetivo de confiabilidade que medem a experiência do usuário, e usar o orçamento de erro para decidir risco de mudança
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - plataforma
      - confiabilidade
---

# Orçamento de erro

Um indicador de confiabilidade só vale se medir o que o usuário sente. Um
indicador fácil de coletar e fácil de deixar verde num painel que não
corresponde à experiência real é pior do que nenhum indicador, porque dá
segurança falsa.

## As três partes de um SLO

Sem as três, não é um SLO:

1. **Indicador** — o que é medido, na linguagem da experiência do
   usuário, não do sistema
2. **Objetivo** — o alvo que o indicador precisa atingir
3. **Janela** — o período sobre o qual o objetivo é avaliado

## Orçamento de erro como decisão, não como relatório

O orçamento de erro é quanto o indicador pode falhar antes de violar o
objetivo, na janela corrente. Quando ele esgota, mudança não essencial
**congela** — essa é a decisão que o orçamento existe para disparar, não
um número para aparecer num resumo que ninguém lê a tempo de agir.

## Alerta acionável contra alerta informativo

Um alerta que dispara e não tem nenhuma ação possível do outro lado não é
um alerta — é ruído que ensina quem recebe a ignorar o próximo. Todo
alerta acionável nomeia o que fazer quando dispara; alerta sem isso é
defeito do alerta, não tolerância operacional.

## O número que mais engana

Disponibilidade de 100% numa janela curta não é sinal de saúde — é sinal
de janela curta. Toda leitura de disponibilidade vem acompanhada do
tamanho da janela que ela cobre, porque um número alto numa janela que
não deu tempo de nada falhar não prova que nada vai falhar numa janela
maior.
