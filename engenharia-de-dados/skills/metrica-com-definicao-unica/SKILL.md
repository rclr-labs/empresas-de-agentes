---
name: metrica-com-definicao-unica
description: Publicar a definição de uma métrica com fórmula, janela, recorte e exclusões, e nunca entregar um número sem a definição ao lado
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - dados
      - metrica
---

# Métrica com definição única

Duas definições da mesma métrica são piores que nenhuma. Sem nenhuma
definição, todo mundo sabe que o número precisa de contexto antes de ser
usado. Com duas, dois relatórios respondem com números diferentes e
ambos chamam o resultado pelo mesmo nome — e quem lê os dois não tem como
saber, só olhando o número, qual deles está respondendo a sua pergunta.

## As quatro partes de uma definição

Uma definição sem as quatro não está pronta para ser publicada:

1. **Fórmula** — exatamente como o número é calculado, não uma descrição
   aproximada
2. **Janela** — o período que o número cobre
3. **Recorte** — o segmento ou filtro aplicado, nomeado
4. **Exclusões** — o que fica de fora e por quê (cancelamento,
   estorno, teste interno, o que for)

## A regra de publicar a definição junto com o número

Todo número entregue carrega a definição ao lado, sempre — não como
documentação separada que alguém pode ou não encontrar, mas junto da
resposta. Um número sem a definição é uma afirmação que ninguém pode
verificar; a mesma cifra, com a definição ao lado, é uma resposta que
outra pessoa consegue reproduzir ou contestar com conhecimento do que
está sendo medido.
