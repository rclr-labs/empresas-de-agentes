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

### Erros (`E01`–`E19`) — reprovam o pacote

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
| E15 | `alcance-nao-declarado` | Capacidade nega a rede (`network` falso) que um comando de `execute.allow` usa (`COMANDOS_DE_REDE`, lista nomeada e exportada em `tools/rules.mjs`), ou `read` inclui `web` com `network` falso | A capacidade promete silêncio e o comando promete saída — contradição verificável entre dois campos declarados, não opinião sobre prosa |
| E16 | `par-pull-request` | Três pernas da mesma capacidade: (1) `capabilities.write` inclui `pull_request` sem `"git push*"` nem `"gh pr create*"` em `execute.allow`; (2) `execute.allow` tem um desses comandos (depois de descascar runner, ex. `npx gh pr create*`) sem `write` incluir `pull_request`; (3) tem `"git push*"` especificamente (depois de descascar runner) em `allow` e `execute.deny` não nega `--force` | A metade legível por humano e a metade legível por máquina têm de nomear a mesma capacidade, e quem pode push tem de ter o limite que o torna aceitável; achado real (2026-10-26): um papel tinha `gh pr create*` em `allow` e `write` sem `pull_request`, e só a direção antiga da checagem existia para pegar isso. A terceira perna (force-deny) foi promovida de um teste do acervo para dentro da regra em 2026-10-27 — mesma família conceitual, mesma mensagem. Em 2026-10-27, a terceira perna foi reancorada de `temPush` (que inclui `gh pr create*`, comando sem flag `--force`) para `/^git push/` especificamente — achado da revisão da Task 2, inerte no acervo de hoje mas mais preciso que o invariante que ela restaura |
| E17 | `deny-de-sql-incompleto` | Para CADA ENTRADA de `execute.allow` que invoca um cliente SQL (`psql`, `mysql`, `mariadb`, `sqlite3` — lista nomeada em `tools/rules.mjs`, cliente detectado depois de descascar runner) **e que pode invocar comando destrutivo**, `execute.deny` não tem padrão que o bloqueie. Entrada COM `*` pode invocar qualquer coisa: exige cobertura do trio `DROP`/`TRUNCATE`/`DELETE` nas duas grafias (maiúscula e minúscula). Entrada SEM `*` só pode invocar o que está escrita nela: entra na exigência somente se já contiver verbo destrutivo, e aí ela mesma é o comando a ser bloqueado (`psql --version` não exige nada). A exigência é por ENTRADA, não por cliente — entrada descoberta não contamina entrada irmã já coberta. Cobertura é medida por EFEITO, não por forma: `globCasa` (helper puro em `tools/rules.mjs`, mesma semântica de `*` que o hook de `tools/writers.mjs` usa de fato) testa se algum padrão de `deny` casaria um comando destrutivo representativo — um padrão mais largo que o pedido (ex. `psql*` sozinho) conta como cobertura; um padrão que não é glob válido (ex. uma frase de prosa que só contém a palavra) não conta, mesmo contendo o cliente e o verbo como texto. O representativo é derivado da PRÓPRIA ENTRADA CRUA de `execute.allow` (`comandoRepresentativo`, substituindo o último `*` pela sentença destrutiva) — nunca de uma flag fixa escolhida pela regra, e nunca da forma descascada de runner: o hook compara `tool_input.command`, o comando inteiro, logo `allow: ["npx psql -c*"]` precisa de `deny` que case `npx psql …`, que `psql*DROP*` não casa. A mensagem de erro nomeia a ENTRADA descoberta, a grafia descoberta como está escrita, e o padrão de `deny` que a cobriria — padrão construído da mesma divisão no último `*` que o representativo, logo verificavelmente casa o comando que falta bloquear | Achado real (2026-10-26): um papel tinha `mysql -e*` em `allow` com zero `deny` de `mysql`, e outro tinha `psql*DROP*` em `deny` que não bloqueia `psql -c "drop table users"` porque SQL não é sensível a caixa e a grafia minúscula é a idiomática — o `deny` protegia a grafia que ninguém usa, e parecia cobertura sem ser. Fix-round 1 (2026-10-27, achado do coordenador): a primeira versão da regra media cobertura por CONTENÇÃO DE TOKEN (`começa com o cliente e contém a palavra`), e isso aceitava `"psql nunca rode DROP em producao"` como se bloqueasse algo — a mesma classe de defeito que esta fase caça, agora dentro da própria guarda. Fix-round 2 (2026-10-27, achado do revisor): a correção do round 1 cravava a flag `-c` no representativo para todo cliente, inclusive `mysql`, cuja forma real é `-e` — fazendo um `deny` ancorado na flag errada parecer cobertura, e um ancorado na flag certa parecer incompleto. Um mapa de flag por cliente seria enumeração, cega ao primeiro `--command`/`--execute` novo; a correção deriva a forma do próprio `allow`, que já a declara. Fix-round 3 (2026-10-27, achado do coordenador): a correção do round 2 fazia `continue` quando a entrada de `allow` não tinha `*` (nenhum curinga onde injetar a sentença), e isso tirava essa entrada da exigência de `deny` POR INTEIRO — regressão: uma entrada já literalmente destrutiva (`allow: ['psql -c "DROP TABLE users"']`) sem nenhum `deny` de SQL passava limpo. A correção: entrada sem `*` usa a PRÓPRIA ENTRADA como representativo — ela já é a sentença completa, só falta perguntar a `globCasa` se algum `deny` a casa. Fix-round 4 (2026-10-27, achado da revisão): a correção do round 3 passou a exigir cobertura de entrada literal SEM verbo destrutivo (`allow: ['psql --version']` disparava E17), pedindo bloqueio de um `DROP` que aquela entrada é estruturalmente incapaz de invocar — e como `faltando` era um Set por CLIENTE, isso contaminava entradas irmãs já corretamente cobertas: `allow: ['psql -c*', 'psql --version']` com o trio completo ancorado em `-c` continuava reprovado, e a única forma de silenciar era `deny: ['psql --version']` — negar o que se acabou de permitir, a defesa decorativa exata que esta regra existe para caçar. A correção não é um caso a mais: é a pergunta que unifica as quatro camadas numa regra só — "para cada ENTRADA que possa invocar comando destrutivo, existe `deny` que o bloqueia?" — da qual os dois casos (com e sem curinga) decorrem sem caso especial, e `faltando` por entrada elimina a contaminação por construção. O `deny` é defesa em profundidade, não a fronteira real (essa é o portão humano) |
| E18 | `persona-invalida` | Para cada papel com `metadata.persona` declarada, três invariantes verificáveis DENTRO do pacote, todos sobre o que está DECLARADO: `display_name` com caractere fora de `[A-Za-z ]` (acento, diacrítico, símbolo); `background`, quando EXISTE (`isListaDeTextoValida`), que não tem exatamente 3 linhas; ou o corpo do agente (`AGENTS.md`) contendo o `display_name` por extenso | `display_name` tem de funcionar em pt-BR e em inglês — acento quebra isso. `background` declarado com menos de 3 linhas perde a linha que funciona como cicatriz, a que faz o modelo seguir a regra quando ela custa; cada linha extra além de 3 é zelo que a vitrine não pede. O corpo nunca menciona o `display_name`: o papel é o papel, não a pessoa, e o nome no prompt custa token em toda chamada sem servir ao modelo — só serve ao humano e à vitrine, fora do corpo. Verifica tipo antes de conteúdo: `display_name`/`background` com TIPO errado (número, string no lugar de lista) é `E19`, não `E18` — ver `verificarTiposDePersona`. Unicidade de ícone, nome e sobrenome ENTRE pacotes é invariante de acervo, não de pacote — fica para `validateAcervo(pkgs)` (Task 5); `validatePackage(pkg)` recebe um pacote só e não pode decidir unicidade global. **A divisão com `W03`:** E18 é o que está DECLARADO e está ERRADO (o papel mente sobre si); AUSÊNCIA de `display_name`/`icon`/`pronouns`/`background` nunca é E18 — isso é `W03`, persona incompleta, degradação de vitrine, não defeito de governança. `background` entrou nesse lado da divisão no ruling de 2026-10-27 (fix-round 2): a persona não entra no prompt, exceto `signature_question` — `background` custa token sem mudar comportamento, então sua ausência é card pobre, não mentira sobre si |
| E19 | `tipo-de-campo-invalido` | Campo de `capabilities` com tipo diferente do esperado: `read`/`write`/`delegate`/`approve` que não é lista de texto; `execute` que não é objeto, ou `execute.allow`/`execute.deny` que não é lista de texto; `network` que não é `true`, `false` nem lista de texto; `budget` que não é objeto. Desde E18, também `metadata.persona.display_name` que não é texto, e `metadata.persona.background` que não é lista de texto | O validador roda no navegador, sobre o que o editor está digitando — tipo errado é o caso ESPERADO ali, não exceção. Antes desta regra, campo de tipo errado derrubava o validador com `TypeError` (`padrao.match`, `allow.find`, "not iterable") em vez de reprovar o pacote, e no caso de `write` como string nem derrubava: produzia uma dúzia de `E02` espúrios, um por caractere, porque `for...of` itera string. Falhar aberto num validador que roda sobre conteúdo em edição é tela branca com stack; E19 falha fechado, com mensagem nomeada |

