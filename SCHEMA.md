# SCHEMA — como `agentcompanies/v1` é estendido neste acervo

Este documento descreve a extensão própria deste acervo sobre o formato
`agentcompanies/v1`: onde ela mora, quais chaves ela introduz, e as duas
decisões — princípio de extensão e exclusão da persona do prompt — que o
resto do código assume como verdadeiras.

## 1. Princípio: extensão só sob `metadata.*`

Tudo que este acervo adiciona ao formato — persona, fronteira de permissão,
capacidades, memória, contexto, orçamento, portões humanos — mora dentro de
`metadata.*`, em todo arquivo (`COMPANY.md`, `AGENTS.md`, `SKILL.md`,
`TEAM.md`, `TASK.md`). Nenhuma extensão cria chave de topo nova.

A razão é mensurável, não estética: o `docs/companies` upstream — a própria
especificação — teve **zero commits em 30 dias**. A spec está congelada.
Uma chave de topo nova é um campo que uma ferramenta de terceiro, validando
contra a spec congelada, não conhece — e dependendo de como valida, pode
rejeitar o arquivo inteiro. Uma chave sob `metadata` é, para essa mesma
ferramenta, apenas um objeto que ela ignora: o pacote continua válido.

Isto inclui o **Paperclip**, a implementação open-source do formato. Um
pacote escrito aqui tem de abrir no Paperclip sem erro, mesmo que o
Paperclip não leia `metadata.persona` — e só continua assim enquanto a
extensão não sai de `metadata`.

Consequência prática: ao propor um campo novo, a primeira pergunta não é
"que nome ele tem", é "ele cabe em `metadata`, ou meu formato quer ser
top-level". Se quer ser top-level, a resposta é esperar a spec descongelar
e propor upstream — não declarar e torcer.

## 2. Chaves canônicas

Sete chaves, todas dentro de `metadata`:

| Chave | Onde aparece | O que declara |
|---|---|---|
| `persona` | `AGENTS.md` | Como o agente se apresenta a um humano: nome de exibição, ícone, pronomes, resumo de uma linha, histórico, forças, pergunta de assinatura |
| `boundary` | `AGENTS.md` | O que o papel pode e não pode fazer, em prosa — a fronteira legível por humano |
| `capabilities` | `AGENTS.md` | A mesma fronteira, em forma validável: leitura, escrita, execução, rede, delegação, aprovação — ver `capabilities/v1.md` |
| `memory` | `AGENTS.md` | Escopo e retenção de memória do agente |
| `context` | `AGENTS.md` | De onde o agente lê contexto antes de agir, e o que fica fora |
| `budget` | `COMPANY.md` **e** `AGENTS.md` (sob `capabilities.budget`) | Teto de gasto, moeda, limiar de alerta e destinatário — a empresa inteira em `COMPANY.md`, o papel individual em `AGENTS.md` |
| `human_gates` | `COMPANY.md` | A lista de ações que não acontecem sem assinatura humana nomeada |

`budget` aparece duas vezes porque os dois tetos respondem perguntas
diferentes: `metadata.budget` em `COMPANY.md` é o que a empresa inteira pode
gastar por mês; `metadata.capabilities.budget` em `AGENTS.md` é o que **esse
papel** pode gastar. O validador resolve a ambiguidade lendo primeiro o teto
do papel e só caindo para o da empresa quando o papel não declara o
próprio — por isso a regra de validação 7 (um papel com `write` ou `execute`
precisa de `budget`, próprio ou herdado da empresa) não falha num papel que
não tem `capabilities.budget` mas pertence a uma empresa que tem. O
`software-house/COMPANY.md` já declara o portão "gasto acima do teto **do
papel**" — teto por papel não é novidade desta extensão, é algo
que o pacote shipado já pressupõe e que `SCHEMA.md` estava deixando de
documentar.

`capability_vocabulary` também vive em `metadata` (normalmente em
`COMPANY.md`) e declara qual versão do vocabulário de capacidades o pacote
segue — hoje, sempre `capabilities/v1`.

## 3. Alias pt-BR

Quatorze chaves de `metadata.*` têm um alias em português, aceito na
leitura e nunca emitido na escrita. `normalizeAliases` (em `tools/rules.mjs`)
reescreve o alias para o canônico ao carregar o pacote; quando as duas
formas coexistem no mesmo arquivo, o canônico vence e o alias é descartado
com aviso — nenhum dos dois é perdido em silêncio.

