import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseMarkdown, loadPackage } from '../tools/schema.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(aqui, 'fixtures', 'pacote-minimo');

test('parseMarkdown separa frontmatter de corpo', () => {
  const { frontmatter, body } = parseMarkdown('---\nname: X\n---\n\n# Título\n');
  assert.equal(frontmatter.name, 'X');
  assert.equal(body.trim(), '# Título');
});

test('parseMarkdown falha com mensagem útil quando não há frontmatter', () => {
  assert.throws(() => parseMarkdown('# Só corpo\n'), /frontmatter/);
});

test('parseMarkdown recusa tag YAML customizada — pacote de terceiro é não confiável', () => {
  // Sem CORE_SCHEMA este teste passa e o parser aceita a tag. Com
  // CORE_SCHEMA ele lança. É esta a diferença que o teste protege.
  assert.throws(
    () => parseMarkdown('---\nname: !!js/function "function(){return 1}"\n---\n\ncorpo\n'),
    /unknown tag|YAMLException/i,
  );
});

test('parseMarkdown recusa timestamp implícito — fora do CORE_SCHEMA', () => {
  const { frontmatter } = parseMarkdown('---\nquando: 2026-10-24\n---\n\ncorpo\n');
  assert.equal(typeof frontmatter.quando, 'string', 'data fica string, não Date');
});

test('loadPackage encontra a empresa e os agentes', () => {
  const pkg = loadPackage(FIXTURE);
  assert.equal(pkg.slug, 'pacote-minimo');
  assert.equal(pkg.company.frontmatter.license, 'MIT');
  assert.equal(pkg.agents.length, 1);
  assert.equal(pkg.agents[0].slug, 'gerente');
});

test('loadPackage normaliza alias no metadata de todo arquivo', () => {
  const pkg = loadPackage(FIXTURE);
  const meta = pkg.agents[0].frontmatter.metadata;
  assert.ok(meta.boundary, 'boundary canônico presente');
  assert.equal(meta.fronteira, undefined, 'alias não sobrevive');
});

test('loadPackage usa o slug do diretório quando o frontmatter omite', () => {
  const pkg = loadPackage(FIXTURE);
  assert.equal(pkg.agents[0].slug, 'gerente');
});

test('loadPackage devolve caminhos relativos ao pacote, nunca absolutos', () => {
  const pkg = loadPackage(FIXTURE);
  assert.ok(!pkg.agents[0].path.startsWith('/'), 'caminho relativo');
  assert.equal(pkg.agents[0].path, 'agents/gerente/AGENTS.md');
});