### Avisos (`W01`–`W05`) — não reprovam o pacote

| Código | O que sinaliza | Consequência de ignorar |
|---|---|---|
| W01 | Alias pt-BR em uso (ex.: `fronteira`, `pode`, `orcamento`) em vez do canônico em inglês | Nenhuma — o alias é aceito na leitura. `--fix` reescreve para o canônico |
| W02 | Alias pt-BR colide com a chave canônica, que já estava preenchida | O alias foi descartado, o primeiro valor (canônico) foi mantido — aviso evita que a colisão passe em silêncio |
| W03 | Persona incompleta: falta `metadata.persona.display_name`, `.icon`, `.pronouns` ou `.background` (um aviso por campo ausente) | O card da vitrine degrada — mostra o slug no lugar do nome, fica sem ícone, sem pronome, ou sem histórico — mas o papel continua válido e a fronteira continua intacta. **A divisão com `E18`:** W03 é o que FALTA (persona incompleta); E18 é o que está declarado e está ERRADO (persona malformada — ASCII, 3 linhas de um `background` que existe, vazamento no corpo). `background` ausente entrou aqui no ruling de 2026-10-27 (fix-round 2), corrigindo o ruling anterior (fix-round 1), que tinha dividido `display_name`/`icon`/`pronouns` para W03 mas deixado `background` ausente cair em E18 por omissão — mesma razão dos outros três: a persona não entra no prompt, exceto `signature_question`, então `background`/`headline` custam token sem mudar comportamento; sua ausência é card pobre, não papel que mente sobre si. Inverter isso e fazer qualquer um dos quatro campos ausente reprovar o pacote seria incoerente com `display_name` ausente já ser aviso desde antes desta regra, e quebraria pacote de terceiro que não se importa com esta vitrine |
| W04 | Papel sem `skills` declaradas | Papel sem skill associada — não impede o pacote de validar, mas é informação incompleta |
| W05 | `ressalva-de-allowlist-ausente` — papel declara domínio em `network` e comando de `COMANDOS_DE_REDE` em `execute.allow`, e o corpo não traz a ressalva `allowlist_scope` | Quem adapta o papel para um runtime onde a allowlist não é fronteira de SO (OpenCode V2, janus `kind=cli`) confia numa restrição que o comando atravessa |

