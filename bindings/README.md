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

## 2. A regra de cobertura total

Toda capacidade que o acervo realmente usa — cada `capabilities.read`,
`capabilities.write`, `execute.allow`/`deny`, `network`,
`network.allowlist`, `delegate`, `budget`, `approve` que aparece em algum
`AGENTS.md` dos três pacotes publicados — tem de aparecer em `map` **ou**
em `unsupported` de todo binding desta pasta. Não existe terceira opção.

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

Dois campos adicionais, opcionais mas recomendados:

- `unsupported` — lista de chaves de capacidade (no formato de
  `capabilityKeys`, ex.: `read.database`, `network.allowlist`) que o
  runtime não tem como expressar. Toda capacidade aqui vira perda
  explicada, não silenciosa.
- `unsupported_metadata` — subconjunto de `['memory', 'context']`: o que o
  binding não preserva fora de `capabilities`. `memory` e `context` não
  são capacidade — vivem em `metadata.memory` e `metadata.context` — e por
  isso não entram em `unsupported`, mas ainda precisam de declaração
  própria para não se perderem em silêncio.

Ao escrever um binding novo, rode `node --test test/bindings-arquivos.test.mjs`
antes de qualquer commit: a regra de cobertura total e a prova de que nenhum
agente real produz perda não declarada rodam ali, contra os três pacotes
publicados.