| Alias pt-BR | Canônico |
|---|---|
| `fronteira` | `boundary` |
| `pode` | `can` |
| `nao_pode` | `cannot` |
| `capacidades` | `capabilities` |
| `orcamento` | `budget` |
| `moeda` | `currency` |
| `teto_mensal` | `monthly_cap` |
| `alerta_em` | `alert_at` |
| `destinatario_do_alerta` | `alert_to` |
| `alerta_para` | `alert_to` |
| `portoes_humanos` | `human_gates` |
| `memoria` | `memory` |
| `contexto` | `context` |
| `vocabulario_de_capacidades` | `capability_vocabulary` |

Dois aliases diferentes apontam para o mesmo canônico (`destinatario_do_alerta`
e `alerta_para`, ambos → `alert_to`): é por isso que a colisão entre dois
aliases para a mesma chave — não só alias contra canônico — tem checagem
própria em `normalizeAliases`.

Pacote novo escrito a partir deste acervo usa sempre a forma canônica. O
alias existe para não quebrar um pacote escrito antes desta convenção, não
para dar duas formas igualmente válidas de escrever pacote novo.

### Alias de forma, não só de chave: `human_gates` como lista de string

Além do alias de nome (`portoes_humanos` → `human_gates`), `human_gates`
tem um segundo alias — de **forma do valor**, não de chave. A forma antiga
é uma lista de string crua:

```yaml
human_gates:
  - deploy em produção
  - gasto acima do teto do papel
```

Essa forma é aceita e normalizada para `{ id: <slug derivado da string> }`,
porque `capabilities.approve` referencia `human_gates[].id`, e sem `id` não
há o que referenciar. Esse snippet é sintético — nenhum pacote do acervo usa
hoje a forma de string crua; todos os pacotes migrados já escrevem `id`
explícito. A normalização continua existindo mesmo assim, porque ela
protege um pacote escrito antes desta convenção e trazido de fora, não
porque algum pacote deste acervo depende dela. Escrever `id` explícito
(como no exemplo da seção 5) é o que um pacote novo faz; a lista de string
crua continua válida para o que já existe fora deste repositório.

## 4. Exemplo completo de `AGENTS.md`

```markdown
---
name: Gerente
title: Gerente
slug: gerente
reportsTo: null
skills: []
metadata:
  persona:
    display_name: Fixture Silva
    icon: "🧪"
    pronouns: ela/dela
    headline: Persona de fixture
    background:
      - Existe para o teste ter o que carregar
    strengths: [parsing]
    signature_question: "Isso carregou?"
  boundary:
    can: [ler o repositório]
    cannot: [fazer deploy]
  capabilities:
    read: [repository]
    write: []
    execute: { allow: [], deny: [] }
    network: false
    delegate: []
    budget:
      currency: BRL
      monthly_cap: 400.00
      alert_at: 0.7
      alert_to: gerente
    approve: [deploy-producao]
  memory: { scope: project, retention: project, writes: [] }
  context:
    sources:
      - kind: repo_file
        path: CLAUDE.md
        required: false
      - kind: package_doc
        ref: ../../COMPANY.md
    excludes:
      - kind: path
        glob: "secrets/**"
---

# Gerente

Corpo do agente.
```

`capabilities.approve` referencia `deploy-producao` — o `id` de um dos
`human_gates` declarados em `COMPANY.md` (seção 5). É essa referência que
amarra "o que este papel pode aprovar" a "o que exige assinatura humana":
sem o `id`, não há como o validador confirmar que o portão referenciado
existe.

`capabilities.budget` é o teto **deste papel** — `monthly_cap: 400.00` —
que convive com o teto da empresa em `COMPANY.md` (seção 5). São dois
números porque respondem a perguntas diferentes: quanto a empresa gasta no
total, e quanto este papel especificamente pode gastar antes de parar.

Os dois exemplos, lidos como um pacote só (o papel `gerente` desta seção
dentro do pacote `pacote-minimo` da seção 5), têm de respeitar duas
invariantes:

- **`alert_to` tem de nomear um papel que existe no mesmo pacote.** Teto
  cujo alerta vai para ninguém é teto que ninguém aplica — e esta não é só
  uma regra de estilo: é a regra de validação E08, que **reprova** o
  pacote, não avisa. É por isso que `alert_to` aqui é `gerente`, o único
  papel deste pacote, e não um papel de outro exemplo.
