---
name: Entrada de Demanda
description: Fluxo de entrada — toda demanda ganha critério de verificação antes de ser priorizada
slug: entrada-de-demanda
schema: agentcompanies/v1
kind: project
owner: coordenacao
tags:
  - intake
  - governanca
---

# Entrada de Demanda

O primeiro fluxo a colocar em operação, e o que mais rápido paga por si.

## Por que este é o primeiro

Operação multi-agente que começa pela implementação produz trabalho
bonito e inútil em volume. A entrada é onde se decide o que merece
existir — e é a única etapa cujo defeito contamina todas as outras.

## O ciclo

1. Demanda chega (pessoa, formulário, ticket, e-mail).
2. `coordenacao` escreve o **critério de verificação**: como saberemos que
   ficou pronto, em termos observáveis.
3. Sem critério, a demanda volta. Não entra na fila.
4. Com critério, entra priorizada por custo de atraso.
5. `tech-lead` recebe problema + critério, nunca solução pronta.

## Como medir se está funcionando

| Sinal | Significa |
|---|---|
| Demanda devolvida por falta de critério | O portão está funcionando |
| Retrabalho caindo mês a mês | O critério está sendo escrito bem |
| Fila crescendo sem fim | Falta capacidade ou falta dizer não |
