import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStructure, validatePackage } from '../tools/rules.mjs';

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

// Espelho do `pacoteMinimo` de test/rules-governanca.test.mjs — um agente
// só, com `capabilities` controlável. Os testes de E19 precisam só disso:
// nenhuma hierarquia, orçamento ou gate entra na checagem de tipo.
function pacoteMinimo({ capabilities = {} } = {}) {
  return {
    slug: 'teste',
    company: {
      path: 'COMPANY.md',
      frontmatter: { slug: 'teste', license: 'MIT', metadata: { human_gates: [] } },
      body: '',
    },
    agents: [{
      path: 'agents/a/AGENTS.md',
      slug: 'a',
      frontmatter: {
        slug: 'a', reportsTo: null, skills: ['x'],
        metadata: {
          boundary: { can: ['ler'], cannot: [] },
          capabilities,
          persona: { display_name: 'N', icon: '🧪' },
        },
      },
      body: '',
    }],
    skills: [], teams: [], tasks: [], projects: [], warnings: [], problems: [],
  };
}

// --- O CONTAINER de capabilities: validar a forma de um nó antes de
// descer nele (Critical da revisão ampla, 2026-10-27).
//
// Medido ponta a ponta pelo revisor numa cópia do acervo: um papel real com
// `capabilities: "oops"` saía `0 erro, 0 aviso` no portão, e o artefato
// emitido saía com `tools: ""` e os 18 padrões de deny do hook
// DESAPARECIDOS. A causa era `const cap = meta.capabilities ?? {}`: com
// escalar, `cap` ERA o escalar, e as cinco sondas de
// `verificarTiposDeCapacidade` leem `cap.read`/`cap.network`/`cap.execute`
// como `undefined` e fazem `continue`. Não é escalada de privilégio
// (`tools: ""` não concede nada) — é o PORTÃO CERTIFICANDO LIMPO sobre um
// papel cuja metade legível por máquina da fronteira foi descartada, e a
// fronteira é o produto deste acervo.
test('E19: container de capabilities com tipo errado dá UM erro nomeando o container — e o pacote NÃO sai limpo', () => {
  for (const forma of ['oops', [1, 2, 3], 42, null, true]) {
    const pkg = pacoteMinimo({ capabilities: forma });
    const { errors } = validatePackage(pkg);          // não pode lançar
    const e19 = errors.filter((e) => e.code === 'E19');
    assert.equal(e19.length, 1,
      `capabilities: ${JSON.stringify(forma)} deu ${e19.length} E19, esperado exatamente 1`);
    assert.match(e19[0].message, /metadata\.capabilities deveria ser um objeto/);
    assert.match(e19[0].message, /Declare capabilities como objeto/);
    // A asserção que o Critical pedia: o veredito do pacote não pode ser
    // "ok". Um E19 que existisse na lista sem reprovar o pacote repetiria
    // o defeito numa camada acima.
    assert.ok(errors.length > 0,
      `capabilities: ${JSON.stringify(forma)} passou limpo no veredito do pacote`);
  }
});

test('E19: capabilities AUSENTE não é E19 — ausência é outro caso, e quem cobra fronteira é E06', () => {
  const pkg = pacoteMinimo();
  delete pkg.agents[0].frontmatter.metadata.capabilities;
  const { errors } = validatePackage(pkg);
  assert.deepEqual(errors.filter((e) => e.code === 'E19'), [],
    'ausência de capabilities virou erro de TIPO; ausência e malformação têm de seguir distinguíveis');
});

test('E19: capabilities como objeto vazio segue sem E19 — é declaração mínima, não malformação', () => {
  const { errors } = validatePackage(pacoteMinimo({ capabilities: {} }));
  assert.deepEqual(errors.filter((e) => e.code === 'E19'), []);
});

test('E19: allow com item que não é string não derruba o validador', () => {
  const pkg = pacoteMinimo({ capabilities: { read: ['repository'], write: ['report'],
    execute: { allow: [123], deny: ['sudo *'] }, network: false } });
  const { errors } = validatePackage(pkg);          // não pode lançar
  const e19 = errors.filter((e) => e.code === 'E19');
  assert.equal(e19.length, 1);
  assert.match(e19[0].message, /execute\.allow/);
});

