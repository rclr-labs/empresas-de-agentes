# Protocolo de entrega (task_protocol) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar `metadata.task_protocol` no schema `agentcompanies/v1`, validado pelo validador do acervo e classificado nos quatro bindings, com `software-house` como primeiro adotante.

**Architecture:** Nova chave opcional/aditiva em `COMPANY.md`, sob o mesmo princípio de extensão que já governa `human_gates`/`budget` (SCHEMA.md §1). Duas regras de erro (`E21`, `E22`) e um aviso (`W06`) entram em `tools/rules.mjs`, puro, testável sem disco. A classificação nos bindings segue o padrão de evidência do repo — nenhuma célula entra como `translates` sem citação real; corrigido aqui para `preserves`/`not_emitted` (ver Global Constraints).

**Tech Stack:** Node.js puro (`node:test`, `js-yaml`), sem framework. `tools/rules.mjs` não pode importar `node:*` (roda no browser do Studio).

**Spec:** `docs/superpowers/specs/2026-10-31-protocolo-de-entrega-no-acervo-design.md`

## Global Constraints

- Toda extensão nova mora sob `metadata.*`, nunca chave de topo (`SCHEMA.md` §1).
- `tools/rules.mjs` é PURO — zero `import` de `node:*`, zero acesso a `process`. Só `tools/schema.mjs` toca disco.
- Erro reprova (`node tools/validate.mjs` sai `1`); aviso não.
- **Correção em relação ao spec, decidida nesta etapa de planejamento:** o spec (Decisão 4) propôs `paperclip: translates`. Nenhuma medição foi feita de que a API de issues do Paperclip LÊ `metadata.task_protocol` para dirigir o próprio ciclo de vida — o campo é lido pelo AGENTE (humano ou LLM), que então chama a API de issues manualmente. Sem essa medição, `translates` seria uma célula sem citação real, o que o próprio repo trata como defeito (`not_emitted exige mechanism e falta`, `test/bindings-arquivos.test.mjs`). Este plano classifica `paperclip` e `portable` como **`preserves`** (o campo sobrevive na cópia byte a byte; nada *age* sobre ele automaticamente) e `claude-code`/`opencode` como **`not_emitted`** (os dois têm onde guardar frontmatter arbitrário mas nenhum emissor gera nada a partir de `task_protocol` hoje). Toda citação nova entra com `inferido: true`, porque nenhuma leitura fresca da API de issues do Paperclip foi feita nesta tarefa — citar sem isso seria inferência não declarada, exatamente o que `SCHEMA.md` §8 proíbe.
- `on_runtime` é vocabulário fechado novo em `capabilities/v1.mjs` (`VOCABULARY.task_protocol_on_runtime`), não um valor dentro de `read`/`write` — crescer essa lista é decisão de versão (v2), igual ao resto do vocabulário.

---

### Task 1: Vocabulário `task_protocol_on_runtime` e alias pt-BR

**Files:**
- Modify: `capabilities/v1.mjs`
- Modify: `capabilities/v1.md`
- Modify: `test/vocabulary.test.mjs`

**Interfaces:**
- Produces: `VOCABULARY.task_protocol_on_runtime` (array congelado de 5 strings), `ALIASES.protocolo_de_tarefa === 'task_protocol'` — usados pela Task 2.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `test/vocabulary.test.mjs`:

```js
test('task_protocol_on_runtime declara os cinco mecanismos de status', () => {
  assert.deepEqual(VOCABULARY.task_protocol_on_runtime, [
    'wake_blocked', 'create_followup_issue', 'wake_on_unblock',
    'notify_assignee_chain', 'escalate_to_role',
  ]);
  assert.throws(() => { VOCABULARY.task_protocol_on_runtime.push('x'); });
});

test('protocolo_de_tarefa está entre os aliases', () => {
  assert.equal(ALIASES.protocolo_de_tarefa, 'task_protocol');
});
```

Também editar o teste já existente `'todo alias pt-BR aponta para chave canônica conhecida'` — acrescentar `'task_protocol'` ao `Set` `canonicos`:

```js
const canonicos = new Set([
  'persona', 'boundary', 'capabilities', 'memory', 'context',
  'budget', 'human_gates', 'can', 'cannot', 'currency',
  'monthly_cap', 'alert_at', 'alert_to', 'capability_vocabulary',
  'task_protocol',
]);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test test/vocabulary.test.mjs`
Expected: FAIL — `VOCABULARY.task_protocol_on_runtime` é `undefined`, `ALIASES.protocolo_de_tarefa` é `undefined`.

- [ ] **Step 3: Implementar em `capabilities/v1.mjs`**

Dentro de `export const VOCABULARY = Object.freeze({ ... })`, depois de `context_kind`:

```js
  context_kind: Object.freeze(['repo_file', 'package_doc', 'url', 'path']),
  // TAREFA DE 2026-11-01: vocabulário fechado dos mecanismos que um status
  // de Delivery Report pode disparar no runtime. Não é verbo de
  // capabilities.read/write — é semântica de PROTOCOLO, por isso lista
  // própria, não item novo dentro de read/write.
  task_protocol_on_runtime: Object.freeze([
    'wake_blocked', 'create_followup_issue', 'wake_on_unblock',
    'notify_assignee_chain', 'escalate_to_role',
  ]),
```

