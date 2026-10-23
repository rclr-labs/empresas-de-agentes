---
name: Veredito de Release
description: Fluxo que leva risco de produto a veredito GO/NO-GO com confiança declarada
slug: veredito-de-release
schema: agentcompanies/v1
kind: project
owner: polaris
tags:
  - release
  - governanca
---

# Veredito de Release

O fluxo completo da fábrica, da descoberta ao veredito.

## O ciclo

1. **Superfície.** Ferramenta descobre o que existe: rotas, endpoints,
   telas, tabelas. Descoberta é determinística — modelo não adivinha
   superfície.
2. **Risco.** `polaris` ordena por dor: dinheiro, dado, dado pessoal,
   disponibilidade, reputação.
3. **Plano.** Tipos de teste escolhidos pelo risco, com teto por execução.
4. **Execução.** Especialistas rodam ferramenta, coletam evidência.
5. **Triagem.** `polaris` consolida, deduplica e ordena por consequência.
6. **Veredito.** GO ou NO-GO, com confiança e `nao_coberto`.

## O que torna o veredito defensável

Cada achado reproduz a partir da evidência guardada. Quando o cliente
contesta — e ele contesta — a resposta não é "o agente encontrou", é
"rode isto e veja".

## Antipadrão

Suíte que cresce por acumulação, nunca por risco. Depois de dois anos ela
testa exaustivamente o que nunca quebra e não toca no que quebra todo mês,
porque ninguém revisou o plano contra o risco corrente desde o primeiro
trimestre.
