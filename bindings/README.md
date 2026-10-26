# Bindings — tradução de capacidade para runtime

## 1. O que é um binding

Um binding é a tabela de tradução entre o vocabulário fechado deste acervo
(`capabilities/v1`) e os nomes concretos de um runtime de agente — a
ferramenta que o Claude Code chama `Bash`, o bloco `permission` que o
opencode usa, a lista de domínio que um proxy de rede entende. Existe para
que nenhum nome de fornecedor entre no `AGENTS.md`: o pacote declara "este
papel lê o repositório", não "este papel tem a tool Read" — e é o binding
que decide o que "Read" significa em cada destino.

Cada binding é um arquivo `.yml` nesta pasta, carregado por
`tools/bindings.mjs` (`applyBinding`) e usado pelo CLI `tools/emit.mjs` e
pelo Studio (que importa o mesmo módulo puro no browser para o preview de
emissão).

## 2. Quatro estados, não dois

Até a tarefa 27, uma capacidade só podia estar `map`eada (traduzida para
ferramenta do runtime) ou `unsupported` (perdida). Isso é binário, e o
binário não consegue expressar o meio do caminho: um arquivo que **sobrevive
intacto** na emissão, mas que o runtime **não age** sobre — Paperclip copia
o pacote byte a byte, logo `budget` sobrevive no arquivo, mas a spec base
`agentcompanies/v1` não define orçamento (§15 — é extensão de fornecedor),
logo o runtime não aplica teto nenhum. Chamar isso de "sem perda" é mentira
por omissão: tão governança quanto dizer que o runtime enforce o que ele só
guarda.

A tarefa 30 soma um quarto estado: até então, `loses` também carregava duas
coisas diferentes com o mesmo nome — a capacidade que o runtime **não tem
onde guardar** (`budget` no Claude Code: zero campo de custo, confirmado
por busca) e a que ele **tem onde guardar e o emissor simplesmente não
gera** (`execute.deny`, antes do fix de hooks por agente; `read.database`,
que exige um servidor MCP que o pacote não declara). Misturar as duas
esconde dívida de engenharia detrás do limite de um terceiro — e ninguém
fatura o terceiro pela dívida que é nossa.

Por isso todo binding desta pasta declara `translates`, `preserves`,
`loses` **e** `not_emitted`:

| Estado | Significa |
|---|---|
| `translates` | O runtime **honra** a capacidade; a chave nomeia o mecanismo concreto, e ele é de fato emitido |
| `preserves` | O dado **sobrevive** no arquivo emitido; o runtime **não age** sobre ele |
| `loses` | O runtime **não tem onde guardar** a capacidade — nem sobrevive, nem é honrado |
| `not_emitted` | O mecanismo **existe** e está nomeado (`mechanism`), mas este emissor **ainda não o gera** (`falta` diz o que falta) — dívida nossa, não limite do runtime |

Ordem de resolução de uma capacidade: `translates` → `preserves` →
`loses` → `not_emitted` → nenhum dos quatro é defeito do binding,
reportado como perda não declarada.

`map` e `unsupported` continuam funcionando como **alias de leitura** de
`translates`/`loses` — um binding de terceiro escrito no formato antigo
ainda carrega, com o mesmo texto de motivo ("declarado em unsupported") que
sempre teve. Não existe alias antigo para `not_emitted`: é estado novo, sem
formato anterior a compatibilizar. Todo binding novo, e toda revisão de um
existente, usa os quatro nomes.

## 3. `rule_order` e `allowlist_scope`

Duas propriedades a mais, porque a tradução de capacidade para regra de
runtime pode estar **sintaticamente completa e logicamente invertida**:

- **`rule_order`** (`first-match` | `last-match`): a ordem em que o runtime
  resolve uma lista de regras de permissão. O OpenCode V2 avalia
  **última-regra-vence** — emitir uma lista pensada para primeira-vence
  inverte a fronteira em silêncio, o tipo de erro mais perigoso porque o
  arquivo parece certo até o caso que importa.
- **`allowlist_scope`** (`os` | `fetch-only`): o que uma allowlist de
  domínio realmente cobre. `os` significa que o sandbox do sistema
  operacional intercepta toda rede do processo, shell cru incluído.
  `fetch-only` significa que a allowlist só vale para a chamada de busca da
  ferramenta — um papel com shell cru liberado (`curl`, `wget`) escapa
  dela por completo. `applyBinding` avisa quando os dois — allowlist e
  shell cru — coexistem num binding `fetch-only`; não tenta reconhecer todo
  comando perigoso, porque qualquer shell liberado já anula a lista.

Todo binding que emite uma lista de regra declara `rule_order`. Todo
binding que traduz `network.allowlist` declara `allowlist_scope`.

## 4. A regra de cobertura total

Toda capacidade que o acervo realmente usa — cada `capabilities.read`,
`capabilities.write`, `execute.allow`/`deny`, `network`,
`network.allowlist`, `delegate`, `budget`, `approve`, e também os campos de
topo `skills`, `memory`, `context` (ver §5) — tem de aparecer em
`translates`, `preserves`, `loses` **ou** `not_emitted` de todo binding
desta pasta. Não existe quinta opção, e "esqueci de declarar" é o próprio
defeito que este mecanismo existe para impedir.

A razão é a mesma que justifica a existência do `lost` em `applyBinding`:
perda silenciosa de fronteira é pior que fronteira ausente, porque cria a
impressão de governança onde nenhuma sobreviveu. Um binding que esquece de
declarar uma capacidade não produz erro visível na emissão — produz um
agente emitido com menos fronteira do que o pacote descreve, e ninguém
percebe até o papel fazer algo que devia ter sido negado.

