import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackage, listPackages } from '../tools/schema.mjs';
import { validatePackage } from '../tools/rules.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function relatorio(nome) {
  const pkg = loadPackage(join(RAIZ, nome));
  return { pkg, ...validatePackage(pkg) };
}

test('software-house: zero erro', () => {
  const { errors } = relatorio('software-house');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
});

test('software-house: zero aviso — nada de alias, toda persona preenchida', () => {
  const { warnings } = relatorio('software-house');
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('software-house: os cinco papéis com os slugs estáveis', () => {
  const { pkg } = relatorio('software-house');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(), [
    'coordenacao', 'desenvolvimento', 'portao-qualidade', 'revisao', 'tech-lead',
  ]);
});

test('software-house: toda persona tem nome, ícone, pronomes e histórico', () => {
  const { pkg } = relatorio('software-house');
  for (const a of pkg.agents) {
    const p = a.frontmatter.metadata.persona;
    assert.ok(p.display_name, `${a.slug} sem display_name`);
    assert.ok(p.icon, `${a.slug} sem icon`);
    assert.ok(p.pronouns, `${a.slug} sem pronouns`);
    assert.match(p.display_name, /^[A-Za-z][A-Za-z ]+$/,
      `${a.slug}: "${p.display_name}" tem diacrítico ou caractere não-ASCII. O nome tem de funcionar em pt-BR e em inglês`);
    assert.ok(Array.isArray(p.background) && p.background.length >= 2,
      `${a.slug} precisa de ao menos 2 linhas de histórico`);
  }
});

test('todo pacote do acervo: ícone único entre os declarados', () => {
  // Considera só ícone DECLARADO. Um agente ainda não migrado não tem
  // persona, logo `icon` é undefined — e sem o filtro, dois agentes sem
  // ícone colidem em `undefined` e o teste acusa repetição onde há
  // ausência. A ausência já é coberta por W03 (papel sem persona) e pelo
  // teste de roster da Task 26, que exige os 42 com ícone único.
  const icones = new Map();
  for (const nome of listPackages(RAIZ)) {
    for (const a of loadPackage(join(RAIZ, nome)).agents) {
      const icone = a.frontmatter.metadata?.persona?.icon;
      if (!icone) continue;
      assert.ok(!icones.has(icone), `ícone ${icone} repetido: ${icones.get(icone)} e ${nome}/${a.slug}`);
      icones.set(icone, `${nome}/${a.slug}`);
    }
  }
});

test('software-house: nenhuma chave de topo nova — só o que a spec permite', () => {
  const { pkg } = relatorio('software-house');
  const PERMITIDAS = new Set([
    'name', 'title', 'slug', 'description', 'schema', 'kind', 'version',
    'license', 'authors', 'goals', 'tags', 'requirements', 'reportsTo',
    'skills', 'metadata', 'manager', 'includes', 'assignee', 'recurring',
    'allowed-tools',
  ]);
  for (const arquivo of [pkg.company, ...pkg.agents, ...pkg.skills, ...pkg.teams, ...pkg.tasks]) {
    for (const chave of Object.keys(arquivo.frontmatter)) {
      assert.ok(PERMITIDAS.has(chave),
        `chave de topo "${chave}" em ${arquivo.path} não é da spec; extensão vai sob metadata.*`);
    }
  }
});

test('software-house: a persona não vaza para o corpo do agente', () => {
  const { pkg } = relatorio('software-house');
  for (const a of pkg.agents) {
    const nome = a.frontmatter.metadata.persona.display_name;
    assert.ok(!a.body.includes(nome),
      `${a.slug}: "${nome}" aparece no corpo. A persona não entra no prompt — custa token em toda chamada`);
  }
});
