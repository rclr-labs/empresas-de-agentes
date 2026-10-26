---
name: Engenharia de Dados
description: Organograma de dado — contrato, modelagem, pipeline, qualidade contínua e análise, com definição única de métrica e nenhuma escrita em produção
slug: engenharia-de-dados
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
authors:
  - name: Best Code
goals:
  - Manter contrato de dado explícito entre quem produz e quem consome
  - Tornar qualidade de dado uma checagem que roda, não um relatório que se lê
  - Garantir definição única por métrica, para dois relatórios não discordarem do mesmo número
tags:
  - dados
  - pipeline
  - bi
  - qualidade-de-dado
requirements:
  secrets:
    - ANTHROPIC_API_KEY
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 1500.00
    alert_at: 0.7
    alert_to: lideranca-de-dados
  human_gates:
    - id: acesso-a-dado-pessoal
      description: acessar base que contém dado pessoal identificável
      signer: pessoa nomeada no kickoff
    - id: alterar-definicao-de-metrica
      description: alterar a definição de uma métrica já publicada
      signer: lideranca-de-dados
    - id: escrever-em-producao
      description: qualquer escrita em base de produção
      signer: pessoa nomeada no kickoff
    - id: gasto-acima-do-teto
      description: gasto acima do teto do papel
      signer: pessoa nomeada no kickoff
---

# Engenharia de Dados

Este pacote organiza o trabalho em torno de um fato só: dado que ninguém
declara contrato sobre é dado que o consumidor descobre quebrando. Cinco
papéis cobrem o ciclo — contrato e modelagem antes do dado fluir, pipeline
que o move, qualidade que checa sem parar, e análise que responde a
pergunta de negócio sem reabrir a definição do número.

## As quatro decisões, tomadas

**Organograma e fronteira.** Cinco papéis. `lideranca-de-dados` mantém o
contrato de dado e a definição única de cada métrica, e despacha os
outros quatro; `pipeline-de-dados` constrói ingestão e transformação
idempotentes; `modelagem-de-dados` desenha esquema a partir da pergunta
que o dado precisa responder; `qualidade-de-dados` escreve a checagem
contínua que roda no pipeline; `analytics-bi` responde pergunta de
negócio com a definição publicada. Nenhum dos cinco escreve em base de
produção — é regra do pacote inteiro, não decisão papel a papel.

**A regra da definição única.** Métrica redefinida em dois lugares é a
forma mais comum de dois relatórios discordarem do mesmo número: um
painel soma excluindo cancelamento, outro inclui, e os dois chamam o
resultado pelo mesmo nome. Por isso a definição de uma métrica já
publicada só muda pelo portão `alterar-definicao-de-metrica` — assinado
por `lideranca-de-dados`, porque é decisão de domínio sobre o que o
número significa, não sobre o limite do próprio papel. `analytics-bi`
consome a definição publicada; ele nunca a redefine para fechar um
relatório mais rápido.

**Orçamento.** Teto mensal em `metadata.budget`, com teto por papel
proporcional ao risco do trabalho: `pipeline-de-dados` carrega o maior
(`500.00`), porque construir ingestão e transformação é o trabalho mais
caro deste organograma; `qualidade-de-dados` carrega `400.00`, porque
escrever checagem contínua é trabalho de código, não de relatório;
`lideranca-de-dados`, `modelagem-de-dados` e `analytics-bi` carregam
`300.00` cada. Alerta em 70% sempre para `lideranca-de-dados`, que é quem
precisa saber primeiro quando o gasto de qualquer especialista sobe.

**Portões humanos.** Quatro assinaturas. `acesso-a-dado-pessoal` e
`escrever-em-producao` são sempre pessoa nomeada no kickoff — acessar
dado pessoal identificável e escrever em produção são exatamente os dois
jeitos deste pacote causar dano irreversível, e nenhum papel assina sobre
si mesmo. `alterar-definicao-de-metrica` é assinado por
`lideranca-de-dados`, porque é decisão de domínio: quem mantém o
contrato de dado é quem decide quando uma definição publicada pode
mudar. `gasto-acima-do-teto` é sempre pessoa nomeada e nunca listado em
`capabilities.approve` de nenhum papel.

## Dado pessoal: portão, não checagem de código

`acesso-a-dado-pessoal` existe porque dado pessoal identificável não é só
mais um tipo de dado a modelar — é dado cujo acesso indevido tem
consequência fora do pipeline. Quem quiser compor qualidade de dado com
privacidade de dado encontra o papel `privacidade` em `fabrica-de-testes`:
lá a checagem é sobre exposição em release; aqui o portão é sobre acesso
durante construção e operação contínua. Os dois cobrem momentos
diferentes do mesmo risco.

## `qualidade-de-dados` × `integridade-de-dados` da `fabrica-de-testes`

Dois papéis com nome parecido, fronteira distinta. `integridade-de-dados`
(fábrica) **verifica um release**: `write: [test_evidence]`, reporta a
`polaris`, existe durante o ciclo de teste, e nunca escreve código.
`qualidade-de-dados` (aqui) **constrói a checagem contínua** que roda no
pipeline depois que o release já aconteceu: `write: [code]`, reporta a
`lideranca-de-dados`, e existe em produção, não só no ciclo de teste. A
distinção não é de vocabulário — é de capacidade, dono e momento: um
produz evidência pontual, o outro escreve o mecanismo que vigia o dado
todo dia.

## O que este pacote deliberadamente não faz

Não escreve em base de produção — nenhum papel tem `DROP`, `TRUNCATE`,
`DELETE` ou qualquer escrita de produção em `execute.allow`, e a escrita
em produção sempre espera o portão `escrever-em-producao`. Não acessa
dado pessoal identificável sem o portão `acesso-a-dado-pessoal`. Não
redefine métrica publicada fora do portão `alterar-definicao-de-metrica`.

## Adaptando

- **Operação sem BI:** corta `analytics-bi`. Sem análise dedicada
  respondendo pergunta de negócio, a definição publicada de cada métrica
  continua existindo em `lideranca-de-dados`, só sem um papel próprio
  consumindo-a no dia a dia.
- **Time pequeno:** funde `modelagem-de-dados` na `lideranca-de-dados`
  — desenhar esquema e manter contrato são trabalhos próximos o
  suficiente para uma pessoa só. **Nunca funde `qualidade-de-dados`**:
  é a única checagem independente deste organograma, e fundi-la em
  qualquer outro papel remove a verificação de quem construiu o que está
  sendo checado.
