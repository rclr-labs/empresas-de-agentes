---
name: Documentação e Suporte
description: Organograma de documentação de produto e suporte técnico — referência que acompanha o código, base de conhecimento nascida de ticket recorrente e diagnóstico com reprodução
slug: documentacao-e-suporte
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
authors:
  - name: Best Code
goals:
  - Manter documentação que acompanha o código, não que descreve o código de outro mês
  - Transformar ticket recorrente em artigo, reduzindo a fila na origem
  - Diagnosticar com reprodução e trilha, e escalar com o que já foi tentado
tags:
  - documentacao
  - suporte
  - base-de-conhecimento
requirements:
  secrets:
    - ANTHROPIC_API_KEY
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 800.00
    alert_at: 0.7
    alert_to: documentacao-tecnica
  human_gates:
    - id: responder-ao-cliente
      description: qualquer resposta enviada diretamente ao cliente ou usuário
      signer: pessoa nomeada no kickoff
    - id: publicar-para-fora
      description: publicar documentação ou artigo em canal público
      signer: pessoa nomeada no kickoff
    - id: acesso-a-dado-de-producao
      description: ler dado de produção para reproduzir um caso relatado
      signer: pessoa nomeada no kickoff
    - id: gasto-acima-do-teto
      description: gasto acima do teto do papel
      signer: pessoa nomeada no kickoff
---

# Documentação e Suporte

Este pacote organiza o trabalho em torno de um fato só: documentação sem
data de verificação contra o código é documentação que mente com
confiança — ela parece autoridade porque está escrita, e ninguém sabe se
o exemplo que ela mostra ainda roda. Três papéis cobrem o ciclo —
referência que acompanha o código, artigo que nasce de ticket recorrente,
e diagnóstico que reproduz antes de opinar.

## As quatro decisões, tomadas

**Organograma e fronteira.** Três papéis. `documentacao-tecnica` escreve
e mantém a referência verificada contra o código, e despacha os outros
dois; `base-de-conhecimento` transforma ticket recorrente em artigo, e
mede se o artigo publicado derrubou a fila; `suporte-nivel-2` reproduz o
caso relatado antes de diagnosticar, e escala com o que já foi tentado.
Nenhum dos três responde diretamente ao cliente — é regra do pacote
inteiro, não decisão papel a papel.

**A regra da data de verificação.** Documentação escrita uma vez e nunca
reconferida apodrece em silêncio: o código muda, o exemplo para de rodar,
e o texto continua afirmando o contrário com a mesma confiança de quando
foi escrito. Por isso toda referência de `documentacao-tecnica` carrega
data de conferência, e o exemplo é rodado antes de publicar — documentar
comportamento que ninguém verificou é o que ela recusa fazer, mesmo sob
pressão de prazo.

**Orçamento.** Teto mensal em `metadata.budget`, com teto por papel
proporcional ao risco do trabalho: `documentacao-tecnica` carrega o maior
(`300.00`), porque manter referência verificada é o trabalho que sustenta
os outros dois; `base-de-conhecimento` e `suporte-nivel-2` carregam
`250.00` cada. Alerta em 70% sempre para `documentacao-tecnica`, que é
quem precisa saber primeiro quando o gasto de qualquer um dos dois sobe.

**Portões humanos.** Quatro assinaturas, todas de pessoa nomeada no
kickoff. `responder-ao-cliente` existe porque falar com quem abriu o
ticket é decisão de pessoa, não de papel — nenhum dos três papéis deste
pacote tem acesso direto ao cliente, por mais correta que a resposta
pareça. `publicar-para-fora` cobre levar documentação ou artigo a um
canal público. `acesso-a-dado-de-producao` cobre ler dado de produção
para reproduzir um caso relatado. `gasto-acima-do-teto` é sempre pessoa
nomeada e nunca listado em `capabilities.approve` de nenhum papel — nem
do papel raiz.

## Responder ao cliente é portão humano, não capacidade de papel

Um papel de suporte que fala com cliente sem portão é o risco central
deste pacote: a resposta errada chega direto a quem abriu o ticket, sem
ninguém entre o diagnóstico e a palavra final. Por isso os três papéis
negam contato direto com cliente ou usuário na própria prosa, e a
resposta que de fato sai passa sempre por `responder-ao-cliente`,
assinado por pessoa nomeada. O papel entrega diagnóstico, artigo ou
referência; quem decide o que o cliente lê é sempre uma pessoa.

## `suporte-nivel-2` × `triagem` de `operacao-de-conhecimento`

Dois papéis com fronteira que parece próxima e não é. `triagem`
classifica e roteia **sem responder** — ela não tem acesso a banco de
dado nem a trilha de auditoria do produto, porque rotear não exige
reproduzir nada; a entrada sem dono ela recusa com motivo nomeado e
devolve. `suporte-nivel-2` **reproduz e diagnostica** — ele lê
`audit_trail` e `database`, porque diagnosticar exige reconstituir o
estado em que o caso aconteceu. A `triagem` decide para onde o caso vai;
`suporte-nivel-2` decide o que está errado nele. Um caso que chega sem
reprodução possível não é um caso mal triado — é um caso em que o
ambiente do cliente diverge do que o suporte consegue reconstituir, e
essa diferença é o próprio achado.

## O que este pacote deliberadamente não faz

Não responde diretamente ao cliente ou usuário — toda resposta espera o
portão `responder-ao-cliente`. Não publica documentação ou artigo em
canal público sem o portão `publicar-para-fora`. Não acessa dado de
produção para reproduzir um caso sem o portão `acesso-a-dado-de-producao`
e um caso aberto associado.

## Adaptando

- **Produto sem suporte externo:** corta `suporte-nivel-2`. Sem caso de
  cliente para reproduzir, a documentação de referência e a base de
  conhecimento continuam existindo, só sem o papel que diagnostica
  incidente relatado de fora.
- **Time pequeno:** funde `base-de-conhecimento` em
  `documentacao-tecnica` — transformar ticket recorrente em artigo e
  manter referência verificada são trabalhos próximos o suficiente para
  uma pessoa só, desde que o teto e a prosa continuem distinguindo os
  dois tipos de documento.