test('E19: allow como string em vez de lista é erro nomeado', () => {
  const pkg = pacoteMinimo({ capabilities: { read: ['repository'], write: ['report'],
    execute: { allow: 'git push*', deny: ['sudo *'] }, network: false } });
  const { errors } = validatePackage(pkg);
  assert.equal(errors.filter((e) => e.code === 'E19').length, 1);
});

test('E19: write como número é erro nomeado', () => {
  const pkg = pacoteMinimo({ capabilities: { read: ['repository'], write: 42,
    execute: { allow: ['rg *'], deny: ['sudo *'] }, network: false } });
  assert.equal(validatePackage(pkg).errors.filter((e) => e.code === 'E19').length, 1);
});

test('E19: write como string não produz enxurrada de E02', () => {
  const pkg = pacoteMinimo({ capabilities: { read: ['repository'], write: 'pull_request',
    execute: { allow: ['rg *'], deny: ['sudo *'] }, network: false } });
  const { errors } = validatePackage(pkg);
  assert.equal(errors.filter((e) => e.code === 'E19').length, 1);
  assert.ok(errors.filter((e) => e.code === 'E02').length <= 1,
    `tipo errado deve dar UM erro de tipo, não um E02 por caractere: ${errors.filter((e) => e.code === 'E02').length}`);
});

// `network: true` é forma válida, não erro de tipo — achado ao rodar o
// portão real: operacao-de-conhecimento/agents/pesquisa/AGENTS.md usa
// `network: true` (rede sem allowlist de domínio) com `curl -s*` em
// execute.allow, e `temRede` (tools/rules.mjs) já trata essa forma como
// alcance declarado. Sem este teste, um futuro "simplificar para false ou
// lista" (a leitura literal do brief desta tarefa) reprova esse papel real
// outra vez.
test('E19: network como "true" (rede sem allowlist) não é erro de tipo', () => {
  const pkg = pacoteMinimo({ capabilities: { read: ['repository', 'web'], write: ['report'],
    execute: { allow: ['curl -s*'], deny: ['sudo *'] }, network: true } });
  const { errors } = validatePackage(pkg);
  assert.equal(errors.filter((e) => e.code === 'E19').length, 0);
});

test('E19: nenhuma forma de tipo errado lança', () => {
  for (const caps of [
    { read: 'repository', write: ['report'], execute: { allow: ['rg *'] }, network: false },
    { read: ['repository'], write: ['report'], execute: 'rg *', network: false },
    { read: ['repository'], write: ['report'], execute: { allow: ['rg *'], deny: 7 }, network: false },
    { read: ['repository'], write: ['report'], execute: { allow: [null] }, network: false },
  ]) {
    assert.doesNotThrow(() => validatePackage(pacoteMinimo({ capabilities: caps })));
  }
});

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

// Gate malformado (sem "id") não pode poluir o Set de ids com `undefined`
// e produzir, a jusante, um E04 que mente sobre a causa — "portão não
// existe" quando o problema real é a declaração do portão. A regra deve
// nomear o defeito como E13 e NÃO emitir E04 para este caso, já que o
// "approve" não referencia o gate malformado (que não tem id nenhum).
test('E13: gate sem "id" é malformado, nomeado, e não poluiu o Set com undefined', () => {
  const erros = validateStructure(pacote({
    gates: [{ description: 'portão sem id' }],
    agents: [{ slug: 'a', capabilities: { approve: ['deploy'] } }],
  }));
  assert.ok(erros.some((e) => e.code === 'E13'), 'gate malformado é nomeado');
  const e04 = erros.filter((e) => e.code === 'E04');
  assert.equal(e04.length, 1, 'approve a "deploy" ainda falha, mas por gate inexistente, não por poluição');
  assert.doesNotMatch(e04[0].message, /undefined/, 'a mensagem de E04 não cita "undefined" como portão existente');
});

test('E13: human_gates que não é lista falha nomeando o tipo recebido', () => {
  const pkg = pacote({ agents: [{ slug: 'a' }] });
  pkg.company.frontmatter.metadata.human_gates = 'não é uma lista';
  const erros = validateStructure(pkg);
  assert.ok(erros.some((e) => e.code === 'E13' && /string/.test(e.message)));
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
