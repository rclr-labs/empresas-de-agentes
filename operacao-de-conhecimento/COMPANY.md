---
name: Operação de Conhecimento
description: Organograma para operação de pesquisa, redação e triagem governada por agentes — os fluxos onde o agente é confiável hoje
slug: operacao-de-conhecimento
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
authors:
  - name: Best Code
goals:
  - Transformar pergunta em resposta com fonte citável e suficiência declarada
  - Manter custo por entrega e taxa de retrabalho medidos, não estimados
  - Garantir que nada saia para fora da organização sem assinatura humana nomeada
tags:
  - pesquisa
  - redacao
  - triagem
  - conhecimento
requirements:
  secrets:
    - ANTHROPIC_API_KEY
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 1200.00
    alert_at: 0.7
    alert_to: curadoria
  human_gates:
    - id: publicar-para-fora
      description: publicar ou enviar conteúdo para fora da organização
      signer: pessoa nomeada no kickoff
    - id: gasto-acima-do-teto
      description: gasto acima do teto do papel
      signer: pessoa nomeada no kickoff
    - id: contato-com-cliente
      description: qualquer contato direto com o cliente
      signer: pessoa nomeada no kickoff
---

# Operação de Conhecimento

Organograma para o trabalho que a documentação das plataformas multi-agente
classifica como confiável hoje: pesquisa, redação, triagem e revisão pequena.
É o ponto de partida recomendado para quem está entrando em operação
multi-agente, porque é onde o resultado é verificável sem supervisão contínua.

## As quatro decisões, tomadas

**Organograma e fronteira.** Quatro papéis, delegação em uma direção só:
curadoria recebe a pergunta e define suficiência; pesquisa busca e cita;
redação transforma achado em texto com público declarado; triagem classifica
entrada e roteia. **Só `pesquisa` fala com a internet** — concentrar a saída
externa num papel é o que torna a fronteira auditável em vez de difusa.

**Orçamento.** Teto mensal em `metadata.budget`, com teto próprio por papel e
alerta em 70% para `curadoria`. `pesquisa` tem o teto maior porque é quem
consome busca externa.

**Portões humanos.** Três ações exigem assinatura: publicar para fora, gasto
acima do teto e contato com cliente. O primeiro é o que separa esta operação
de um gerador de conteúdo solto.

**Ritual.** `tasks/revisao-de-fila/` existe para alguém ler a fila e a trilha
toda semana. Fila sem leitor acumula entrada sem dono, e entrada sem dono é
onde a operação de conhecimento apodrece.

## O que este pacote deliberadamente não faz

Não escreve código — nenhum papel aqui tem `write: [code]`, e o validador
falha se alguém acrescentar. Não publica nada por conta própria. Não substitui
revisão humana de conteúdo que vai para fora.

## Adaptando

- **Sem triagem de entrada:** funda `triagem` em `curadoria`. Se for cortar um
  papel, nunca corte `pesquisa` separada de `redacao` — quem busca e quem
  escreve sendo o mesmo papel é como achado sem fonte entra no texto final.
- **Operação com publicação frequente:** o portão `publicar-para-fora`
  provavelmente sobe para uma pessoa dedicada, não para a curadoria.
- **Domínio regulado:** acrescente um papel de conformidade com
  `reportsTo: null`, fora da cadeia. Papel que audita quem o comanda não
  audita.
