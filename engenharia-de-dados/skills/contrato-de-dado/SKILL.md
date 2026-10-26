---
name: contrato-de-dado
description: Declarar contrato de dado entre quem produz e quem consome — esquema, frescor, volume esperado, dono e o que acontece na quebra — antes que o consumidor o descubra quebrando
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - dados
      - contrato
---

# Contrato de dado

Todo dado que atravessa um limite de time carrega um contrato, declarado
ou não. A diferença entre os dois é quem descobre o contrato primeiro: o
time que o escreveu, ou o time que o consome, quando algo muda e o
consumidor não foi avisado.

## As cinco partes de um contrato

Um contrato sem as cinco não está pronto para ser consumido por outro
time:

1. **Esquema** — os campos, o tipo de cada um, e o que é obrigatório
2. **Frescor** — com que atraso o dado chega, e qual atraso já é defeito
3. **Volume esperado** — a ordem de grandeza normal, para que uma
   variação grande dispare pergunta antes de virar surpresa
4. **Dono** — quem responde quando o contrato quebra, nomeado, não
   implícito
5. **O que acontece na quebra** — o consumidor é avisado, o pipeline
   para, ou o dado antigo é mantido? A resposta é parte do contrato, não
   uma decisão tomada no momento da quebra

## Contrato não declarado é contrato que se descobre quebrando

Sem as cinco partes escritas, o contrato ainda existe — ele só vive na
cabeça de quem construiu o pipeline, e a primeira vez que alguém de fora
precisa dele é exatamente quando algo já mudou e o consumidor está
tentando entender por quê. Declarar o contrato antes custa o tempo de
escrevê-lo; não declarar custa o tempo de reconstituí-lo sob pressão,
depois que já quebrou.
