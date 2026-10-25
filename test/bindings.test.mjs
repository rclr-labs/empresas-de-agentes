import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyBinding, capabilityKeys } from '../tools/bindings.mjs';

const BINDING = {
  runtime: 'teste',
  emits: 'agents/<slug>.md',
  format: 'claude-code',
  map: {
    'read.repository': ['Read', 'Grep', 'Glob'],
    'read.web': ['WebFetch'],
    'write.code': ['Write', 'Edit'],
    'execute.allow': ['Bash'],
    network: ['WebFetch'],
    delegate: 'Agent({slug})',
  },
  unsupported: ['read.database', 'budget', 'execute.deny', 'network.allowlist'],
  unsupported_metadata: ['memory', 'context', 'skills'],
};

function agente(capabilities, slug = 'a', extra = {}) {
  return {
    slug, path: `agents/${slug}/AGENTS.md`, body: '\n# A\n',
    frontmatter: {
      name: 'A', title: 'Título A', slug, reportsTo: null, skills: extra.skills ?? [],
      metadata: {
        persona: { display_name: 'N', icon: '🧪', headline: 'Faz A' },
        boundary: { can: ['ler'], cannot: [] },
        capabilities,
        memory: extra.memory,
        context: extra.context,
      },
    },
  };
}

const PKG = { slug: 'p', company: { frontmatter: { metadata: {} } }, agents: [] };

test('capabilityKeys achata as capacidades em chaves endereçáveis', () => {
  const chaves = capabilityKeys(agente({
    read: ['repository', 'web'],
    write: ['code'],
    execute: { allow: ['npm *'], deny: ['sudo *'] },
    delegate: ['x'],
    budget: { monthly_cap: 1 },
    network: false,
    approve: [],
  }));
  assert.ok(chaves.includes('read.repository'));
  assert.ok(chaves.includes('read.web'));
  assert.ok(chaves.includes('write.code'));
  assert.ok(chaves.includes('execute.allow'));
  assert.ok(chaves.includes('execute.deny'));
  assert.ok(chaves.includes('delegate'));
  assert.ok(chaves.includes('budget'));
  assert.ok(!chaves.includes('network'), 'network: false não declara capacidade');
  assert.ok(!chaves.includes('approve'), 'approve vazio não declara capacidade');
  assert.ok(!chaves.some((k) => k.startsWith('memory')),
    'memory não declarado nesta fixture não produz chave');
});

test('skills, memory e context SÃO endereçáveis quando declarados — a lacuna que deixou "skills" sem casa', () => {
  const chaves = capabilityKeys(agente({}, 'a', {
    skills: ['evidencia-replayavel'],
    memory: { scope: 'session', retention: 'session', writes: [] },
    context: { sources: [] },
  }));
  assert.ok(chaves.includes('skills'), 'skills vira chave endereçável pelo binding');
  assert.ok(chaves.includes('memory'));
  assert.ok(chaves.includes('context'));
});

test('skills vazio, memory e context ausentes não declaram chave', () => {
  const chaves = capabilityKeys(agente({}));
  assert.ok(!chaves.some((k) => ['skills', 'memory', 'context'].includes(k)));
});

test('network com lista de domínio declara DUAS chaves: alcance e allowlist', () => {
  const chaves = capabilityKeys(agente({ network: ['staging.cliente.com.br'] }));
  assert.ok(chaves.includes('network'), 'o alcance');
  assert.ok(chaves.includes('network.allowlist'), 'e a lista, separada');
});

test('network: true declara alcance e NÃO declara allowlist', () => {
  const chaves = capabilityKeys(agente({ network: true }));
  assert.ok(chaves.includes('network'));
  assert.ok(!chaves.includes('network.allowlist'), 'não há lista a perder');
});

test('network: false não declara nenhuma das duas', () => {
  const chaves = capabilityKeys(agente({ network: false }));
  assert.ok(!chaves.some((k) => k.startsWith('network')));
});