### Regras de acervo (`A01`) — o invariante que um pacote não pode decidir

`validatePackage(pkg)` recebe **um** pacote e, por isso, não pode decidir
nada que dependa de olhar os outros sete. Todo o catálogo acima —
`E01`–`E19`, `W01`–`W05` — é regra DENTRO de um pacote: roda sobre `pkg`
sozinho, e um pacote de terceiro isolado já é entrada suficiente para
avaliá-las todas. Fingir que uma regra DENTRO de um pacote pode certificar
algo sobre o acervo INTEIRO seria a regra mentindo sobre o que ela de fato
verificou — por isso esta categoria vive separada, com prefixo `A`
(acervo), não `E`/`W` (pacote), e com função própria, `validateAcervo(pkgs)`,
que recebe a LISTA de pacotes em vez de um pacote só.

| Código | Regra (`rule`) | O que rejeita | Consequência sem a regra |
|---|---|---|---|
| A01 | `identidade-repetida` | Ícone, `display_name` ou sobrenome de `metadata.persona` repetido entre QUAISQUER dois papéis do acervo — do mesmo pacote ou de pacotes diferentes; campo ausente nunca entra na comparação | Dois papéis com a mesma identidade visual/nominal na vitrine — o humano não consegue distinguir quem é quem no card, e a unicidade que o acervo promete (42 papéis, 42 identidades) vira coincidência, não garantia |

