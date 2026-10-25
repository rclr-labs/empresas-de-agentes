---
name: Casa de Software
description: Organograma de uma casa de software governada por agentes — coordenação, desenho técnico, implementação, revisão adversarial e portão de qualidade
slug: software-house
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
authors:
  - name: Best Code
goals:
  - Transformar demanda em software entregue, com critério de verificação por fluxo
  - Manter custo por fluxo e taxa de retrabalho medidos, não estimados
  - Garantir que nada irreversível aconteça sem assinatura humana nomeada
tags:
  - software-house
  - engenharia
  - entrega
requirements:
  secrets:
    - ANTHROPIC_API_KEY
    - OPENAI_API_KEY
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 2000.00
    alert_at: 0.7
    alert_to: coordenacao
  human_gates:
    - id: deploy-producao
      description: deploy em produção
      signer: pessoa nomeada no kickoff
    - id: gasto-acima-do-teto
      description: gasto acima do teto do papel
      signer: pessoa nomeada no kickoff
    - id: contato-com-cliente
      description: qualquer contato com o cliente
      signer: pessoa nomeada no kickoff
    - id: remocao-de-dado-de-producao
      description: remoção de dado de produção
      signer: pessoa nomeada no kickoff
---

# Casa de Software

Organograma para uma operação de desenvolvimento de software em que os
agentes fazem o trabalho repetitivo e as pessoas ficam com as decisões
irreversíveis.

## As quatro decisões, tomadas

**Organograma e fronteira.** Cinco papéis, delegação em uma direção só:
coordenação recebe demanda e prioriza; tech lead desenha; desenvolvimento
implementa; revisão contesta; portão de qualidade dá o veredito. Nenhum
papel acumula implementar e aprovar o próprio trabalho.

**Orçamento.** Teto mensal declarado em `metadata.budget`, com alerta em
70% e destinatário nomeado. Papel que estoura o teto para — não pede
desculpa depois.

**Portões humanos.** Quatro ações não acontecem sem assinatura: deploy em
produção, gasto acima do teto, contato com cliente e remoção de dado de
produção. Estão listadas em `metadata.human_gates` porque portão que
não está escrito é portão que não existe. Nenhum papel deste pacote assina
um desses portões: todo `signer` é pessoa nomeada no kickoff, porque um
papel pode aprovar uma decisão de domínio, mas nunca o próprio estouro de
teto ou o próprio release — por isso `capabilities.approve` fica vazio em
todos os cinco papéis, deliberadamente.

**Ritual.** A tarefa recorrente `tasks/revisao-de-orcamento/` existe para
que alguém leia a trilha toda semana. Operação sem leitor de trilha é
operação sem auditoria.

## O que este pacote deliberadamente não faz

Não escolhe o seu runtime, não traz prompt de produto e não assume a sua
stack. Os papéis descrevem **responsabilidade e fronteira**; o que cada
agente sabe sobre o seu domínio entra quando você adapta.

## Adaptando

Comece discordando. O organograma é um ponto de partida defensável, não
uma recomendação universal:

- **Time pequeno (1–3 pessoas):** funda `tech-lead` em `coordenacao` e
  mantenha `revisao` separada. Se for cortar um papel, nunca corte a
  revisão — é o papel que existe justamente para não concordar.
- **Operação com cliente externo:** o portão de contato com cliente
  provavelmente sobe para uma pessoa, não para a coordenação.
- **Produto com regulação:** acrescente um papel de conformidade com
  `reportsTo: null`, fora da cadeia de entrega. Papel de conformidade que
  reporta a quem ele audita não audita.