test('traduz read.repository para as três ferramentas do runtime', () => {
  const { tools } = applyBinding(agente({ read: ['repository'] }), BINDING, PKG);
  assert.deepEqual(tools, ['Read', 'Grep', 'Glob']);
});

test('não duplica ferramenta quando duas capacidades mapeiam para a mesma', () => {
  const { tools } = applyBinding(
    agente({ read: ['repository'], write: ['code'] }), BINDING, PKG);
  assert.deepEqual(tools, ['Read', 'Grep', 'Glob', 'Write', 'Edit']);
  assert.equal(new Set(tools).size, tools.length, 'sem duplicata');
});

test('delegate usa o template com {slug} substituído, um por alvo', () => {
  const { tools } = applyBinding(agente({ delegate: ['x', 'y'] }), BINDING, PKG);
  assert.ok(tools.includes('Agent(x)'));
  assert.ok(tools.includes('Agent(y)'));
});

test('capacidade em unsupported entra em lost, com o motivo', () => {
  const { lost } = applyBinding(agente({ read: ['database'] }), BINDING, PKG);
  const perda = lost.find((l) => l.capability === 'read.database');
  assert.ok(perda, 'perda registrada');
  // Regex apertada de propósito: a mensagem de "não declarada" (binding
  // incompleto) também contém a palavra "unsupported" dentro da frase
  // "nem unsupported para" — um regex /unsupported/i sozinho combina as
  // duas e não pega a mutação que colapsa o branch de unsupported no de
  // não-declarada. Exigir a frase inteira distingue os dois motivos.
  assert.match(perda.reason, /declarado em unsupported/i);
  assert.ok(!/n[ãa]o declarada/i.test(perda.reason),
    'motivo de unsupported não pode ser confundido com motivo de binding incompleto');
});

test('execute.deny perdido é registrado — é a perda que mais importa', () => {
  const { lost } = applyBinding(
    agente({ execute: { allow: ['npm *'], deny: ['sudo *'] } }), BINDING, PKG);
  const perda = lost.find((l) => l.capability === 'execute.deny');
  assert.ok(perda, 'deny perdido é registrado');
  assert.deepEqual(perda.value, ['sudo *']);
});

test('A PERDA QUE MAIS IMPORTA: allowlist de dominio nao pode sumir calada', () => {
  // Binding que mapeia "network" mas nao declara "network.allowlist":
  // sem a chave separada, a emissao trocaria "so este dominio" por
  // "a internet inteira" sem avisar ninguem.
  const { tools, lost } = applyBinding(
    agente({ network: ['staging.cliente.com.br'] }), BINDING, PKG);
  assert.ok(tools.includes('WebFetch'), 'o alcance foi traduzido');
  const perda = lost.find((l) => l.capability === 'network.allowlist');
  assert.ok(perda, 'a allowlist nao pode ser descartada em silencio');
  assert.deepEqual(perda.value, ['staging.cliente.com.br']);
});

test('capacidade sem mapa e sem unsupported é perda não declarada — erro do binding', () => {
  const { lost } = applyBinding(agente({ write: ['report'] }), BINDING, PKG);
  const perda = lost.find((l) => l.capability === 'write.report');
  assert.ok(perda);
  assert.match(perda.reason, /n[ãa]o declarada/i,
    'binding incompleto é defeito do binding, não silêncio');
});

test('não muta o agente nem o binding', () => {
  const ag = agente({ read: ['repository'] });
  const copia = structuredClone(ag);
  const bind = structuredClone(BINDING);
  applyBinding(ag, BINDING, PKG);
  assert.deepEqual(ag, copia);
  assert.deepEqual(BINDING, bind);
});

