import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackage, listPackages } from '../tools/schema.mjs';
import { buildCatalog } from '../tools/catalog.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('catalog: oito pacotes, e todo papel traz persona, fronteira e capacidades', () => {
  const cat = buildCatalog(RAIZ);
  assert.equal(cat.schema, 'catalog/v1');
  assert.equal(cat.packages.length, listPackages(RAIZ).length);
  for (const p of cat.packages) {
    assert.ok(p.license, `${p.slug} sem license`);
    for (const a of p.agents) {
      assert.ok(a.persona.display_name, `${p.slug}/${a.slug} sem display_name`);
      assert.ok(a.boundary, `${p.slug}/${a.slug} sem boundary`);
      assert.ok(a.capabilities, `${p.slug}/${a.slug} sem capabilities`);
      assert.equal(typeof a.body, 'string');
      assert.ok(!('background' in a.persona), 'background não entra no catálogo');
      assert.ok(!('strengths' in a.persona), 'strengths não entra no catálogo');
    }
  }
});

test('catalog: o catálogo não inventa papel nem perde papel (furo 2 — projects/ já ficou invisível uma vez)', () => {
  const cat = buildCatalog(RAIZ);
  for (const nome of listPackages(RAIZ)) {
    const doDisco = loadPackage(join(RAIZ, nome)).agents.map((a) => a.slug).sort();
    const doCatalogo = cat.packages.find((p) => p.slug === nome).agents.map((a) => a.slug).sort();
    assert.deepEqual(doCatalogo, doDisco, `${nome} divergiu`);
  }
});

test('catalog: contagem de pacotes e agentes é derivada do disco, não cravada (furo 3)', () => {
  const cat = buildCatalog(RAIZ);
  const nomes = listPackages(RAIZ);
  const totalAgentesNoDisco = nomes.reduce(
    (n, nome) => n + loadPackage(join(RAIZ, nome)).agents.length, 0);
  assert.equal(cat.packages.length, nomes.length);
  assert.equal(
    cat.packages.reduce((n, p) => n + p.agents.length, 0),
    totalAgentesNoDisco);
});

test('catalog: nenhum campo de metadata do papel (boundary, capabilities, memory, context, persona) se perde — exceto background/strengths por decisão (furo 4)', () => {
  const cat = buildCatalog(RAIZ);
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const pacoteCatalogo = cat.packages.find((p) => p.slug === nome);
    for (const agente of pkg.agents) {
      const entry = pacoteCatalogo.agents.find((a) => a.slug === agente.slug);
      const meta = agente.frontmatter.metadata ?? {};
      // Toda chave de metadata, QUALQUER UMA, exceto `persona` (tratada
      // abaixo com a exceção declarada), tem de estar presente no catálogo
      // com o MESMO valor. Isto não enumera 'boundary'/'capabilities' à
      // mão — itera as chaves que o PRÓPRIO ARQUIVO declara, então um campo
      // novo que apareça num AGENTS.md futuro (ex.: metadata.tools) já
      // nasce coberto por este teste, sem precisar editá-lo.
      for (const chave of Object.keys(meta)) {
        if (chave === 'persona') continue;
        assert.deepEqual(entry[chave], meta[chave],
          `${nome}/${agente.slug} perdeu metadata.${chave} no catálogo`);
      }
      // persona: toda chave DECLARADA, exceto background/strengths (decisão
      // de arquitetura: custam token em toda chamada e não mudam
      // comportamento), tem de sobreviver com o mesmo valor.
      const persona = meta.persona ?? {};
      for (const chave of Object.keys(persona)) {
        if (chave === 'background' || chave === 'strengths') continue;
        assert.deepEqual(entry.persona[chave], persona[chave],
          `${nome}/${agente.slug} perdeu persona.${chave} no catálogo`);
      }
    }
  }
});

test('catalog: nenhum pacote some nem é inventado (slug a slug)', () => {
  const cat = buildCatalog(RAIZ);
  assert.deepEqual(
    cat.packages.map((p) => p.slug).sort(),
    listPackages(RAIZ).sort());
});

test('catalog: teams/tasks/projects (e tasks aninhada em projects) não ficam invisíveis — mesmo furo de projects/ do commit 76fef37, agora na camada do catálogo', () => {
  const cat = buildCatalog(RAIZ);
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const pCat = cat.packages.find((p) => p.slug === nome);
    assert.equal(pCat.teams.length, pkg.teams.length, `${nome}: teams divergiu`);
    assert.equal(pCat.tasks.length, pkg.tasks.length, `${nome}: tasks divergiu`);
    assert.equal(pCat.projects.length, pkg.projects.length, `${nome}: projects divergiu`);
    for (const proj of pkg.projects) {
      const projCat = pCat.projects.find((p) => p.slug === proj.slug);
      assert.equal(projCat.tasks.length, proj.tasks.length,
        `${nome}/${proj.slug}: tasks do projeto divergiram`);
    }
  }
});

test('catalog: pacote com erro de validação falha a geração', () => {
  assert.throws(() => buildCatalog(join(RAIZ, 'test/fixtures/catalog/pacote-invalido')),
    /erro de valida/i);
});

test('catalog: pacote com aviso (persona incompleta) ainda gera catálogo — aviso não é erro', () => {
  const cat = buildCatalog(join(RAIZ, 'test/fixtures/catalog/pacote-com-aviso'));
  assert.equal(cat.packages.length, 1);
  assert.equal(cat.packages[0].agents.length, 1);
});

test('catalog: generated_from é um sha curto quando o acervo está em git', () => {
  const cat = buildCatalog(RAIZ);
  assert.match(cat.generated_from, /^[0-9a-f]{7,40}$/);
});

test('catalog: --ref sobrepõe a detecção automática', () => {
  const cat = buildCatalog(RAIZ, { ref: 'deadbee' });
  assert.equal(cat.generated_from, 'deadbee');
});