Dentro de `export const ALIASES = Object.freeze({ ... })`, depois de `vocabulario_de_capacidades: 'capability_vocabulary',`:

```js
  protocolo_de_tarefa: 'task_protocol',
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test test/vocabulary.test.mjs`
Expected: PASS, todos os testes do arquivo.

- [ ] **Step 5: Documentar em `capabilities/v1.md`**

Na seção "## Memória e contexto", acrescentar linha à tabela existente:

```markdown
| `task_protocol.statuses[].on_runtime` | `wake_blocked`, `create_followup_issue`, `wake_on_unblock`, `notify_assignee_chain`, `escalate_to_role` |
```

- [ ] **Step 6: Commit**

```bash
git add capabilities/v1.mjs capabilities/v1.md test/vocabulary.test.mjs
git commit -m "feat(schema): vocabulário task_protocol_on_runtime e alias protocolo_de_tarefa"
```

---

### Task 2: Regra E21 — `protocolo-mapa-invalido`

**Files:**
- Modify: `tools/rules.mjs:578-608` (perto de `gatesDo`/`enumDe`, mesma vizinhança)
- Modify: `tools/rules.mjs:610-726` (`validateStructure`)
- Test: `test/rules-governanca.test.mjs`

**Interfaces:**
- Consumes: `VOCABULARY.task_protocol_on_runtime` (Task 1), `erro(code, rule, where, message)`, `isPlainObject(v)`, `listaDeTexto(v)` — já existentes em `rules.mjs`.
- Produces: `taskProtocolDe(pkg, slugs)` → `{ protocol: { statuses: [...], skill_ref? } | null, erros: [] }`. `protocol` é consumido pela Task 3 e pela Task 4.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `test/rules-governanca.test.mjs` (usa a função local `pacoteMinimo` já existente no arquivo; adaptada para aceitar `taskProtocol` no `company.frontmatter.metadata`):

```js
function pacoteComProtocolo(taskProtocol, { agentsExtra = [] } = {}) {
  return {
    slug: 'teste',
    company: {
      path: 'COMPANY.md',
      frontmatter: {
        slug: 'teste', license: 'MIT',
        metadata: { human_gates: [], task_protocol: taskProtocol },
      },
      body: '',
    },
    agents: [
      {
        path: 'agents/tech-lead/AGENTS.md', slug: 'tech-lead',
        frontmatter: {
          slug: 'tech-lead', reportsTo: null, skills: ['x'],
          metadata: {
            boundary: { can: ['ler'], cannot: [] }, capabilities: {},
            persona: { display_name: 'N', icon: '🧪' },
          },
        },
        body: '',
      },
      ...agentsExtra,
    ],
    skills: [], teams: [], tasks: [], warnings: [],
  };
}

const codigosEstrutura = (pkg) => validateStructure(pkg).map((e) => e.code);

test('E21: on_runtime fora do vocabulário fechado reprova', () => {
  const pkg = pacoteComProtocolo({
    statuses: [{ id: 'done', on_runtime: 'faz_magica' }],
  });
  assert.ok(codigosEstrutura(pkg).includes('E21'));
});

test('E21: escalate_to_role sem escalate_to reprova', () => {
  const pkg = pacoteComProtocolo({
    statuses: [{ id: 'failed', on_runtime: 'escalate_to_role' }],
  });
  assert.ok(codigosEstrutura(pkg).includes('E21'));
});

test('E21: escalate_to que não é papel do pacote reprova', () => {
  const pkg = pacoteComProtocolo({
    statuses: [{ id: 'failed', on_runtime: 'escalate_to_role', escalate_to: 'fantasma' }],
  });
  assert.ok(codigosEstrutura(pkg).includes('E21'));
});

test('E21: escalate_to que É papel do pacote passa', () => {
  const pkg = pacoteComProtocolo({
    statuses: [{ id: 'failed', on_runtime: 'escalate_to_role', escalate_to: 'tech-lead' }],
  });
  assert.ok(!codigosEstrutura(pkg).includes('E21'));
});

test('E21: statuses que não é lista reprova', () => {
  const pkg = pacoteComProtocolo({ statuses: 'oops' });
  assert.ok(codigosEstrutura(pkg).includes('E21'));
});

test('E21: entrada de statuses sem id reprova', () => {
  const pkg = pacoteComProtocolo({ statuses: [{ on_runtime: 'wake_blocked' }] });
  assert.ok(codigosEstrutura(pkg).includes('E21'));
});

test('sem task_protocol não reprova nada (opcional e aditivo)', () => {
  const pkg = pacoteComProtocolo(undefined);
  assert.ok(!codigosEstrutura(pkg).includes('E21'));
});

test('task_protocol com mapa de status válido passa limpo', () => {
  const pkg = pacoteComProtocolo({
    statuses: [
      { id: 'done', on_runtime: 'wake_blocked' },
      { id: 'partial', on_runtime: 'create_followup_issue' },
      { id: 'blocked', on_runtime: 'wake_on_unblock' },
      { id: 'needs_clarification', on_runtime: 'notify_assignee_chain' },
      { id: 'failed', on_runtime: 'escalate_to_role', escalate_to: 'tech-lead' },
    ],
  });
  assert.ok(!codigosEstrutura(pkg).includes('E21'));
});
```

