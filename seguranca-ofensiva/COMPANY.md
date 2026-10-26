---
name: Segurança Ofensiva
description: Organograma de avaliação de segurança sob autorização escrita — modelo de ameaça, teste de intrusão com escopo nomeado, revisão de código, cadeia de suprimentos e configuração de nuvem
slug: seguranca-ofensiva
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
authors:
  - name: Best Code
goals:
  - Encontrar exposição real com prova de exploração, não lista de alerta de ferramenta
  - Operar exclusivamente dentro de escopo autorizado por escrito, com alvo nomeado
  - Entregar achado priorizado por consequência, com caminho de remediação e dono
tags:
  - seguranca
  - pentest
  - appsec
  - nuvem
requirements:
  secrets:
    - ANTHROPIC_API_KEY
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 1800.00
    alert_at: 0.7
    alert_to: lideranca-de-seguranca
  human_gates:
    - id: escopo-autorizado-por-escrito
      description: iniciar qualquer avaliação sem autorização escrita com alvo, janela e limite nomeados
      signer: pessoa nomeada no contrato, do lado do cliente
    - id: teste-contra-producao
      description: executar qualquer verificação contra ambiente de produção
      signer: pessoa nomeada no contrato, do lado do cliente
    - id: divulgar-achado-de-seguranca
      description: comunicar achado para fora da equipe de avaliação
      signer: lideranca-de-seguranca
    - id: gasto-acima-do-teto
      description: gasto acima do teto do papel
      signer: pessoa nomeada no kickoff
---

# Segurança Ofensiva

Este pacote só opera sob **autorização escrita, com alvo, janela e limite
nomeados**. Avaliação sem isso não é trabalho deste organograma — é o
portão `escopo-autorizado-por-escrito`, e o assinante é pessoa nomeada no
contrato **do lado do cliente**, nunca da consultoria: quem autoriza não
pode ser quem executa. Não é postura moral acrescentada ao pacote — é o que
separa teste de intrusão contratado de acesso não autorizado, e a diferença
entre os dois não é de intenção, é de assinatura.

## As quatro decisões, tomadas

**Organograma e fronteira.** Cinco papéis. `lideranca-de-seguranca` modela a
ameaça, publica o escopo autorizado e despacha os quatro especialistas
dentro dele; `pentest-aplicacao` prova exploração em aplicação;
`revisao-de-codigo-seguro` procura classe de vulnerabilidade em código
estático; `cadeia-de-suprimentos` verifica dependência e integridade de
artefato; `configuracao-de-nuvem` lê infraestrutura declarada. Só
`pentest-aplicacao` sai para a rede, e com **lista de domínio**, nunca
`network: true` — concentrar a saída externa num papel só é o que torna a
fronteira auditável, e é a decisão que faz este pacote ser o único do
acervo com `capabilities.network` como allowlist de domínio em vez de
booleano.

**Orçamento.** Teto mensal em `metadata.budget`, com teto por papel
proporcional ao custo de execução: `pentest-aplicacao` carrega o maior
(`600.00`), porque testar aplicação real é o trabalho mais caro; os três
estáticos (`revisao-de-codigo-seguro`, `cadeia-de-suprimentos`,
`configuracao-de-nuvem`) carregam `250.00`–`300.00`; `lideranca-de-seguranca`
carrega `400.00` para modelar ameaça e consolidar. Alerta em 70% sempre para
`lideranca-de-seguranca`, que é quem tem de saber primeiro quando o gasto de
qualquer especialista sobe.

**Portões humanos.** Quatro assinaturas: `escopo-autorizado-por-escrito` e
`teste-contra-producao`, as duas assinadas por pessoa nomeada no contrato do
lado do cliente — porque autorizar o próprio teste é conflito de interesse,
não detalhe de processo; `divulgar-achado-de-seguranca`, assinado pela
`lideranca-de-seguranca` — legítimo porque é decisão de domínio (quando e
como um achado sai da equipe de avaliação), não decisão sobre os próprios
limites; e `gasto-acima-do-teto`, sempre pessoa nomeada no kickoff, nunca um
papel.

**Avaliar, não remediar.** Nenhum papel aplica mudança em ambiente.
`execute.allow` não contém `apply`, `upgrade`, `destroy` nem `delete` em
nenhum dos cinco papéis — `configuracao-de-nuvem` roda `terraform plan` e
nunca `terraform apply`; `cadeia-de-suprimentos` lista dependência e nunca
atualiza; `pentest-aplicacao` demonstra exploração e não corrige o que
encontra. Remediação é de quem opera o sistema avaliado, com dono nomeado —
não deste organograma.

## A perda que o operador precisa conhecer

A allowlist de domínio de `pentest-aplicacao` não vale igual em todo
runtime. **No Claude Code**, o sandbox de sistema operacional intercepta
toda saída de rede do processo, `curl` incluído — a allowlist é fronteira de
verdade ali, emitida como `sandbox.network.allowedDomains` em
`.claude/settings.json`. **No OpenCode V2 e no janus com provider
`kind=cli`**, a allowlist de rede cobre só a chamada de busca da própria
ferramenta — o comando de shell liberado (`curl`, `nmap`, `nuclei`, `ffuf`)
alcança qualquer host, não só o alvo autorizado. Isso é escrito aqui porque
fronteira que só o emissor conhece é fronteira que ninguém aplica: nesses
dois runtimes, a restrição real tem de vir de rede ou proxy, fora do
runtime — e um escopo que "parece" restrito mas não restringe nada é, numa
avaliação de ataque, alcance fora do que o cliente assinou.

## O que este pacote deliberadamente não faz

Não remedia — nenhum papel corrige o que encontra, aplica configuração ou
atualiza dependência. Não opera sem escopo assinado, e não opera contra
produção sem o segundo portão. Não divulga achado para fora da equipe de
avaliação sem a assinatura da liderança.

## Adaptando

- **Time sem nuvem:** corta `configuracao-de-nuvem`. Avaliação que não
  toca infraestrutura declarada não precisa de quem lê Terraform e Helm.
- **Avaliação só defensiva (sem teste de intrusão):** corta
  `pentest-aplicacao` e mantém os três papéis estáticos
  (`revisao-de-codigo-seguro`, `cadeia-de-suprimentos`,
  `configuracao-de-nuvem`), que não precisam de rede nem do portão
  `teste-contra-producao` — o único deste pacote que exige saída externa e
  alvo vivo deixa de existir, e o escopo fica mais simples de autorizar.
- **Os domínios de `pentest-aplicacao` são exemplo.** `staging.exemplo.com.br`
  e `api-staging.exemplo.com.br` existem só para o papel ser válido e
  emitível neste acervo público. Na adaptação, a lista é substituída
  inteira pelo alvo que o escopo assinado do cliente nomeia — nunca
  acrescentada a ele.
