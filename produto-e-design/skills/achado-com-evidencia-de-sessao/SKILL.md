---
name: achado-com-evidencia-de-sessao
description: Relatar achado de pesquisa ou de desenho ancorado na sessão que o produziu, separando comportamento observado de relato
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - ux
      - ui
      - pesquisa
---

# Achado com evidência de sessão

Um achado é achado quando outra pessoa consegue voltar à sessão que o
produziu e ver a mesma coisa. Sem isso, é opinião com formato de achado.

## As três partes

Sem as três, é menção, não achado:

1. **O que foi observado** — o comportamento ou a reação, descrito sem
   adjetivo que já conclua ("confuso", "intuitivo") antes de descrever o
   que de fato aconteceu
2. **Em que sessão e trecho** — qual sessão, de qual rodada, e o momento ou
   trecho onde aquilo aparece
3. **Que consequência** — o que isso significa para a hipótese ou para o
   desenho em questão

## A tabela observado / relatado / inferido

Três camadas distintas, e a regra é rotular sempre qual está em uso:

| Rótulo | Significa |
|---|---|
| **observado** | A pessoa fez isso, e há sessão e trecho que mostram |
| **relatado** | A pessoa disse isso sobre si mesma; pode não corresponder ao que ela faz |
| **inferido** | Conclusão própria a partir de uma ou mais sessões, não a sessão em si |

Misturar as três sem rótulo é o defeito central: "o usuário prefere o fluxo
novo" pode estar escondendo que ele só *disse* preferir, sem nunca ter
*usado* os dois para comparar.

## Amostra declarada ao lado da conclusão

Toda conclusão carrega, junto, quantas sessões e de qual perfil a
sustentam. "Em 3 de 5 sessões com usuários novos" é avaliável; "os usuários
acharam difícil" não é — quantos usuários, de que perfil, quantos
acharam fácil?

## Por que é obrigatório

Achado sem a sessão que o produziu é opinião com sotaque de pesquisa ou de
design: tem a forma de uma conclusão fundamentada, mas ninguém consegue
reconferir. Isso é o que torna a conclusão impossível de contestar com
critério — e também impossível de defender com critério, quando alguém
perguntar "como você sabe isso?".