No topo do arquivo, garantir o import de `validateStructure` (já importado na linha 3 do arquivo hoje: `import { validateStructure, validateGovernance, validatePackage } from '../tools/rules.mjs';`).

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `node --test test/rules-governanca.test.mjs`
Expected: FAIL em todos os `E21:` — `task_protocol` não produz erro nenhum ainda (a chave é ignorada pelo validador hoje).

- [ ] **Step 3: Implementar `taskProtocolDe` em `tools/rules.mjs`**

Inserir depois da função `gatesDo` (depois da linha que hoje termina em `return { gates, erros };` e antes de `function enumDe(verbo) {`):

```js
/**
 * Retorna { protocol, erros } — nunca lança. `protocol` é `null` quando o
 * pacote não declara `task_protocol` (opcional e aditivo, como human_gates).
 * Mesma forma de gatesDo: o defeito é NOMEADO (E21) e a entrada malformada
 * é descartada da lista usada a jusante (Task 3/4), em vez de poluí-la.
 */
function taskProtocolDe(pkg, slugs) {
  const raw = pkg.company.frontmatter?.metadata?.task_protocol;
  const erros = [];
  if (raw == null) return { protocol: null, erros };
  if (!isPlainObject(raw)) {
    erros.push(erro('E21', 'protocolo-mapa-invalido', 'COMPANY.md',
      `metadata.task_protocol deveria ser um objeto; veio ${typeof raw}`));
    return { protocol: null, erros };
  }
  const statusesRaw = raw.statuses;
  if (!Array.isArray(statusesRaw)) {
    erros.push(erro('E21', 'protocolo-mapa-invalido', 'COMPANY.md',
      `metadata.task_protocol.statuses deveria ser uma lista; veio ${typeof statusesRaw}`));
    return { protocol: { ...raw, statuses: [] }, erros };
  }
  const statuses = [];
  statusesRaw.forEach((s, i) => {
    if (!isPlainObject(s) || typeof s.id !== 'string' || s.id.length === 0) {
      erros.push(erro('E21', 'protocolo-mapa-invalido', 'COMPANY.md',
        `metadata.task_protocol.statuses[${i}] não é objeto com "id" válido: ${JSON.stringify(s)}`));
      return;
    }
    if (!VOCABULARY.task_protocol_on_runtime.includes(s.on_runtime)) {
      erros.push(erro('E21', 'protocolo-mapa-invalido', 'COMPANY.md',
        `statuses[${i}] ("${s.id}").on_runtime "${s.on_runtime}" fora do vocabulário. Permitidos: ${VOCABULARY.task_protocol_on_runtime.join(', ')}`));
      return;
    }
    if (s.on_runtime === 'escalate_to_role') {
      if (typeof s.escalate_to !== 'string' || s.escalate_to.length === 0) {
        erros.push(erro('E21', 'protocolo-mapa-invalido', 'COMPANY.md',
          `statuses[${i}] ("${s.id}") usa on_runtime "escalate_to_role" sem "escalate_to"`));
      } else if (!slugs.has(s.escalate_to)) {
        erros.push(erro('E21', 'protocolo-mapa-invalido', 'COMPANY.md',
          `statuses[${i}] ("${s.id}").escalate_to "${s.escalate_to}" não é papel deste pacote. Papéis: ${[...slugs].join(', ')}`));
      }
    }
    statuses.push(s);
  });
  return { protocol: { ...raw, statuses }, erros };
}
```

- [ ] **Step 4: Ligar em `validateStructure`**

Em `tools/rules.mjs`, a função `validateStructure` começa assim hoje:

```js
export function validateStructure(pkg) {
  const slugs = new Set(pkg.agents.map((a) => a.slug));
  const { gates, erros: gateErros } = gatesDo(pkg);
  const erros = [...gateErros];
  const gateIds = new Set(gates.map((g) => g.id));
```

Trocar as duas últimas linhas por:

```js
export function validateStructure(pkg) {
  const slugs = new Set(pkg.agents.map((a) => a.slug));
  const { gates, erros: gateErros } = gatesDo(pkg);
  const { protocol: taskProtocol, erros: protocoloErros } = taskProtocolDe(pkg, slugs);
  const erros = [...gateErros, ...protocoloErros];
  const gateIds = new Set(gates.map((g) => g.id));
```

(`taskProtocol` fica disponível no resto da função — é consumido pela Task 3, que insere código imediatamente depois, ainda dentro de `validateStructure`, antes do `return erros;` final.)

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `node --test test/rules-governanca.test.mjs`
Expected: PASS em todos os `E21:` e nos dois testes de controle (sem `task_protocol`, e com mapa válido).

- [ ] **Step 6: Commit**

```bash
git add tools/rules.mjs test/rules-governanca.test.mjs
git commit -m "feat(rules): E21 protocolo-mapa-invalido para metadata.task_protocol"
```

