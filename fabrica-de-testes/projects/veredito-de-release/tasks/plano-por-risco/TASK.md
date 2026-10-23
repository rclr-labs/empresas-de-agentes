---
name: Revisar o plano contra o risco corrente
description: Reordenar o plano de teste pelo risco atual do produto, aposentando checagem que não defende mais nada
assignee: polaris
project: veredito-de-release
recurring: true
---

# Revisar o plano contra o risco corrente

Plano de teste que não muda quando o produto muda está testando o produto
do trimestre passado.

## A cada revisão

1. **O que mudou no produto?** Funcionalidade nova, integração nova,
   migração de dado — cada uma abre um tipo de risco que o plano pode não
   cobrir.
2. **Onde doeu de verdade?** Incidente em produção desde a última revisão
   é a melhor fonte de risco que existe. Se o plano não cobria aquilo,
   corrija o plano, não o incidente.
3. **O que nunca encontrou nada?** Checagem que roda há seis meses sem
   achado é candidata a aposentadoria — ou ela defende algo que já não
   quebra, ou ela está mal escrita. As duas respostas pedem ação.
4. **Qual o custo por achado, por tipo?** Tipo caro que acha pouco merece
   pergunta: está no escopo errado ou com a ferramenta errada?

## O número que mais engana

Número de testes. Cresce sozinho, parece progresso e não diz nada sobre
risco coberto. Prefira **risco declarado com cobertura declarada** — e
aceite a linha `nao_coberto` como parte permanente do relatório, não como
dívida a zerar.