`test/bindings-arquivos.test.mjs` tem um teste nomeado exatamente "REGRA
CENTRAL" que varre os três pacotes, calcula toda capacidade em uso via
`capabilityKeys`, e falha nomeando a capacidade que qualquer binding deixou
descoberta. Esse teste é o portão: nenhum binding novo, e nenhuma mudança a
um existente, entra sem passar por ele.

## 5. `skills`, `memory` e `context` são capacidade endereçável

Até esta versão, `skills` (campo de topo do frontmatter) e `memory`/
`context` (dentro de `metadata`, ao lado de `capabilities`) viviam fora de
`capabilityKeys` — a enumeração só varria `metadata.capabilities`. Isso foi
exatamente o que deixou `skills` sem casa: nenhum binding tinha a chave em
`map` nem em `unsupported`, e como `capabilityKeys` nunca a produzia, nenhum
teste de cobertura reclamava. O defeito não tinha alarme porque o mecanismo
de alarme não enxergava a chave.

A correção generaliza o mecanismo, não só o caso: `capabilityKeys` agora
também enumera `skills`, `memory` e `context` quando declarados, e a regra
de cobertura total (§4) os varre do mesmo jeito que varre `read`/`write`.
Um campo de topo novo que o acervo passe a usar cai sob a mesma verificação
sem precisar de um segundo mecanismo paralelo — era esse segundo mecanismo
(a antiga `unsupported_metadata`, restrita por lista fixa a
`['memory', 'context']`) que não tinha onde crescer.

`unsupported_metadata` continua existindo como alias de leitura de `loses`
para esses três campos, pela mesma razão que `map`/`unsupported` continuam:
compatibilidade com binding de terceiro.

## 3. Procedência

| Binding | Runtime | Estado | O que isso significa |
|---|---|---|---|
| `claude-code.yml` | Claude Code | **Verificado** | Lido direto do formato em uso: plugin dev-squad e `~/.claude/agents` |
| `paperclip.yml` | Paperclip | **Identidade** | O acervo já é `agentcompanies/v1` — não há tradução, só cópia e validação |
| `opencode.yml` | opencode | **Observado, pendente de confirmação** | Lido de `rclr-labs/dev-factory`, nunca confirmado contra a documentação oficial do runtime |
| `portable.yml` | — (manifesto) | **Desenho próprio** | Formato criado por este acervo para o runtime que ainda não tem fonte primária lida — o alvo sem perda |

Um binding "observado, pendente de confirmação" não é um binding verificado
com um adjetivo mais fraco: é uma declaração explícita de que a fonte do
conhecimento sobre o formato é uso interno observado, não documentação
lida. `opencode.yml` carrega essa frase no próprio `source`, e um teste
verifica que ela está lá.

## 4. Como escrever um binding novo

Cinco campos são obrigatórios em todo arquivo desta pasta:

| Campo | O que declara |
|---|---|
| `runtime` | O nome do runtime de destino |
| `source` | De onde vem o conhecimento sobre o formato — verificado por leitura direta, identidade, observado-pendente, ou desenho próprio. Nunca omitido: procedência de formato não declarada é formato que ninguém pode auditar |
| `emits` | O padrão de caminho de saída (`.claude/agents/<slug>.md`, `agent-manifest.json`, etc.) |
| `format` | A chave que `tools/writers.mjs` usa para escolher o escritor (`claude-code`, `opencode`, `identity`, `portable`) |
| `map` | O dicionário capacidade → ferramenta(s) do runtime. Chave ausente de `map` e de `unsupported` é defeito do binding, detectado em `applyBinding` como perda "não declarada" |

Campos adicionais do esquema de quatro estados:

- `preserves` — lista de chaves de capacidade cujo dado sobrevive no
  arquivo emitido, mas que o runtime não aplica.
- `loses` — lista de chaves cuja capacidade o runtime não tem onde
  guardar — nem sobrevive, nem é honrada. Substitui `unsupported` nos
  bindings novos; `unsupported` continua funcionando como alias de
  leitura.
- `not_emitted` — dicionário `chave → { mechanism, falta }`: o mecanismo
  do runtime existe e está nomeado em `mechanism`, mas este emissor ainda
  não o gera — `falta` diz o que falta para gerá-lo (um dado que o pacote
  não declara, uma implementação que ainda não existe). As duas chaves são
  obrigatórias em toda célula; sem `mechanism`, é perda com outro nome.
- `rule_order` — obrigatório quando o binding emite lista de regra
  (`first-match` ou `last-match`).
- `allowlist_scope` — obrigatório quando o binding traduz
  `network.allowlist` (`os` ou `fetch-only`).
- `citations` — mapa opcional `chave → texto`, citando a página ou o
  arquivo lido que sustenta a célula. Uma citação pode ser string (fonte
  direta) ou `{ inferido: true, source: "razão" }` quando não há onde
  apontar — mas toda célula de um binding publicado tem de ter uma das
  duas, nunca nenhuma.

Campos anteriores, mantidos como alias de leitura:

- `map` — alias de `translates`.
- `unsupported` — alias de `loses`.
- `unsupported_metadata` — subconjunto de `['memory', 'context', 'skills']`,
  alias de `loses` para os três campos de topo que não vivem dentro de
  `capabilities` (ver §5).

Ao escrever um binding novo, rode `node --test test/bindings-arquivos.test.mjs`
antes de qualquer commit: a regra de cobertura total e a prova de que nenhum
agente real produz perda não declarada rodam ali, contra os três pacotes
publicados.