---

### Task 3: Regra E22 — `protocolo-skill-diverge`

**Files:**
- Modify: `tools/rules.mjs` (nova função auxiliar + bloco em `validateStructure`)
- Test: `test/rules-governanca.test.mjs`

**Interfaces:**
- Consumes: `taskProtocol` (objeto produzido pela Task 2 dentro de `validateStructure`), `pkg.skills` (array `{ slug, path, body }`, já carregado por `tools/schema.mjs`).
- Produces: nada consumido por tarefa posterior — regra terminal.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `test/rules-governanca.test.mjs`:

```js
function skill(slug, body) {
  return { slug, path: `skills/${slug}/SKILL.md`, frontmatter: { name: slug }, body };
}

test('E22: skill documenta status diferente do declarado', () => {
  const pkg = pacoteComProtocolo({
    skill_ref: 'task-envelope',
    statuses: [
      { id: 'done', on_runtime: 'wake_blocked' },
      { id: 'failed', on_runtime: 'escalate_to_role', escalate_to: 'tech-lead' },
    ],
  });
  pkg.skills = [skill('task-envelope', 'status: done | partial | blocked')];
  assert.ok(codigosEstrutura(pkg).includes('E22'));
});

test('E22: skill documenta exatamente o mesmo conjunto (ordem livre) passa', () => {
  const pkg = pacoteComProtocolo({
    skill_ref: 'task-envelope',
    statuses: [
      { id: 'done', on_runtime: 'wake_blocked' },
      { id: 'failed', on_runtime: 'escalate_to_role', escalate_to: 'tech-lead' },
    ],
  });
  pkg.skills = [skill('task-envelope', 'status: failed | done')];
  assert.ok(!codigosEstrutura(pkg).includes('E22'));
});

test('E22: skill sem linha "status:" não dispara nada (nada a comparar)', () => {
  const pkg = pacoteComProtocolo({
    skill_ref: 'task-envelope',
    statuses: [{ id: 'done', on_runtime: 'wake_blocked' }],
  });
  pkg.skills = [skill('task-envelope', 'nenhuma menção a status aqui')];
  assert.ok(!codigosEstrutura(pkg).includes('E22'));
});

test('E22: skill_ref que não corresponde a nenhuma skill do pacote não dispara nada', () => {
  const pkg = pacoteComProtocolo({
    skill_ref: 'task-envelope',
    statuses: [{ id: 'done', on_runtime: 'wake_blocked' }],
  });
  pkg.skills = [];
  assert.ok(!codigosEstrutura(pkg).includes('E22'));
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `node --test test/rules-governanca.test.mjs`
Expected: FAIL no primeiro teste (`E22` nunca é produzido ainda); os outros três já passam por vacuidade (ainda mais razão para tê-los — travam a ausência de falso positivo antes de a regra existir).

- [ ] **Step 3: Implementar**

Logo depois da função `taskProtocolDe` (Task 2), acrescentar:

```js
// Extrai o enum documentado numa linha "status: a | b | c" do corpo em
// prosa de uma skill. `null` quando a skill não documenta status nenhum —
// E22 não tem o que comparar, e isso não é defeito: skill sem domínio de
// protocolo nenhum não precisa mencionar status.
function statusEnumDoCorpoDaSkill(body) {
  const m = /^\s*status:\s*([a-z0-9_]+(?:\s*\|\s*[a-z0-9_]+)+)/im.exec(body ?? '');
  if (!m) return null;
  return m[1].split('|').map((s) => s.trim()).filter(Boolean);
}
```

Dentro de `validateStructure`, imediatamente antes do `return erros;` final da função (depois do laço de ciclo de delegação, Task 2 Step 4 já deixou `taskProtocol` disponível neste escopo):

```js
  // E22 — a skill que documenta o protocolo em prosa tem de concordar com
  // o que a empresa declarou em metadata.task_protocol.statuses. Mesma
  // família de E10 (prosa-contradiz-capacidade), fronteira diferente:
  // aqui as duas metades são "prosa da skill" e "enum declarado", não
  // "prosa do papel" e "capabilities".
  if (taskProtocol?.skill_ref) {
    const skillAlvo = pkg.skills.find((s) => s.slug === taskProtocol.skill_ref);
    if (skillAlvo) {
      const documentado = statusEnumDoCorpoDaSkill(skillAlvo.body);
      if (documentado) {
        const declarado = new Set(taskProtocol.statuses.map((s) => s.id));
        const lido = new Set(documentado);
        const divergem = declarado.size !== lido.size
          || [...declarado].some((id) => !lido.has(id));
        if (divergem) {
          erros.push(erro('E22', 'protocolo-skill-diverge', skillAlvo.path,
            `skill "${taskProtocol.skill_ref}" documenta status [${documentado.join(', ')}], e metadata.task_protocol.statuses (COMPANY.md) declara [${[...declarado].join(', ')}] — as duas metades do protocolo têm de concordar`));
        }
      }
    }
  }

  return erros;
}
```

(A linha `return erros;` que já existia no fim de `validateStructure` é substituída por este bloco seguido do mesmo `return erros;`.)

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `node --test test/rules-governanca.test.mjs`
Expected: PASS nos quatro testes de E22, e nenhuma regressão nos testes de E21/outros códigos do arquivo.

- [ ] **Step 5: Commit**

```bash
git add tools/rules.mjs test/rules-governanca.test.mjs
git commit -m "feat(rules): E22 protocolo-skill-diverge entre task_protocol e a skill que o documenta"
```

---

### Task 4: Aviso W06 — `protocolo-sem-skill`

**Files:**
- Modify: `tools/rules.mjs` (`validateWarnings`)
- Test: `test/rules-governanca.test.mjs`

**Interfaces:**
- Consumes: `pkg.company.frontmatter.metadata.task_protocol.skill_ref`, `pkg.agents[].frontmatter.skills`.
- Produces: nada consumido depois — aviso terminal.

- [ ] **Step 1: Escrever os testes que falham**

```js
const avisosDe = (pkg) => validateWarnings(pkg).map((w) => w.code);