**Quem chama:** o CLI (`tools/validate.mjs`), quando valida sem alvo
explícito — o modo "acervo inteiro" que já carrega todos os pacotes via
`listPackages`; e a vitrine, hoje com o acervo inteiro carregado em memória,
e na Fase 2 também validando o pacote em edição, um só. Com `--package
<alvo>` (um pacote só, de propósito), o CLI NÃO chama `validateAcervo` — ela
decidiria unicidade sobre um recorte que o operador nunca pediu, e a
pergunta "este pacote de terceiro é internamente consistente" já é
respondida por `E01`–`E19` sem precisar do resto do acervo.

**Chamada parcial não é recusada — é declarada.** `validateAcervo(pkgs)`
devolve `{ errors, verificados }`, onde `verificados` é a lista de slugs que
de fato entraram na comparação. Fix-round 1 desta tarefa (2026-10-27,
achado do coordenador): a vitrine da Fase 2 é exatamente o chamador que
valida UM pacote, e `A01` passar verde ali teria a mesma cara de
"unicidade do acervo inteiro confirmada" que `validatePackage` passar verde
tem de "pacote correto" — o padrão de certificação incompleta que a Fase
D-bis já corrigiu nos bindings (`preserves` não é `translates`). A correção
não é guarda (não recusa, não infere o tamanho certo — isso engessaria um
chamador legítimo): é visibilidade. Quem chama com 1 pacote lê
`verificados: ['x']` e sabe que leu unicidade de 1, não de 8; quem chama com
o acervo inteiro lê os 8 slugs e pode dizer "unicidade verificada em 8
pacotes" em vez de só "verificada".

**Lista vazia é recusada (lança), não aprovada.** `validateAcervo([])`
nunca devolve `{ errors: [] }` — zero pacotes não é "zero colisão
verificada", é carregamento incompleto (`listPackages` sem resultado, raiz
errada) disfarçado de acervo limpo. Um teto que aprova sem ter checado nada
não é teto.

**Persona ausente não é colisão.** Dois papéis sem ícone não "repetem"
`undefined` — a ausência é `W03` (regra de pacote), nunca `A01`. Esta
distinção é a cicatriz de 2026-10-24: um teste de unicidade escrito sem o
filtro de ausência acusou repetição onde havia falta.

### Verificação de completude do catálogo

```bash
impl=$(grep -ohE "'[EWA][0-9]{2}'" tools/*.mjs | tr -d "'" | sort -u)
doc=$(grep -ohE "[EWA][0-9]{2}" SCHEMA.md | sort -u)
diff <(echo "$impl") <(echo "$doc") && echo "catalogo completo" || echo "DIVERGE"
```

## 8. Bindings: quatro estados, não dois

`bindings/*.yml` traduz `metadata.capabilities` (e os campos de topo
`skills`/`memory`/`context`) para o vocabulário de um runtime concreto.
Até 2026-10-25 essa tradução era binária: `map` (traduzido) ou
`unsupported` (perdido). O binário não consegue expressar o meio do
caminho — um dado que **sobrevive no arquivo emitido** sem que o runtime
**aja** sobre ele — e, descoberto na tarefa 30, também não consegue
distinguir dois tipos de perda que a tarefa 27 ainda chamava pelo mesmo
nome: a capacidade que o runtime **não tem onde guardar** (limite de
terceiro) e a que ele **tem onde guardar e nós simplesmente não geramos**
(dívida nossa). Misturar as duas esconde a segunda detrás da primeira —
e ninguém fatura o terceiro pela dívida que é nossa. `tools/bindings.mjs`
(`applyBinding`) resolve toda capacidade em um de QUATRO estados, nesta
ordem de resolução — `translates` → `preserves` → `loses` →
`not_emitted` → nenhum dos quatro é defeito do binding, reportado como
perda não declarada:

