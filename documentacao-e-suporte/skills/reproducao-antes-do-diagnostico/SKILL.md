---
name: reproducao-antes-do-diagnostico
description: Reproduzir o caso relatado antes de opinar sobre ele, e escalar com o que já foi tentado e o que foi observado
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
metadata:
  paperclip:
    tags:
      - suporte
      - diagnostico
---

# Reprodução antes do diagnóstico

Opinar sobre um caso que não foi reproduzido é o jeito mais rápido de
mandar o time investigar a coisa errada. O palpite parece economia de
tempo porque chega rápido; custa o dobro quando está errado, porque
alguém investiga na direção que o palpite apontou antes de descobrir que
a direção estava errada.

## As três partes de uma reprodução

Sem as três, não é reprodução — é descrição do relato original:

1. **Passo** — a sequência exata de ações seguida, não um resumo do que
   "mais ou menos" foi feito
2. **Estado inicial** — em que condição o sistema estava antes do
   primeiro passo
3. **Resultado observado** — o que de fato aconteceu, não o que se
   esperava que acontecesse

## Opinar sem reproduzir manda investigar errado

Um diagnóstico construído sobre o relato, sem confirmar o comportamento
de verdade, carrega a interpretação de quem relatou — que pode estar
certa, mas que ninguém verificou. Investigar a partir de um palpite não
confirmado é o caminho mais comum para o time gastar horas numa causa
que nunca existiu.

## Quando não reproduz, isso é um achado

Não conseguir reproduzir com os passos recebidos não encerra o caso —
muda a pergunta. Em vez de "qual é o defeito", a pergunta passa a ser "o
que é diferente no ambiente do cliente". Essa diferença — versão,
configuração, dado específico, ordem de operações — é frequentemente a
causa real, e tratá-la como achado em vez de fracasso é o que evita
fechar um caso real como "não reproduzido, sem solução".

## Escalar com o que já foi tentado

Todo caso escalado sobe com o histórico de tentativas: o que foi testado
e o que foi observado em cada tentativa, não só a conclusão de que "não
deu para resolver aqui". Escalar sem esse histórico faz a próxima pessoa
repetir, do zero, a mesma hora de trabalho que já foi gasta — e repetir
um trabalho já feito é o custo mais evitável de todo o processo de
suporte.