test('W06: task_protocol com skill_ref que nenhum papel anexa', () => {
  const pkg = pacoteComProtocolo({
    skill_ref: 'task-envelope',
    statuses: [{ id: 'done', on_runtime: 'wake_blocked' }],
  });
  // nenhum agente de pacoteComProtocolo() tem "task-envelope" em skills (só "x")
  assert.ok(avisosDe(pkg).includes('W06'));
});

test('W06: não dispara quando algum papel anexa a skill', () => {
  const pkg = pacoteComProtocolo(
    { skill_ref: 'task-envelope', statuses: [{ id: 'done', on_runtime: 'wake_blocked' }] },
  );
  pkg.agents[0].frontmatter.skills = ['x', 'task-envelope'];
  assert.ok(!avisosDe(pkg).includes('W06'));
});

test('W06: não dispara quando task_protocol não declara skill_ref', () => {
  const pkg = pacoteComProtocolo({ statuses: [{ id: 'done', on_runtime: 'wake_blocked' }] });
  assert.ok(!avisosDe(pkg).includes('W06'));
});
```

Garantir `import { ..., validateWarnings } from '../tools/rules.mjs';` no topo do teste (hoje o arquivo importa só `validateStructure, validateGovernance, validatePackage` — acrescentar `validateWarnings`).

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test test/rules-governanca.test.mjs`
Expected: FAIL no primeiro teste (`W06` nunca é produzido ainda).

- [ ] **Step 3: Implementar em `validateWarnings`**

A função começa assim hoje:

```js
export function validateWarnings(pkg) {
  const avisos = [...(pkg.warnings ?? [])];
  for (const agente of pkg.agents) {
```

Logo depois da linha `const avisos = [...(pkg.warnings ?? [])];` e antes do `for`, inserir:

