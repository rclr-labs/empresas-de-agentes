import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAcervo } from '../tools/rules.mjs';

function papel(slug, display_name, icon) {
  return { path: `${slug}/AGENTS.md`, slug, body: '', frontmatter: {
    metadata: { persona: { display_name, icon } } } };
}

test('A01: ícone repetido entre pacotes é erro', () => {
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Caio Moraes', '💡')] },
  ]).errors;
  assert.equal(erros.length, 1);
  assert.equal(erros[0].code, 'A01');
  assert.match(erros[0].message, /💡/);
  assert.match(erros[0].message, /um\/a/);
  assert.match(erros[0].message, /dois\/b/);
});

test('A01: sobrenome repetido entre pacotes é erro', () => {
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Caio Vieira', '⚙️')] },
  ]).errors;
  assert.equal(erros.length, 1);
  assert.match(erros[0].message, /Vieira/);
});

test('A01: display_name repetido entre pacotes é erro', () => {
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Ana Vieira', '⚙️')] },
  ]).errors;
  // "Ana Vieira" repetido dispara display_name E sobrenome — dois A01, não
  // um só mascarando o outro.
  assert.equal(erros.length, 2);
  assert.ok(erros.every((e) => e.code === 'A01'));
});

test('A01: acervo sem colisão passa', () => {
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Caio Moraes', '⚙️')] },
  ]).errors, []);
});

// Furo 3 — a cicatriz de 2026-10-24: dois papéis sem ícone colidiam porque
// undefined === undefined, e o teste acusava REPETIÇÃO onde havia
// AUSÊNCIA. Ausência é W03 (regra por pacote), nunca A01.
test('A01: persona ausente não gera colisão de undefined', () => {
  const sem = { path: 'c/AGENTS.md', slug: 'c', body: '', frontmatter: { metadata: {} } };
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [sem] }, { slug: 'dois', agents: [sem] },
  ]).errors, []);
});

// Furo 3, variante: persona existe mas o CAMPO individual (ícone) está
// ausente — mesmo risco de undefined === undefined, por um caminho
// diferente do teste acima (ali a persona inteira falta; aqui só o campo).
test('A01: ícone ausente (persona presente, campo faltando) não colide', () => {
  const semIcone = (slug, nome) => papel(slug, nome, undefined);
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [semIcone('a', 'Ana Vieira')] },
    { slug: 'dois', agents: [semIcone('b', 'Caio Moraes')] },
  ]).errors, []);
});

// Furo 4 — colisão DENTRO do mesmo pacote também tem de ser pega; a
// unicidade é do acervo inteiro, não "entre pacotes distintos" como a
// primeira leitura do nome sugeriria.
test('A01: ícone repetido no MESMO pacote é erro', () => {
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡'), papel('b', 'Caio Moraes', '💡')] },
  ]).errors;
  assert.equal(erros.length, 1);
  assert.match(erros[0].message, /um\/a/);
  assert.match(erros[0].message, /um\/b/);
});

// Furo 1 — lista vazia não pode devolver "zero colisão" com cara de
// aprovação: zero pacotes não é um acervo limpo, é carregamento
// incompleto. A função recusa (lança) em vez de certificar em silêncio.
test('A01: lista vazia é recusada, não aprovada em silêncio', () => {
  assert.throws(() => validateAcervo([]), /vazia/);
});

// Furo 2 — chamada com um pacote só é aceita e verifica exatamente o que
// foi passado (aqui, nada — não há com o que colidir dentro de um agente
// só), sem fingir ter visto o resto do acervo.
test('A01: um pacote só, sem colisão interna, passa', () => {
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
  ]).errors, []);
});
