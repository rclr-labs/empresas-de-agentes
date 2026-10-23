---
name: veredito-com-confianca
description: Emitir veredito de release GO/NO-GO com nível de confiança calibrado e declaração explícita do que não foi coberto
metadata:
  paperclip:
    tags:
      - qa
      - release
---

# Veredito com confiança

Um veredito de release tem quatro partes. Faltando qualquer uma, ele
afirma mais do que sabe.

```text
veredito: GO | NO-GO
confianca: <percentual>
criterio: <atendidos> de <total>
nao_coberto: <lista honesta>
```

## Como calibrar confiança

Confiança responde: **se eu liberar, qual a chance de passar algo que
importa?** Ela cai por três motivos, e cada um deve ser dito:

| Motivo | Efeito |
|---|---|
| Cobertura estreita | Testei pouco do que importa |
| Evidência fraca | Testei, mas o achado não reproduz com firmeza |
| Ambiente distante de produção | Testei outro sistema, parecido |

Confiança de 95% com cobertura de 30% do risco é mentira estatística —
você está confiante sobre o pedaço que olhou e calado sobre o resto.

## `nao_coberto` é obrigatório

A linha mais valiosa do relatório, e a que mais se omite por parecer
fraqueza. É o oposto: ela é o que permite ao dono do produto decidir com
informação. O risco que você não mediu é o risco que o cliente encontra
primeiro — a única escolha que você tem é se ele descobre por você ou
pelo usuário dele.

## NO-GO não pede licença

Pressão de prazo não é evidência. Quando o critério não foi atendido, o
veredito é NO-GO — e a decisão de liberar mesmo assim é de uma pessoa
nomeada, registrada como exceção. Veredito que cede à pressão deixa de
informar qualquer coisa nas próximas vezes.