```js
  // W06 — protocolo declarado, skill de referência inexistente em todo
  // papel do pacote. Aviso, não erro: o protocolo pode ser consumido só
  // pela plataforma (ex. o Studio lendo metadata.task_protocol direto),
  // sem nenhum papel precisar ler a prosa da skill.
  const taskProtocolMeta = mapaOuVazio(pkg.company.frontmatter?.metadata?.task_protocol);
  if (taskProtocolMeta.skill_ref) {
    const anexada = pkg.agents.some((a) =>
      (a.frontmatter?.skills ?? []).includes(taskProtocolMeta.skill_ref));
    if (!anexada) {
      avisos.push({ code: 'W06', path: 'COMPANY.md',
        message: `metadata.task_protocol.skill_ref "${taskProtocolMeta.skill_ref}" declarado, e nenhum papel do pacote anexa essa skill em "skills:"` });
    }
  }
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `node --test test/rules-governanca.test.mjs`
Expected: PASS nos três testes de W06, zero regressão nos demais (W03/W04/W05) do mesmo arquivo.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `node --test test/`
Expected: PASS em todos os arquivos — este é o primeiro ponto de checagem cruzada (vocabulary, schema, rules-estruturais, rules-governanca, acervo, bindings, bindings-arquivos, catalog, emit, yaml-emit, normalize, pureza, validate-cli).

- [ ] **Step 6: Commit**

```bash
git add tools/rules.mjs test/rules-governanca.test.mjs
git commit -m "feat(rules): W06 protocolo-sem-skill quando nenhum papel anexa task_protocol.skill_ref"
```

---

### Task 5: Documentar em `SCHEMA.md`

**Files:**
- Modify: `SCHEMA.md`

**Interfaces:**
- Consumes: nada de código — este task é só documentação, mas o script de completude do catálogo (§"Verificação de completude do catálogo") compara `grep` de `tools/*.mjs` contra `grep` deste arquivo, então os códigos `E21`/`E22`/`W06` têm de aparecer aqui literalmente.

- [ ] **Step 1: Nova chave na tabela de "Chaves canônicas" (§2)**

Na tabela de sete chaves (linha `| human_gates | ... |`), acrescentar uma linha:

```markdown
| `task_protocol` | `COMPANY.md` | O enum de status de Delivery Report e o que cada status faz no runtime — ver §9 |
```

E atualizar o número "Sete chaves" no texto acima da tabela para "Oito chaves".

- [ ] **Step 2: Alias na tabela do alias pt-BR (§3)**

```markdown
| `protocolo_de_tarefa` | `task_protocol` |
```

- [ ] **Step 3: Três entradas novas no catálogo de erros/avisos (§7)**

Na tabela de erros (`E01`–`E20`), acrescentar duas linhas (o cabeçalho da tabela passa a ser "`E01`–`E22`" no título da subseção):

```markdown
| E21 | `protocolo-mapa-invalido` | `metadata.task_protocol.statuses` ausente de lista, entrada sem `id`, `on_runtime` fora do vocabulário fechado, ou `escalate_to_role` sem `escalate_to` nomeando papel do pacote | Status de Delivery Report sem mecanismo real por trás — a mesma segurança decorativa de E04, numa fronteira diferente |
| E22 | `protocolo-skill-diverge` | A skill referenciada por `metadata.task_protocol.skill_ref` documenta, em prosa, um conjunto de `status:` diferente do declarado em `statuses[].id` | Prosa e declaração discordam sobre o próprio protocolo — quem lê a skill confia num enum que a empresa não reconhece |
```

Na tabela de avisos (`W01`–`W05`, título passa a "`W01`–`W06`"):

```markdown
| W06 | `protocolo-sem-skill` | Pacote declara `task_protocol.skill_ref` e nenhum papel anexa essa skill em `skills:` | O protocolo existe só em `metadata`, sem nenhum papel instruído a seguir a prosa dele — ainda pode ser lido só pela plataforma |
```

- [ ] **Step 4: Nova seção §9 — o protocolo de entrega**

Acrescentar, depois da seção 8.3 (`human_gates[].triggers`) e antes da antiga numeração continuar (renumerar o que vier depois, se houver — hoje §8 é a última seção do arquivo, então esta é literalmente o final do arquivo):

```markdown
## 9. `task_protocol` — o enum de status do Delivery Report

Fecha, dentro do schema validável, a lacuna que o pacote de agentes do
cliente Jacto (`sdlc-ai-centric`) resolveu só em prosa: o status com que um
agente encerra uma tarefa (`done`/`partial`/`blocked`/
`needs_clarification`/`failed`, por exemplo) e o que cada status dispara no
runtime.

```yaml
metadata:
  task_protocol:
    version: 1
    skill_ref: task-envelope
    statuses:
      - id: done
        description: todos os critérios atendidos e verificados
        on_runtime: wake_blocked
      - id: failed
        description: esgotou budget.max_iterations
        on_runtime: escalate_to_role
        escalate_to: tech-lead
```

**Opcional e aditivo**, como `human_gates`: pacote sem `task_protocol`
continua válido.

`on_runtime` é vocabulário fechado (`capabilities/v1.mjs`,
`VOCABULARY.task_protocol_on_runtime`): `wake_blocked`,
`create_followup_issue`, `wake_on_unblock`, `notify_assignee_chain`,
`escalate_to_role`. `escalate_to_role` exige `escalate_to` nomeando um
papel do próprio pacote — `E21` reprova os dois jeitos de declarar isso
errado (mecanismo fora do vocabulário, ou escalonamento sem destino
resolvível).

**A skill continua escrita à mão.** `skill_ref` aponta para uma
`skills/<slug>/SKILL.md` que documenta o protocolo em prosa, do jeito que
um agente lê — mas `E22` cruza o enum que essa prosa documenta (linha
`status: a | b | c` no corpo) contra `statuses[].id`, para que a mesma
classe de defeito de `E10` (prosa e declaração discordando) não reapareça
numa fronteira nova.

### 9.1 Classificação nos bindings — por que `preserves`, não `translates`

O campo sobrevive byte a byte em `paperclip` e `portable` (`preserves`); em
`claude-code` e `opencode` não há onde emiti-lo hoje (`not_emitted`) — os
dois TÊM frontmatter de agente arbitrário, mas nenhum emissor gera nada a
partir de `task_protocol`. Nenhum dos quatro bindings classifica isto como
`translates`: isso exigiria medição de que o runtime-alvo LÊ o campo e AGE
sobre ele automaticamente — no caso do Paperclip, que a API de issues
resolve o próprio ciclo de vida a partir de `metadata.task_protocol`, não
que um agente LEIA o campo e chame a API manualmente. Essa medição não foi
feita; a célula entra com `inferido: true` até que seja.
```

- [ ] **Step 5: Rodar a verificação de completude do catálogo**

Run:
```bash
impl=$(grep -ohE "'[EWA][0-9]{2}'" tools/*.mjs | tr -d "'" | sort -u)
doc=$(grep -ohE "[EWA][0-9]{2}" SCHEMA.md | sort -u)
diff <(echo "$impl") <(echo "$doc") && echo "catalogo completo" || echo "DIVERGE"
```
Expected: `catalogo completo`.

- [ ] **Step 6: Commit**

```bash
git add SCHEMA.md
git commit -m "docs(schema): documentar metadata.task_protocol, E21/E22/W06 e a seção 9"
```

---

### Task 6: Linha `task_protocol` nos quatro `bindings/*.yml`

**Files:**
- Modify: `bindings/paperclip.yml`
- Modify: `bindings/portable.yml`
- Modify: `bindings/claude-code.yml`
- Modify: `bindings/opencode.yml`
- Test: já cobertas por `test/bindings-arquivos.test.mjs` (não precisa de teste novo — a regra central daquele arquivo é "todo binding cobre toda capacidade do ACERVO REAL"; `task_protocol` não é emitido por `capabilityKeys`, então essa regra central nem olha para ele — mas os testes "not_emitted exige mechanism e falta" e "todo binding declara runtime/emits/format/source" seguem rodando sobre o arquivo inteiro e vão falhar se a célula nova estiver malformada).

- [ ] **Step 1: `bindings/paperclip.yml` — `preserves`**

No bloco `preserves:` (hoje termina em `- budget` por volta da linha 47), acrescentar:

```yaml
  - task_protocol
```

E no bloco `citations:`, logo depois da entrada `budget: *extensao-de-fornecedor` (ou como entrada própria, se `task_protocol` não compartilhar a âncora `*extensao-de-fornecedor`):

```yaml
  task_protocol:
    inferido: true
    source: "nenhuma medição de que a API de issues do Paperclip lê metadata.task_protocol para resolver o próprio ciclo de vida — o campo sobrevive na cópia byte a byte (§5–§13 não o definem), mas quem AGE sobre o enum de status é o agente, chamando a API manualmente, não o runtime lendo o frontmatter"
```

- [ ] **Step 2: `bindings/portable.yml` — `preserves`**

Mesmo padrão: acrescentar `- task_protocol` ao bloco `preserves:` (hoje termina em `- budget`, linha ~54) e uma entrada em `citations.task_protocol` análoga, trocando a razão para "desenho próprio — nenhum runtime concreto por trás para agir" (mesmo texto que já existe para `budget` neste arquivo, adaptado).

- [ ] **Step 3: `bindings/claude-code.yml` — `not_emitted`**

No bloco `not_emitted:` (hoje tem `read.database` e `approve`), acrescentar:

```yaml
  task_protocol:
    mechanism: "frontmatter de sub-agente aceita chave arbitrária sob metadata — o dado tem onde ser copiado"
    falta: "nenhum emissor (tools/writers.mjs) gera nada a partir de metadata.task_protocol hoje; sem rastreador de issue no runtime, o status fica documentado, não automatizado"
```

E em `citations:`:

```yaml
  task_protocol:
    inferido: true
    source: "code.claude.com/docs/en/sub-agents não documenta rastreador de issue nenhum — not_emitted por ausência de mecanismo de ciclo de vida, não por ausência de campo de frontmatter"
```

- [ ] **Step 4: `bindings/opencode.yml` — `not_emitted`**

Mesmo padrão do Step 3, trocando a fonte para a ausência de conceito de issue em `ConfigAgent.Info` (mesma fonte já citada para `approve`/`read.database` neste arquivo).

- [ ] **Step 5: Rodar os testes de bindings**

Run: `node --test test/bindings.test.mjs test/bindings-arquivos.test.mjs`
Expected: PASS — nenhuma das quatro regras existentes (`runtime/emits/format/source` obrigatórios, `not_emitted` exige `mechanism`+`falta`, `portable` sem perda, `memory/context/skills` declarados) quebra com a célula nova, porque todas são aditivas.

- [ ] **Step 6: Rodar a suíte inteira de novo**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add bindings/*.yml
git commit -m "docs(bindings): classificar task_protocol nos quatro runtimes (preserves/not_emitted)"
```

---

### Task 7: `software-house` como primeiro adotante

**Files:**
- Modify: `software-house/COMPANY.md`
- Create: `software-house/skills/task-envelope/SKILL.md`
- Modify: `software-house/agents/*/AGENTS.md` (9 arquivos — acrescentar `task-envelope` a `skills:`)

**Interfaces:**
- Consumes: Tasks 1–6 (o validador já reconhece `task_protocol`, `E21`, `E22`, `W06`).
- Produces: nada — este é o task terminal, verificado pelo CLI do acervo.

- [ ] **Step 1: Declarar `metadata.task_protocol` em `software-house/COMPANY.md`**

No frontmatter de `software-house/COMPANY.md`, dentro do bloco `metadata:` já existente (que hoje tem `capability_vocabulary`, `budget`, `human_gates`), acrescentar, ao final:

```yaml
  task_protocol:
    version: 1
    skill_ref: task-envelope
    statuses:
      - id: done
        description: todos os critérios atendidos e verificados
        on_runtime: wake_blocked
      - id: partial
        description: parte entregue; o restante vira issue de follow-up
        on_runtime: create_followup_issue
      - id: blocked
        description: dependência externa não resolvida
        on_runtime: wake_on_unblock
      - id: needs_clarification
        description: requisito ambíguo
        on_runtime: notify_assignee_chain
      - id: failed
        description: esgotou budget.max_iterations
        on_runtime: escalate_to_role
        escalate_to: tech-lead