- **O teto da empresa tem de ficar acima dos tetos de papel que ele
  contém.** Teto de empresa abaixo do teto de um papel significa que o
  papel nunca alcança o próprio limite — o limite do papel fica decorativo.
  Esta segunda invariante é uma exigência de coerência do pacote; não
  encontrei uma regra do validador (seção 7) que a verifique diretamente,
  então não afirmo que ela é aplicada — só que um pacote que a viola não
  faz sentido lido como um todo.

`context.sources[].kind` usa o vocabulário fechado de `context_kind`:
`repo_file` lê um arquivo do repositório pelo caminho (`path`); `package_doc`
lê outro arquivo do próprio pacote por referência relativa (`ref`);
`url` e `path` cobrem, respectivamente, uma fonte externa por endereço e uma
fonte local por caminho fora do repositório. `required: false` em
`repo_file` declara que a ausência do arquivo não é erro — o agente segue
sem ele. `excludes` usa a mesma forma para o que nunca entra no contexto,
mesmo que esteja dentro do que `sources` apontaria: aqui, todo caminho sob
`secrets/`.

## 5. Exemplo completo de `COMPANY.md`

```markdown
---
name: Pacote Mínimo
description: Exemplo de pacote completo
slug: pacote-minimo
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 2000.00
    alert_at: 0.7
    alert_to: gerente
  human_gates:
    - id: deploy-producao
      description: deploy em produção
      signer: pessoa nomeada no kickoff
---

# Pacote Mínimo

Corpo do pacote.
```

Note o `id` em cada entrada de `human_gates`. A forma de lista de string
crua (ver seção 3) continua válida, mas só a com `id` dá a
`capabilities.approve` o que referenciar. Um pacote que precisa de um
papel aprovando um portão específico escreve `id` explícito; um pacote em
que ninguém aprova nada por `capabilities.approve` pode seguir com a lista
de string, que a normalização resolve. `software-house/COMPANY.md` escreve
`id` explícito em todos os quatro portões e, mesmo assim, nenhum papel do
pacote aprova nenhum deles — o portão sobre o próprio teto e o portão de
deploy são ambos assinados por pessoa nomeada, nunca por um papel, porque
aprovar o próprio limite é conflito, não segregação de função.

## 6. A persona não entra no prompt

`metadata.persona` existe para o humano que olha o organograma, para o
Studio que desenha o card do agente, e para quem está decidindo se aquele
papel é o certo para a tarefa. Ela não entra no prompt do modelo.

A razão é custo sem retorno: `background` e `strengths` são texto que seria
enviado em **toda chamada** ao modelo, e não mudam nenhum comportamento —
o agente não age diferente por saber que a própria persona tem três linhas
de histórico. Pagar esse custo em cada chamada, para um benefício que existe
só na tela, é exatamente o tipo de gasto que `budget` e `alert_to`
existem para conter.

A única parte da persona que chega a um emissor de runtime é
`persona.headline` — e só como a `description` do agente, o resumo de uma
linha que uma plataforma usa para listar o papel. `display_name`, `icon`,
`pronouns`, `background`, `strengths` e `signature_question` ficam fora de
qualquer emissor: eles servem para construir a página, não a chamada.

## 7. Catálogo de erros e avisos

Este catálogo é gerado a partir do código (`tools/rules.mjs` e
`tools/schema.mjs`), não de memória — toda entrada abaixo corresponde a um
`erro('E..', 'slug', ...)` ou `{ code: 'W..', ... }` real no validador.

**Erro reprova, aviso não.** `node tools/validate.mjs` sai `1` se houver
qualquer erro, `0` se só houver avisos. Essa é a única garantia que o
CLI oferece — um teto que dependesse de alguém ler um aviso não seria teto.

### Erros (`E01`–`E14`) — reprovam o pacote

