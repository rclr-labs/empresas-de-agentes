---
name: criterio-de-verificacao
description: Escrever e aplicar critério de verificação observável para qualquer demanda, antes de ela entrar na fila
metadata:
  paperclip:
    tags:
      - governanca
      - qualidade
---

# Critério de verificação

Transforma pedido vago em condição observável que decide, sem discussão,
se o trabalho ficou pronto.

## A regra

Um critério serve quando **duas pessoas que discordam sobre o trabalho
concordam sobre o resultado da verificação.** Se o critério ainda admite
interpretação, ele não é critério — é intenção reescrita.

## Forma

```text
<sujeito observável> <faz o quê> <sob qual condição> <medido como>
```

| Pedido | Critério |
|---|---|
| "deixar o login mais seguro" | "após 5 tentativas erradas do mesmo IP em 60 s, a 6ª recebe 429; verificado por script de carga" |
| "arrumar o relatório" | "o total do relatório bate com a soma das linhas em 3 meses de amostra, incluindo mês com estorno" |
| "melhorar a busca" | "busca por nome parcial retorna o registro em até 2 resultados, em 20 consultas reais do cliente" |

## Quando não há como verificar

Diga isso em voz alta em vez de inventar um número. Demanda genuinamente
não verificável existe — pesquisa, exploração, decisão de design — e o
tratamento correto é declarar o **prazo e o entregável** ("duas horas, um
parecer escrito"), não fingir uma métrica.

## Antipadrão

Critério escrito depois da implementação. Ele vai descrever o que o código
faz, e a verificação passa por construção.