```

- [ ] **Step 2: Criar `software-house/skills/task-envelope/SKILL.md`**

```markdown
---
name: task-envelope
description: Contrato de entrada (Task Envelope) e saída (Delivery Report) entre papéis — use ao receber uma tarefa, ao delegar para outro papel, e antes de concluir qualquer tarefa
metadata:
  paperclip:
    tags:
      - governanca
      - entrega
---

# Task Envelope & Delivery Report

Todo trabalho chega como **Task Envelope** e sai como **Delivery Report**.
O `id` de cada status abaixo é o mesmo declarado em
`metadata.task_protocol.statuses` do `COMPANY.md` deste pacote — divergir
daqui reprova o pacote (`E22`).

## Entrada — Task Envelope

```yaml
task_id: "ENG-142"
assignee: "desenvolvimento-backend"
acceptance_criteria:
  - "Given payload válido, When POST /v1/pedidos, Then 201 + Location"
definition_of_done:
  - "Testes verdes"
  - "Critério de verificação (skill criterio-de-verificacao) atendido"
```

`acceptance_criteria` vazio ou ambíguo → não implementar; responder
`needs_clarification`.

## Saída — Delivery Report

```yaml
task_id: "ENG-142"
agent: "desenvolvimento-backend"
status: done | partial | blocked | needs_clarification | failed
verification:
  commands_run:
    - cmd: "npm test"
      result: pass
acceptance_criteria_status:
  - criterion: "Given payload válido ... Then 201"
    met: true
    evidence: "nome do teste que prova"
```