| Estado | Significa | Exemplo medido |
|---|---|---|
| `translates` | O runtime **honra** a capacidade; a célula nomeia o mecanismo, e ele é de fato emitido | `execute.deny` no Claude Code: hook `PreToolUse` no frontmatter do próprio agente, negando (`exit 2`) os padrões daquele papel |
| `preserves` | O dado **sobrevive** no arquivo; o runtime **não age** sobre ele | `budget` no Paperclip: a spec base não define orçamento (§15 — extensão de fornecedor), mas a cópia byte a byte preserva o campo |
| `loses` | O runtime **não tem onde guardar** a capacidade — nem sobrevive, nem é honrado | `budget` no Claude Code e no OpenCode: nenhum campo de custo existe em nenhum dos dois |
| `not_emitted` | O mecanismo **existe** no runtime e está nomeado (`mechanism`), mas este emissor **ainda não o gera** (`falta` diz o que falta) | `read.database` no Claude Code: `tools: mcp__<servidor>__<ferramenta>` é mecanismo real, mas nenhum `AGENTS.md` do acervo nomeia o servidor |

Capacidade fora dos quatro estados é **defeito do binding** — `applyBinding`
reporta como perda com motivo "não declarada", nunca em silêncio.
`map`/`unsupported`/`unsupported_metadata` continuam carregando como alias
de leitura de `translates`/`loses`, para binding de terceiro escrito no
formato antigo. Não há alias antigo para `not_emitted` — é estado novo.

Duas propriedades adicionais mudam o RESULTADO da tradução, não só o
vocabulário:

- **`rule_order`** (`first-match` | `last-match`) — a ordem em que o
  runtime resolve uma lista de regra de permissão. Medido: o OpenCode V2
  resolve **última-regra-vence** (`packages/schema/src/permission.ts`),
  não mais-específica-vence. Emitir uma lista pensada para primeira-vence
  inverte a fronteira em silêncio.
- **`allowlist_scope`** (`os` | `fetch-only`) — o que uma allowlist de
  domínio de rede realmente cobre. `os` (Claude Code, medido em
  `code.claude.com/docs/en/sandboxing`) intercepta todo processo filho,
  shell cru incluído. `fetch-only` (OpenCode V2 e janus com provider
  `kind=cli`) só cobre a chamada de busca da ferramenta — um papel com
  shell liberado escapa da lista por completo.

Toda célula de um binding publicado cita a página ou o arquivo lido
(`citations: { <chave>: "fonte" | { inferido: true, source: "razão" } }`).
Célula sem citação é inferência não declarada.

### 8.1 A tabela medida dos quatro bindings

Medição de **2026-10-25**
(`agent-studio/docs/pesquisa/2026-10-25-runtimes-medidos.md`), revisada na
**tarefa 30 (2026-10-26)** para separar `loses` de `not_emitted` — tabela
envelhece sem avisar se a data não acompanhar; ao reler este arquivo
depois de uma nova medição, atualizar a data junto com as células.

| Capacidade | claude-code | opencode (V2) | paperclip | portable |
|---|---|---|---|---|
| `execute.deny` | **traduz, de fato emitido** — hook `PreToolUse` no frontmatter do agente, verificado em code.claude.com/docs/en/sub-agents e /hooks | **traduz** (`shell`, last-match) | preserva (§15, extensão de fornecedor) | preserva (desenho próprio) |
| `network.allowlist` | **traduz** (`sandbox.network.allowedDomains`, SO — cobre shell cru) | **traduz**, mas void se o papel também tem shell (`fetch-only`) | preserva (§15) | preserva |
| `budget` | **perde** (sem campo de custo); `budget.max_turns` **traduz** à parte (`maxTurns`, proxy de turno, não de gasto) | **perde** (zero ocorrência no schema) | preserva (§15) | preserva |
| `read.database` | **não emitido** — mecanismo real (`tools: mcp__<servidor>__<ferramenta>`), mas nenhum `AGENTS.md` nomeia o servidor | **não emitido** — mecanismo real (`<server>_<tool>`), mesma lacuna de dado | preserva (§5–§13, não é campo base) | preserva |
| `approve` | **não emitido** por agente — `permissions.ask` **traduz em escopo de empresa** via `human_gates[].triggers`, mas não amarra qual agente aprova nem o signer | **não emitido** — `ask` é mecanismo real, mas `buildPermissions()` não o emite (sem a emissão de triggers que claude-code ganhou) | preserva (§15) | preserva |
| `skills` | **traduz** (campo de frontmatter documentado) | **perde** (ausente de `ConfigAgent.Info`; ação `skill` é controle de acesso, não declaração) | **traduz** (§5, único ponto da spec base que a tabela cobre) | preserva |
| `memory`/`context` | `memory` traduz (campo existe, vocabulário de valor não 1:1); `context` perde | ambos perdem (ausentes de `ConfigAgent.Info`) | ambos preservam (§5–§13) | ambos preservam |

