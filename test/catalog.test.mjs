import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackage, listPackages } from '../tools/schema.mjs';
import { toMarkdown } from '../tools/serialize.mjs';
import { buildCatalog } from '../tools/catalog.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('catalog: oito pacotes, e todo papel traz persona, fronteira e capacidades (metadata aninhado, fix round 3)', () => {
  const cat = buildCatalog(RAIZ);
  assert.equal(cat.schema, 'catalog/v1');
  assert.equal(cat.packages.length, listPackages(RAIZ).length);
  for (const p of cat.packages) {
    assert.ok(p.license, `${p.slug} sem license`);
    for (const a of p.agents) {
      // Ruling do coordenador (fix round 3): metadata — persona, boundary,
      // capabilities, memory, context — mora DENTRO de `a.metadata`, igual
      // ao arquivo. Achatar no topo (rounds 1-2) dava ergonomia, não
      // correção, e criava as duas convenções que a prova de suficiência
      // expôs (ver fix round 3 no relatório).
      assert.ok(a.metadata.persona.display_name, `${p.slug}/${a.slug} sem display_name`);
      assert.ok(a.metadata.boundary, `${p.slug}/${a.slug} sem boundary`);
      assert.ok(a.metadata.capabilities, `${p.slug}/${a.slug} sem capabilities`);
      assert.equal(typeof a.body, 'string');
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

test('catalog: metadata do papel (boundary, capabilities, memory, context, persona — incluindo background/strengths) sobrevive por inteiro (furo 4)', () => {
  const cat = buildCatalog(RAIZ);
  let algumBackgroundConferido = false;
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const pacoteCatalogo = cat.packages.find((p) => p.slug === nome);
    for (const agente of pkg.agents) {
      const entry = pacoteCatalogo.agents.find((a) => a.slug === agente.slug);
      const meta = agente.frontmatter.metadata ?? {};
      // Com `metadata` aninhado (fix round 3), furo 4 vira uma comparação
      // de objeto só — `a.metadata` É `meta`, cópia direta, sem achatar
      // nem reclassificar nada. Isto cobre toda chave presente E futura
      // (metadata.tools, se um dia existir) sem precisar enumerar nada à
      // mão: `deepEqual` nos dois objetos inteiros já é a derivação.
      assert.deepEqual(entry.metadata, meta,
        `${nome}/${agente.slug} perdeu ou alterou algo em metadata no catálogo`);
      if (Array.isArray(meta.persona?.background) && meta.persona.background.length > 0) {
        algumBackgroundConferido = true;
      }
    }
  }
  // Guarda contra teste infalsificável: se nenhum papel real do acervo
  // tivesse `background`, o deepEqual acima nunca exercitaria o caso que
  // importa, e passaria mesmo com uma regressão que voltasse a excluir o
  // campo em `construirPapel`.
  assert.ok(algumBackgroundConferido,
    'nenhum papel do acervo real tem persona.background — o teste não teria pego a exclusão');
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

// Prova de suficiência — fix round 3. A revisão remontou os 42 papéis a
// partir do catálogo ACHATADO (rounds 1-2) e só bateu byte a byte na
// SEGUNDA tentativa, depois de descobrir a ordem de chave certa por
// fora — porque a ordem e a regra de re-aninhamento não estavam no dado.
// Com `metadata` aninhado como no arquivo (ver construirPapel em
// tools/catalog.mjs), a reconstrução é direta — `{ name, title, slug,
// reportsTo, skills, metadata: a.metadata }`, sem reclassificar nada — e
// esta prova tem de bater na PRIMEIRA tentativa, para os 42, não para um.
test('catalog: reconstrução byte-a-byte dos 42 AGENTS.md reais a partir do catálogo (prova de suficiência, fix round 3)', () => {
  const cat = buildCatalog(RAIZ);
  let totalReconstruido = 0;
  for (const p of cat.packages) {
    for (const a of p.agents) {
      const frontmatterReconstruido = {
        name: a.name,
        title: a.title,
        slug: a.slug,
        reportsTo: a.reportsTo,
        skills: a.skills,
        metadata: a.metadata,
      };
      const reconstruido = toMarkdown({ frontmatter: frontmatterReconstruido, body: a.body });
      const original = readFileSync(join(RAIZ, a.path), 'utf8');
      assert.equal(reconstruido, original,
        `${a.path} não reconstruiu byte a byte a partir do catálogo`);
      totalReconstruido += 1;
    }
  }
  // Não crava "42" como condição do laço — crava como EXPECTATIVA do
  // resultado, e deriva o total de agentes do próprio catálogo para a
  // asserção de contagem (furo 3) já cobrir silêncio aqui; esta linha só
  // confirma que o laço de fato correu sobre algo, não sobre lista vazia.
  const totalNoCatalogo = cat.packages.reduce((n, p) => n + p.agents.length, 0);
  assert.equal(totalReconstruido, totalNoCatalogo);
  assert.ok(totalReconstruido > 0, 'nenhum agente reconstruído — acervo vazio?');
});