**Nunca** declarar `done` sem comando executado em
`verification.commands_run` — a mesma regra de "pronto é verificado" que
`criterio-de-verificacao` já exige antes de a tarefa entrar na fila.

## O que cada status faz

| Status | O que acontece |
|---|---|
| `done` | A plataforma acorda o que esta tarefa bloqueava |
| `partial` | Vira issue de follow-up para o restante |
| `blocked` | A plataforma acorda quando a dependência resolver |
| `needs_clarification` | Quem recebe a pergunta responde; nenhum trabalho novo começa |
| `failed` | Escala para `tech-lead` com o histórico das tentativas |
```

- [ ] **Step 3: Anexar `task-envelope` a `skills:` nos 9 papéis**

Em cada um dos nove arquivos `software-house/agents/<slug>/AGENTS.md`, acrescentar `- task-envelope` à lista `skills:` do frontmatter. Exemplo para `software-house/agents/tech-lead/AGENTS.md`, onde hoje é:

```yaml
skills:
  - criterio-de-verificacao
```

Passa a:

```yaml
skills:
  - criterio-de-verificacao
  - task-envelope
```

Repetir a mesma edição (acrescentar a linha `- task-envelope`, preservando o que já existe) em: `coordenacao`, `desenvolvimento`, `desenvolvimento-backend`, `desenvolvimento-frontend`, `desenvolvimento-fullstack`, `gate-qualidade`, `product-owner`, `revisao` (que já tem `revisao-adversarial` e `criterio-de-verificacao` — `task-envelope` entra como terceira linha).

- [ ] **Step 4: Validar o pacote**

Run: `node tools/validate.mjs --package software-house`
Expected: `0 erros, 0 avisos` — em particular, `W06` NÃO deve disparar (todo papel agora anexa `task-envelope`), e `E22` não deve disparar (o `status:` documentado na skill do Step 2 é exatamente `done | partial | blocked | needs_clarification | failed`, o mesmo conjunto de `statuses[].id` do Step 1).

- [ ] **Step 5: Validar o acervo inteiro**

Run: `node tools/validate.mjs`
Expected: `0 erros` nos 8 pacotes — os outros 7 não declaram `task_protocol`, então ficam exatamente como estavam (campo opcional e aditivo).

- [ ] **Step 6: Rodar a suíte inteira uma última vez**

Run: `node --test test/`
Expected: PASS em todos os arquivos.

- [ ] **Step 7: Commit**

```bash
git add software-house/COMPANY.md software-house/skills/task-envelope/SKILL.md software-house/agents/*/AGENTS.md
git commit -m "feat(software-house): adotar metadata.task_protocol e a skill task-envelope"
```

---

## Self-Review

**Cobertura do spec:** Decisão 1 (chave `metadata.task_protocol`) → Tasks 1, 2, 7. Decisão 2 (skill em prosa verificada contra a declaração) → Task 3, 7. Decisão 3 (duas regras + um aviso) → Tasks 2, 3, 4. Decisão 4 (linha nova nos bindings) → Task 6, com a correção de classificação registrada em Global Constraints (não é desvio silencioso — é a mesma exigência de citação que o repo já impõe em todo binding publicado). "O que isto não propõe" do spec (skills_hint, gerador de skill, migração dos 8 pacotes) — nenhuma task deste plano faz nenhuma das três; só `software-house` adota, como o spec previu.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo step carrega o código ou o comando exato.

**Consistência de tipos:** `taskProtocolDe(pkg, slugs)` devolve `{ protocol, erros }` nas Tasks 2–4, consumido sempre pela mesma forma (`protocol.statuses[].id`, `protocol.skill_ref`) — sem nome divergente entre tasks.