A contabilidade mudou de forma qualitativa duas vezes, não só
quantitativa. Antes da medição de 2026-10-25, `claude-code.yml` declarava
quatro perdas por inferência errada que na verdade eram tradução, e
`skills` não tinha estado nenhum em binding nenhum. O fix round 1
corrigiu isso devolvendo `execute.deny`/`read.database`/`approve` para
`loses` — mas aí cometeu a classe de defeito que a tarefa 30 existe para
corrigir: chamou de "perdida", com a mesma palavra, tanto a capacidade
sem onde guardar (`budget`) quanto a que tinha mecanismo real e só não
era gerada (as três). Depois da tarefa 30: `execute.deny` saiu de `loses`
**por mérito** (hooks por agente, verificados e emitidos de verdade);
`read.database` e `approve` saíram de `loses` **por reclassificação**
(entraram em `not_emitted` — a lacuna de engenharia continua existindo,
só deixou de ser chamada de limite do runtime). Só `budget` (o teto de
custo em si) continua perdido de verdade no Claude Code e no OpenCode.
`paperclip`/`portable` continuam sem se chamar "zero perda" sem
qualificação — preservam tudo, mas não aplicam a maior parte, porque a
spec base `agentcompanies/v1` não define a maior parte (ver
`bindings/paperclip.yml` §15).

### 8.2 janus não entra nesta tabela

Medido (2026-10-25, §5.1 da pesquisa): janus **não tem formato de
agente/papel**. A unidade de governança dele é `Mission`
(`*.mission.json`), por **tarefa**, não identidade persistente de papel —
toda chamada redeclara escopo, orçamento e aprovação do zero. Escrever
`bindings/janus.yml` hoje seria inventar a correspondência "um papel do
organograma = um Mission", sem garantia de que é 1:1. A pendência
"promover `portable` → `janus`" registrada em `bindings/portable.yml`
`source` não é "escrever um mapa" — é a decisão, do Rafael, de se janus
deveria ganhar o conceito de papel persistente.

### 8.3 `human_gates[].triggers` — gatilho de comando, aditivo

`human_gates[]` ganhou, na tarefa 30, um campo opcional: `triggers`, lista
de glob de comando (mesma sintaxe de `execute.allow`/`execute.deny`) que
dispara o portão.

```yaml
human_gates:
  - id: deploy-producao
    description: deploy em produção
    signer: pessoa nomeada no kickoff
    triggers:
      - "kubectl apply*"
      - "helm upgrade*"
      - "terraform apply*"
```

- **Opcional e aditivo**, sob `metadata` como todo o resto desta extensão.
  O validador **não exige** o campo: um portão sem `triggers` continua
  válido, porque muitos são legítimos sem padrão de comando nenhum —
  contato com cliente, divulgação de achado de segurança, estouro de teto
  avaliado por número, não por comando.
- Quando presente, o emissor do Claude Code gera `permissions.ask` em
  `.claude/settings.json`, união dos gatilhos de todo portão da empresa
  que os declara (`tools/writers.mjs`, `buildAskRules`, função pura).
  Escopo de EMPRESA, não de agente — ao contrário de `execute.deny`: um
  `ask` só PAUSA para confirmação, nunca bloqueia, então a união não
  corre o risco que rejeitou a união de `execute.deny` (ver §8.1 e
  `bindings/claude-code.yml` `source`).
- Quando ausente, a capacidade `approve` permanece em `not_emitted` com
  `falta` nomeando que o portão referenciado não declara gatilho de
  comando.
- `software-house` declara `triggers` em `deploy-producao` e
  `remocao-de-dado-de-producao`; `fabrica-de-testes`, em `tocar-producao`
  e `carga-acima-do-acordado`. Os demais portões dos dois pacotes — gasto
  acima do teto, contato com cliente, divulgar achado de segurança — não
  têm padrão de comando real e por isso não declaram `triggers`.