test('o módulo é puro — nenhum import de node', async () => {
  const src = await import('node:fs').then(({ readFileSync }) =>
    readFileSync(new URL('../tools/bindings.mjs', import.meta.url), 'utf8'));
  assert.ok(!/from ['"]node:/.test(src), 'bindings.mjs não importa node:*');
});

// --- Task 27: três estados, rule_order, allowlist_scope ---------------

test('binding com tres estados separa traduzido, preservado e perdido', () => {
  const b = {
    runtime: 'teste', emits: 'x', format: 'claude-code', rule_order: 'first-match',
    allowlist_scope: 'os',
    translates: { 'read.repository': ['Read', 'Grep', 'Glob'] },
    preserves: ['budget'],
    loses: ['read.database'],
  };
  const { tools, translated, preserved, lost } = applyBinding(
    agente({ read: ['repository', 'database'], budget: { currency: 'BRL', monthly_cap: 1 } }), b, PKG);
  assert.deepEqual(tools, ['Read', 'Grep', 'Glob']);
  assert.ok(translated.includes('read.repository'));
  assert.deepEqual(preserved.map((p) => p.capability), ['budget']);
  assert.deepEqual(lost.map((l) => l.capability), ['read.database']);
});

test('preservado NAO conta como perda, e perdido NAO conta como preservado', () => {
  const b = { runtime: 't', emits: 'x', format: 'claude-code', translates: {}, preserves: ['budget'], loses: [] };
  const { preserved, lost } = applyBinding(agente({ budget: { monthly_cap: 1 } }), b, PKG);
  assert.equal(lost.length, 0, 'preservar nao e perder');
  assert.match(preserved[0].reason, /n[ãa]o age|preserv/i);
});

test('capacidade fora dos tres estados e defeito do binding, nao silencio', () => {
  const b = { runtime: 't', emits: 'x', format: 'claude-code', translates: {}, preserves: [], loses: [] };
  const { lost } = applyBinding(agente({ read: ['repository'] }), b, PKG);
  assert.match(lost[0].reason, /n[ãa]o declarada/i);
});

test('allowlist_scope fetch-only avisa quando o papel tem shell cru', () => {
  // Medido: no OpenCode V2 a allowlist governa so webfetch; no janus com
  // provider kind=cli e ignorada. Com curl liberado, a lista e decoracao.
  const b = { runtime: 't', emits: 'x', format: 'opencode', allowlist_scope: 'fetch-only',
    translates: { 'network.allowlist': [], 'execute.allow': [] }, preserves: [], loses: [] };
  const { warnings } = applyBinding(
    agente({ network: ['host.exemplo'], execute: { allow: ['curl -s*'], deny: [] } }), b, PKG);
  const w = warnings.find((x) => /allowlist/i.test(x.message));
  assert.ok(w, 'tem de avisar que a allowlist e nula com shell cru');
  assert.match(w.message, /curl/);
});

test('allowlist_scope os NAO avisa, porque o SO cobre o shell', () => {
  const b = { runtime: 't', emits: 'x', format: 'claude-code', allowlist_scope: 'os',
    translates: { 'network.allowlist': [], 'execute.allow': ['Bash'] }, preserves: [], loses: [] };
  const { warnings } = applyBinding(
    agente({ network: ['host.exemplo'], execute: { allow: ['curl -s*'], deny: [] } }), b, PKG);
  assert.ok(!warnings.some((x) => /allowlist/i.test(x.message)));
});

test('rule_order e obrigatorio quando o binding emite lista de regra', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const yaml = (await import('js-yaml')).default;
  const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'bindings');
  const carregar = (f) => yaml.load(readFileSync(join(DIR, f), 'utf8'), { schema: yaml.CORE_SCHEMA });
  for (const f of ['claude-code.yml', 'opencode.yml']) {
    const b = carregar(f);
    assert.ok(['first-match', 'last-match'].includes(b.rule_order),
      `${f} tem de declarar rule_order — o OpenCode V2 avalia ultima-regra-vence, e emitir lista pensada para primeira-vence inverte a fronteira em silencio`);
  }
});

test('alias map/unsupported antigo ainda carrega — formato de terceiro continua funcionando', () => {
  const { tools, lost } = applyBinding(agente({ read: ['repository'] }), BINDING, PKG);
  assert.deepEqual(tools, ['Read', 'Grep', 'Glob']);
  assert.deepEqual(lost, []);
});
