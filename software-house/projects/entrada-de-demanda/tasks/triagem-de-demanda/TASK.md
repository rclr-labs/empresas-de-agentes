---
name: Triagem de demanda
description: Escrever o critério de verificação de cada demanda nova e priorizar
assignee: coordenacao
project: entrada-de-demanda
recurring: true
---

# Triagem de demanda

Para cada demanda que entrou desde a última triagem:

1. Escreva o critério de verificação em uma frase observável. Se você não
   consegue escrevê-la, a demanda ainda não foi entendida — devolva com a
   pergunta, não com um palpite.
2. Classifique por custo de atraso: o que fica mais caro por esperar uma
   semana?
3. Verifique conflito de arquivo com o que já está em andamento. Dois
   trabalhos no mesmo arquivo se resolvem **antes** de começar.
4. Delegue para `tech-lead` com problema + critério.

**Mau critério:** "melhorar a performance da listagem"
**Bom critério:** "listagem de 10 mil itens responde abaixo de 800 ms no
ambiente de homologação, medido três vezes"

A diferença entre os dois é o que separa entrega verificável de discussão
sobre se está pronto.
