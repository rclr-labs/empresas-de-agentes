---
name: Revisão semanal de orçamento e trilha
description: Ritual de operação — ler a trilha de auditoria, revisar gasto por papel e triar exceções
assignee: coordenacao
recurring: true
---

# Revisão semanal de orçamento e trilha

O ritual que mantém a operação viva depois que a implantação termina.
Operação sem leitor de trilha não tem auditoria — tem registro que
ninguém lê.

## Toda semana, nesta ordem

1. **Gasto por papel contra o teto.** Quem passou de 70% recebeu alerta?
   O alerta foi lido ou ignorado?
2. **Trilha de auditoria.** Alguma ação irreversível aconteceu sem gate
   humano? Isso não é observação, é incidente.
3. **Exceções.** O que ficou parado esperando decisão humana, e por
   quanto tempo? Fila de espera por assinatura é o gargalo mais invisível
   de operação governada.
4. **Retrabalho.** Quantos pedaços voltaram da revisão, e por quê? Causa
   repetida é defeito de processo, não de agente.

## O número que mais engana

Custo total caindo parece bom e pode ser péssimo: pode significar que os
agentes estão trabalhando menos porque a fila travou esperando aprovação
humana. Leia custo sempre ao lado de **vazão** e de **tempo parado em
gate**.
