---
name: Plataforma e Operação
description: Organograma de plataforma, entrega e confiabilidade — infraestrutura declarada, mudança reversível, orçamento de erro e resposta a incidente, com aplicação de mudança sempre por portão humano
slug: plataforma-e-operacao
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
authors:
  - name: Best Code
goals:
  - Manter infraestrutura declarada, revisável e reversível, sem mudança aplicada por agente
  - Tornar confiabilidade mensurável por SLO e orçamento de erro, não por impressão
  - Encurtar o tempo entre sintoma e causa, com trilha e postmortem sem culpado
tags:
  - plataforma
  - devops
  - sre
  - confiabilidade
requirements:
  secrets:
    - ANTHROPIC_API_KEY
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 1500.00
    alert_at: 0.7
    alert_to: lideranca-de-plataforma
  human_gates:
    - id: aplicar-mudanca-em-ambiente
      description: aplicar qualquer mudança em ambiente (apply, upgrade, destroy, restart)
      signer: pessoa nomeada no kickoff
    - id: acesso-a-dado-de-producao
      description: ler dado de produção durante investigação de incidente
      signer: pessoa nomeada no kickoff
    - id: alterar-slo
      description: afrouxar SLO ou orçamento de erro acordado
      signer: pessoa nomeada no kickoff
    - id: gasto-acima-do-teto
      description: gasto acima do teto do papel
      signer: pessoa nomeada no kickoff
---

# Plataforma e Operação

Este pacote é o único do acervo cujo trabalho natural seria **aplicar
mudança em ambiente** — e é exatamente por isso que nenhum papel aqui
aplica. `plan`, `template` e `diff` são capacidade de agente, porque
descrevem o que mudaria sem alterar nada; `apply`, `upgrade` e `destroy`
são portão humano, porque alteram o mundo de um jeito que não se desfaz só
lendo o código de volta. Quem quiser inverter essa linha está tomando uma
decisão de risco, não configurando uma ferramenta.

## As quatro decisões, tomadas

**Organograma e fronteira.** Quatro papéis. `lideranca-de-plataforma`
define a política de mudança, revisa o plano antes do portão e despacha os
outros três; `plataforma-e-entrega` escreve infraestrutura como código e
pipeline, e entrega plano com caminho de volta; `confiabilidade-sre` mede
SLO e administra o orçamento de erro; `resposta-a-incidente` investiga ao
vivo, propõe mitigação e escreve o postmortem. Nenhum dos quatro tem
`apply`, `upgrade`, `destroy`, `rollout restart` ou `delete` em
`execute.allow` — a regra vale para o pacote inteiro, não papel a papel.

**Orçamento.** Teto mensal em `metadata.budget`, com teto por papel
proporcional ao risco do trabalho: `plataforma-e-entrega` carrega o maior
(`500.00`), porque escrever e validar infraestrutura é o trabalho mais
caro deste organograma; `lideranca-de-plataforma` carrega `400.00` para
revisar plano e despachar; `confiabilidade-sre` e `resposta-a-incidente`
carregam `300.00` cada. Alerta em 70% sempre para
`lideranca-de-plataforma`, que é quem precisa saber primeiro quando o
gasto de qualquer especialista sobe.

**Portões humanos.** Quatro assinaturas, todas por pessoa nomeada no
kickoff, nunca por um papel: `aplicar-mudanca-em-ambiente`, o portão que
converte plano revisável em mudança real; `acesso-a-dado-de-producao`,
porque ler dado vivo durante um incidente é excepcional, não rotina;
`alterar-slo`, porque afrouxar uma meta de confiabilidade acordada é
decisão de negócio, não ajuste técnico; e `gasto-acima-do-teto`, sempre
pessoa nomeada e nunca listado em `capabilities.approve` de nenhum papel.

## Por que nenhum agente aplica mudança

`plan` descreve o que mudaria; `apply` altera o mundo. A diferença entre
os dois é a diferença entre **revisável** e **irreversível** — um plano
errado se corrige antes de rodar, lendo o diff de volta; uma aplicação
errada já aconteceu, e corrigi-la é um trabalho novo, não a leitura de um
arquivo. Por isso `plataforma-e-entrega` só vai até `plan`, `template` e
`diff`, mesmo tendo o conhecimento técnico para ir além; e por isso
nenhum papel deste pacote tem `apply`, `upgrade` ou `destroy` em
`execute.allow` — a aplicação espera sempre por quem assina o portão
`aplicar-mudanca-em-ambiente`, pessoa nomeada no kickoff, nunca um papel.

## O par de risco deste pacote

`confiabilidade-sre` mede e define SLO e orçamento de erro — não
investiga incidente ao vivo. `resposta-a-incidente` investiga ao vivo,
correlaciona sintoma e mudança recente — não define nem afrouxa SLO. A
separação existe porque quem define a meta não deve ser quem está sob a
pressão de explicá-la no meio de um incidente: se a mesma pessoa fixasse o
alvo e respondesse pela falha em cumpri-lo, o alvo ficaria sujeito à
pressão do momento em vez de refletir o que o usuário de fato precisa.

## O que este pacote deliberadamente não faz

Não aplica mudança em ambiente — nenhum papel roda `apply`, `upgrade`,
`destroy` ou reinicia processo em produção. Não lê dado de produção fora
do portão `acesso-a-dado-de-producao`, e só `resposta-a-incidente` o
solicita, com incidente aberto. Não afrouxa SLO ou orçamento de erro sem o
portão `alterar-slo`.

## Adaptando

- **Time sem on-call:** corta `resposta-a-incidente`. Sem rotação de
  resposta a incidente, o portão `acesso-a-dado-de-producao` deixa de ter
  um papel que o solicita no fluxo normal, e o acesso excepcional a
  produção vira processo humano direto — alguém da operação abre o pedido
  e o assinante do portão decide, sem um papel deste acervo no meio.
- **Operação sem nuvem própria:** funde `plataforma-e-entrega` na
  `lideranca-de-plataforma`. Sem infraestrutura própria para declarar e
  entregar, não há trabalho que justifique um papel dedicado a escrevê-la
  — a liderança absorve a revisão de qualquer mudança que ainda exista.
