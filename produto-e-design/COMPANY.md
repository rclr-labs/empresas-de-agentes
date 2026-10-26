---
name: Produto e Design
description: Organograma de descoberta e desenho de produto — problema antes de solução, usuário real antes de opinião, e superfície desenhada antes de implementada
slug: produto-e-design
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
authors:
  - name: Best Code
goals:
  - Transformar incerteza de produto em hipótese com critério de invalidação
  - Trazer evidência de usuário real para a decisão, não opinião de quem está na sala
  - Entregar superfície desenhada com estado, erro e vazio resolvidos antes da implementação
tags:
  - produto
  - ux
  - ui
  - descoberta
requirements:
  secrets:
    - ANTHROPIC_API_KEY
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 900.00
    alert_at: 0.7
    alert_to: descoberta-de-produto
  human_gates:
    - id: contato-com-usuario
      description: qualquer contato direto com usuário ou cliente final
      signer: pessoa nomeada no kickoff
    - id: publicar-para-fora
      description: publicar pesquisa, protótipo ou desenho para fora da organização
      signer: pessoa nomeada no kickoff
    - id: gasto-acima-do-teto
      description: gasto acima do teto do papel
      signer: pessoa nomeada no kickoff
---

# Produto e Design

Organograma para o trabalho que vem antes do código: transformar incerteza em
hipótese testável, trazer evidência de usuário real e desenhar a superfície
com os estados resolvidos. Existe separado de `software-house` porque um
cliente pode comprar só descoberta e desenho, sem comprar implementação — e
porque `delegate` tem de resolver dentro do próprio pacote (regra E03),
juntar os dois obrigaria a uma cadeia única mesmo quando o cliente só quer
um dos dois lados.

## As quatro decisões, tomadas

**Organograma e fronteira.** Três papéis, delegação em uma direção só:
`descoberta-de-produto` recebe a incerteza, formula hipótese com critério de
invalidação e encomenda pesquisa e desenho; `pesquisa-ux` conduz a
investigação com usuário real; `design-ui` desenha a superfície com os
estados resolvidos. Nenhum papel implementa — isso é de `software-house`, e
o validador falha se algum escrever `code`.

**Orçamento.** Teto mensal em `metadata.budget`, com teto igual por papel
(`300.00` cada) e alerta em 70% para `descoberta-de-produto`, que é quem
encomenda e por isso quem sente primeiro o gasto subindo.

**Portões humanos.** Três ações exigem assinatura: contato com usuário ou
cliente final, publicar para fora e gasto acima do teto. O primeiro é o mais
importante dos três.

**Ritual.** `tasks/revisao-de-descobertas/` existe para alguém ler, toda
semana, as hipóteses abertas e os achados acumulados. Descoberta que não
termina é o gasto mais invisível deste pacote, porque não aparece como
defeito — aparece como relatório que continua crescendo.

## Por que falar com usuário é portão humano, não capacidade de agente

Tem gente de verdade do outro lado. Uma entrevista mal roteirizada, uma
pergunta que sugere a resposta, uma sessão que o próprio pesquisador
contamina ao improvisar — queimam a amostra, e amostra queimada não se
recupera reagendando. `pesquisa-ux` desenha o roteiro e analisa a sessão;
quem efetivamente fala com a pessoa do outro lado passa pelo portão
`contato-com-usuario`, assinado por alguém nomeado no kickoff. Capacidade de
agente é o que o agente pode fazer sozinho sem risco de dano irreversível —
e entrevista malconduzida é dano irreversível para aquela amostra.

## O que este pacote deliberadamente não faz

Não implementa — nenhum papel aqui tem `write: [code]`. Não decide prioridade
de entrega da engenharia — isso é do `product-owner`, em `software-house`.
Não publica pesquisa, protótipo ou desenho para fora da organização por
conta própria.

## Adaptando

- **Time sem pesquisador dedicado:** funda `pesquisa-ux` em
  `descoberta-de-produto`, mas mantém o portão `contato-com-usuario` —
  quem acumula o papel de pesquisador continua precisando de assinatura
  nomeada antes de falar com usuário real.
- **Produto sem interface:** corta `design-ui`. Produto que não tem
  superfície visual (uma API, um batch, um pipeline) não precisa de quem
  desenha estado vazio e carregando.
