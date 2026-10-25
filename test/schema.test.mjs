import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseMarkdown, loadPackage, listPackages } from '../tools/schema.mjs';

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

test('parseMarkdown recusa tag desconhecida', () => {
  // ATENÇÃO: este teste NÃO guarda a opção CORE_SCHEMA. Medido em
  // js-yaml 4.3.2: o schema default também lança em !!js/function, porque
  // as tags inseguras saíram da biblioteca no endurecimento v3→v4. O teste
  // seguinte é o que guarda a declaração explícita.
  assert.throws(
    () => parseMarkdown('---\nname: !!js/function "function(){return 1}"\n---\n\ncorpo\n'),
    /unknown tag|YAMLException/i,
  );
});

test('parseMarkdown recusa tag que SÓ o CORE_SCHEMA rejeita', () => {
  for (const tag of ['!!binary "aGk="', '!!timestamp 2026-10-24', '!!set {a: null}']) {
    assert.throws(
      () => parseMarkdown(`---\nx: ${tag}\n---\n\ncorpo\n`),
      /unknown tag|YAMLException/i,
      `${tag} deveria ser rejeitado pelo CORE_SCHEMA`,
    );
  }
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

test('loadPackage carrega skills, teams e tasks, não só agents', () => {
  const pkg = loadPackage(FIXTURE);
  assert.equal(pkg.skills.length, 1);
  assert.equal(pkg.skills[0].slug, 'ser-fixture');
  assert.equal(pkg.skills[0].path, 'skills/ser-fixture/SKILL.md');
  assert.equal(pkg.tasks.length, 1);
  assert.equal(pkg.tasks[0].path, 'tasks/ritual-de-fixture/TASK.md');
  assert.deepEqual(pkg.teams, [], 'coleção ausente devolve array vazio, não erro');
});

test('listPackages lista só diretório com COMPANY.md, e ignora . e _', () => {
  const raiz = join(aqui, 'fixtures');
  const nomes = listPackages(raiz);
  assert.ok(nomes.includes('pacote-minimo'));
  assert.ok(nomes.every((n) => !n.startsWith('.') && !n.startsWith('_')));
  assert.deepEqual(nomes, [...nomes].sort(), 'ordenado');
});
