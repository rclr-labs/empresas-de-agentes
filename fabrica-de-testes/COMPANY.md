---
name: Fábrica de Testes
description: Operação de teste governada por agentes — gerente de teste, especialistas por tipo, evidência replayável e veredito de release com nível de confiança
slug: fabrica-de-testes
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
authors:
  - name: Best Code
goals:
  - Transformar risco de produto em plano de teste, não em suíte por hábito
  - Produzir achado replayável — mesma evidência, mesmo veredito
  - Entregar veredito de release com nível de confiança e o que não foi coberto
tags:
  - qa
  - teste
  - governanca
requirements:
  secrets:
    - ANTHROPIC_API_KEY
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 1500.00
    alert_at: 0.7
    alert_to: polaris
  human_gates:
    - id: tocar-producao
      description: executar qualquer checagem contra ambiente de produção
      signer: pessoa nomeada no kickoff
    - id: carga-acima-do-acordado
      description: teste de carga acima do volume acordado
      signer: pessoa nomeada no kickoff
    - id: divulgar-achado-de-seguranca
      description: divulgar achado de segurança fora da equipe
      signer: pessoa nomeada no kickoff
    - id: gasto-acima-do-teto
      description: gasto acima do teto da execução
      signer: pessoa nomeada no kickoff
---

# Fábrica de Testes

Operação de teste em que o risco do produto — não o hábito da equipe —
decide o que é testado.

## O princípio que organiza tudo

**A ferramenta executa, o modelo decide.**

| Papel | Quem faz |
|---|---|
| Descobrir superfície, executar checagem, coletar evidência | ferramenta determinística |
| Analisar risco, desenhar plano, escrever caso novo, triar, pontuar confiança | modelo de IA |

A consequência prática é a que importa para quem compra QA: o especialista
de acessibilidade não navega o site com um modelo lendo DOM. Ele roda
`axe-core`, recebe violação estruturada e usa o modelo para priorizar,
correlacionar com risco e explicar. Isso corta custo por execução em ordem
de grandeza, elimina alucinação na etapa de execução e torna cada achado
**replayável**: mesma evidência, mesmo veredito.

Inverter esse papel é o erro mais comum e mais caro em teste com IA.
Modelo executando checagem produz achado que não reproduz — e achado que
não reproduz não é achado, é opinião caríssima.

## As quatro decisões, tomadas

**Organograma.** Um gerente de teste (`polaris`) e especialistas por tipo.
O gerente não executa checagem; o especialista não decide escopo de
release.

**Orçamento.** Teto **por execução**, não por mês — teste é trabalho em
rajada, e teto mensal esconde a execução que custou dez vezes o normal.

**Portões humanos.** Três: tocar produção, passar da carga acordada e
divulgar achado de segurança. Os três são irreversíveis de maneiras
diferentes, e nenhum é decisão de agente.

**Ritual.** `tasks/` carrega a revisão do plano contra o risco corrente.
Plano de teste que não muda quando o produto muda testa o produto do
trimestre passado.

## O veredito

A saída da fábrica é uma frase com quatro partes — e a quarta é a que
distingue QA honesto de QA decorativo:

```text
veredito: NO-GO
confianca: 62%
criterio: 7 de 9 atendidos
nao_coberto: carga acima de 200 req/s, fluxo de pagamento recusado
```

`nao_coberto` existe porque o risco que você não mediu é o risco que o
cliente encontra primeiro. Veredito sem essa linha afirma mais do que sabe.
