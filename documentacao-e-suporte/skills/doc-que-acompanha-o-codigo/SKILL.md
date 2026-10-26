---
name: doc-que-acompanha-o-codigo
description: Escrever e manter documentação verificada contra o código em execução, com exemplo rodado e data de conferência
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - documentacao
      - referencia
---

# Doc que acompanha o código

Documentação não verificada envelhece em silêncio. O código muda, o
exemplo para de funcionar, e o texto continua afirmando o contrário com a
mesma confiança de quando foi escrito — ninguém grita quando um documento
fica errado, ele só fica.

## Rodar todo exemplo antes de publicar

Nenhum exemplo entra em um documento sem antes rodar, com a versão atual
do código. Exemplo copiado de uma versão anterior, ou nunca executado, é
o jeito mais comum de um documento ensinar um passo que já não existe.
Rodar o exemplo custa minutos; publicar um exemplo que não roda custa a
confiança de quem seguiu o passo errado.

## Data de conferência no próprio documento

Todo documento publicado carrega, visível, a data em que foi conferido
contra o código. Sem essa data, quem lê não tem como distinguir um
documento revisado ontem de um revisado há um ano — os dois parecem
igualmente atuais, e só um deles é.

## Referência, tutorial, explicação — cada um responde uma pergunta diferente

- **Referência** responde "o que isso faz e quais são os parâmetros" —
  é consultada, não lida do início ao fim.
- **Tutorial** responde "como eu chego do zero a um resultado concreto"
  — é seguido passo a passo, por alguém que ainda não sabe o caminho.
- **Explicação** responde "por que isso foi desenhado assim" — é lida
  por quem já usa a coisa e quer entender a decisão por trás.

Escolher a forma errada para a pergunta do leitor produz um documento que
tecnicamente está certo e não ajuda ninguém: um tutorial não serve para
consultar um parâmetro rápido, e uma referência não ensina alguém que
nunca viu a ferramenta.

## Documentação não verificada mente com confiança

A regra central: documentação que não é verificada periodicamente não
fica neutra — ela apodrece em silêncio e passa a afirmar, com a mesma
autoridade de sempre, algo que já não é verdade. Tratar documentação como
escrita uma vez e esquecida é tratar a confiança de quem a lê como
descartável.