| Código | Regra (`rule`) | O que rejeita | Consequência sem a regra |
|---|---|---|---|
| E01 | `license-ausente` | `COMPANY.md` sem `license` declarado | Pacote sem base legal de uso entraria no acervo público sem aviso |
| E02 | `vocabulario-desconhecido` | Valor fora do vocabulário fechado de `capabilities/v1` (`capabilities.read`/`write`, `memory.scope`, `memory.retention`, `context.sources[].kind`) | Cada pacote inventaria seu próprio dialeto; nada seria portável entre runtimes |
| E03 | `delegacao-orfa` | `capabilities.delegate` aponta para um slug que não é agente do pacote | Delegação para papel fantasma, que falha silenciosamente em runtime |
| E04 | `portao-inexistente` | `capabilities.approve` referencia um gate que não está em `metadata.human_gates` | Aprovação sem portão real por trás — segurança decorativa |
| E05 | `hierarquia-rota` / `ciclo-de-delegacao` | `reportsTo` que não resolve para um papel do pacote, ou cadeia de `reportsTo` que forma ciclo | Organograma sem raiz resolvível, ou raiz circular — hierarquia impossível de desenhar |
| E06 | `fronteira-ausente` | Papel sem `metadata.boundary` (nem `can` nem `cannot`) | Papel sem fronteira declarada é, por omissão, papel que pode tudo |
| E07 | `orcamento-ausente` | Papel que escreve ou executa comando e não tem `budget`, próprio nem herdado da empresa | Agente sem teto é risco financeiro sem alarme |
| E08 | `alerta-sem-destinatario` | `budget` sem `alert_to`, ou `alert_to` que não é papel do pacote | Teto que ninguém aplica, porque ninguém é avisado quando ele é cruzado |
| E09 | `segredo-literal` | Segredo literal (chave `sk-*`, token do GitHub, access key AWS, chave privada) ou caminho absoluto de máquina, em qualquer arquivo do pacote | Acervo público vazaria credencial ou caminho de máquina interna |
| E10 | `prosa-contradiz-capacidade` | `boundary.cannot` nega uma ação (deploy, merge, push, escrever código) que `execute.allow` permite | Prosa e capacidade descrevem a mesma fronteira e discordam; quem lê a prosa confia na fronteira errada |
| E11 | `segregacao-violada` | O mesmo papel escreve código (`capabilities.write` inclui `code`) e aprova portão humano | Segregação de função violada: quem implementa também assina o próprio trabalho |
| E12 | `arquivo-malformado` | `COMPANY.md`, ou um item de `agents`/`skills`/`teams`/`tasks`, não carrega (YAML malformado, frontmatter sem `---` de fechamento, etc.) | Antes desta regra, isso abortava a carga do pacote inteiro com stack trace bruta, sem nomear o arquivo culpado |
| E13 | `portao-malformado` | `metadata.human_gates` que não é lista, ou uma entrada que não é string nem objeto com `id` válido | Antes desta regra, um gate sem `id` virava `undefined` no conjunto de ids, e produzia um E04 que acusa "portão não existe" quando a causa real é a declaração malformada do próprio portão |
| E14 | `approve-discorda-do-signer` | `capabilities.approve` lista um gate cujo `human_gates[].signer` não é o próprio papel | `approve` significa "este papel pode assinar"; se o `signer` real é outra pessoa ou outro papel, a declaração é falsa — segurança decorativa do mesmo tipo que E04, só que com o portão existindo de fato |

### Avisos (`W01`–`W04`) — não reprovam o pacote

| Código | O que sinaliza | Consequência de ignorar |
|---|---|---|
| W01 | Alias pt-BR em uso (ex.: `fronteira`, `pode`, `orcamento`) em vez do canônico em inglês | Nenhuma — o alias é aceito na leitura. `--fix` reescreve para o canônico |
| W02 | Alias pt-BR colide com a chave canônica, que já estava preenchida | O alias foi descartado, o primeiro valor (canônico) foi mantido — aviso evita que a colisão passe em silêncio |
| W03 | Papel sem `metadata.persona.display_name` | O Studio mostra o slug no lugar do nome legível — cosmético, não funcional |
| W04 | Papel sem `skills` declaradas | Papel sem skill associada — não impede o pacote de validar, mas é informação incompleta |

### Verificação de completude do catálogo

```bash
impl=$(grep -ohE "'E[0-9]{2}'" tools/*.mjs | tr -d "'" | sort -u)
doc=$(grep -ohE "E[0-9]{2}" SCHEMA.md | sort -u)
diff <(echo "$impl") <(echo "$doc") && echo "catalogo completo" || echo "DIVERGE"
```
