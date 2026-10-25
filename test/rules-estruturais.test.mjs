import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStructure } from '../tools/rules.mjs';

// Construtor de pacote em memória — o módulo é puro, então o teste
// não precisa de disco. Cada teste altera só o que a regra observa.
function pacote({ license = 'MIT', gates = [], agents = [] } = {}) {
  return {
    slug: 'teste',
    company: {
      path: 'COMPANY.md',
      frontmatter: { slug: 'teste', license, metadata: { human_gates: gates } },
      body: '',
    },
    agents: agents.map((a) => ({
      path: `agents/${a.slug}/AGENTS.md`,
      slug: a.slug,
      frontmatter: {
        slug: a.slug,
        reportsTo: a.reportsTo ?? null,
        metadata: {
          boundary: a.boundary ?? { can: ['ler'], cannot: [] },
          capabilities: a.capabilities ?? {},
        },
      },
      body: '',
    })),
    skills: [], teams: [], tasks: [], warnings: [],
  };
}

const codigos = (pkg) => validateStructure(pkg).map((e) => e.code);

test('E01: pacote sem license falha', () => {
  const pkg = pacote();
  pkg.company.frontmatter.license = undefined;
  assert.ok(codigos(pkg).includes('E01'));
});

test('E01: pacote com license passa', () => {
  assert.ok(!codigos(pacote()).includes('E01'));
});

test('E02: valor de read fora do vocabulário falha', () => {
  const erros = validateStructure(pacote({
    agents: [{ slug: 'a', capabilities: { read: ['filesystem'] } }],
  }));
  const e = erros.find((x) => x.code === 'E02');
  assert.ok(e, 'E02 emitido');
  assert.match(e.message, /filesystem/);
  assert.match(e.message, /read/);
});

test('E02: valor de read dentro do vocabulário passa', () => {
  assert.ok(!codigos(pacote({
    agents: [{ slug: 'a', capabilities: { read: ['repository'] } }],
  })).includes('E02'));
});

test('E02: memory.scope fora do vocabulário falha', () => {
  const pkg = pacote({ agents: [{ slug: 'a' }] });
  pkg.agents[0].frontmatter.metadata.memory = { scope: 'galaxia' };
  assert.ok(validateStructure(pkg).some((e) => e.code === 'E02'));
});

test('E03: delegate para slug inexistente falha, nomeando o slug', () => {
  const erros = validateStructure(pacote({
    agents: [{ slug: 'gerente', capabilities: { delegate: ['fantasma'] } }],
  }));
  const e = erros.find((x) => x.code === 'E03');
  assert.ok(e);
  assert.match(e.message, /fantasma/);
  assert.equal(e.where, 'agents/gerente/AGENTS.md');
});

test('E03: delegate para slug existente passa', () => {
  assert.ok(!codigos(pacote({
    agents: [
      { slug: 'gerente', capabilities: { delegate: ['peao'] } },
      { slug: 'peao' },
    ],
  })).includes('E03'));
});

test('E04: approve para gate inexistente falha', () => {
  const erros = validateStructure(pacote({
    gates: [{ id: 'deploy', description: 'd', signer: 's' }],
    agents: [{ slug: 'a', capabilities: { approve: ['inexistente'] } }],
  }));
  assert.ok(erros.some((e) => e.code === 'E04'));
});

test('E04: approve para gate existente passa', () => {
  assert.ok(!codigos(pacote({
    gates: [{ id: 'deploy', description: 'd', signer: 's' }],
    agents: [{ slug: 'a', capabilities: { approve: ['deploy'] } }],
  })).includes('E04'));
});

test('E05: reportsTo para slug inexistente falha', () => {
  assert.ok(codigos(pacote({
    agents: [{ slug: 'a', reportsTo: 'ninguem' }],
  })).includes('E05'));
});

test('E05: reportsTo null é raiz válida', () => {
  assert.ok(!codigos(pacote({ agents: [{ slug: 'a', reportsTo: null }] })).includes('E05'));
});

test('E05: ciclo de delegação falha, nomeando o caminho', () => {
  const erros = validateStructure(pacote({
    agents: [
      { slug: 'a', reportsTo: 'b' },
      { slug: 'b', reportsTo: 'a' },
    ],
  }));
  const e = erros.find((x) => x.code === 'E05' && /ciclo/i.test(x.message));
  assert.ok(e, 'ciclo detectado');
  assert.match(e.message, /a/);
  assert.match(e.message, /b/);
});

test('E05: autociclo falha', () => {
  assert.ok(codigos(pacote({
    agents: [{ slug: 'a', reportsTo: 'a' }],
  })).includes('E05'));
});

test('cadeia longa sem ciclo passa', () => {
  assert.ok(!codigos(pacote({
    agents: [
      { slug: 'a', reportsTo: null },
      { slug: 'b', reportsTo: 'a' },
      { slug: 'c', reportsTo: 'b' },
    ],
  })).includes('E05'));
});
