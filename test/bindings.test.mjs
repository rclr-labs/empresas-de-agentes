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
};

function agente(capabilities, slug = 'a') {
  return {
    slug, path: `agents/${slug}/AGENTS.md`, body: '\n# A\n',
    frontmatter: {
      name: 'A', title: 'Título A', slug, reportsTo: null, skills: [],
      metadata: {
        persona: { display_name: 'N', icon: '🧪', headline: 'Faz A' },
        boundary: { can: ['ler'], cannot: [] },
        capabilities,
      },
    },
  };
}

const PKG = { slug: 'p', company: { frontmatter: { metadata: {} } }, agents: [] };

test('capabilityKeys achata as capacidades em chaves endereçáveis', () => {
  const chaves = capabilityKeys({
    read: ['repository', 'web'],
    write: ['code'],
    execute: { allow: ['npm *'], deny: ['sudo *'] },
    delegate: ['x'],
    budget: { monthly_cap: 1 },
    network: false,
    approve: [],
  });
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
    'memory vive em metadata.memory, fora de capabilities — não é capacidade mapeável');
});

test('network com lista de domínio declara DUAS chaves: alcance e allowlist', () => {
  const chaves = capabilityKeys({ network: ['staging.cliente.com.br'] });
  assert.ok(chaves.includes('network'), 'o alcance');
  assert.ok(chaves.includes('network.allowlist'), 'e a lista, separada');
});

test('network: true declara alcance e NÃO declara allowlist', () => {
  const chaves = capabilityKeys({ network: true });
  assert.ok(chaves.includes('network'));
  assert.ok(!chaves.includes('network.allowlist'), 'não há lista a perder');
});

test('network: false não declara nenhuma das duas', () => {
  const chaves = capabilityKeys({ network: false });
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
