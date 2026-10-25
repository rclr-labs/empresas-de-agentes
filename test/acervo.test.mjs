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

test('nenhum papel assina o portão sobre os próprios limites', () => {
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const slugs = new Set(pkg.agents.map((a) => a.slug));
    for (const g of pkg.company.frontmatter.metadata?.human_gates ?? []) {
      const id = typeof g === 'string' ? g : g.id;
      if (!/gasto|teto|or[çc]amento/i.test(id)) continue;
      const signer = typeof g === 'string' ? null : g.signer;
      assert.ok(!slugs.has(signer),
        `${nome}: o portão "${id}" é assinado pelo papel "${signer}". Alertar a si mesmo é notificação; autorizar o próprio estouro é conflito — o signer tem de ser pessoa nomeada`);
    }
    for (const a of pkg.agents) {
      const aprova = a.frontmatter.metadata?.capabilities?.approve ?? [];
      const propria = aprova.find((x) => /gasto|teto/i.test(x));
      assert.ok(!propria,
        `${nome}/${a.slug} lista "${propria}" em approve — nenhum papel aprova o portão do próprio teto`);
    }
  }
});

test('todo papel que abre pull request consegue dar push', () => {
  for (const nome of listPackages(RAIZ)) {
    for (const a of loadPackage(join(RAIZ, nome)).agents) {
      const cap = a.frontmatter.metadata?.capabilities ?? {};
      if (!(cap.write ?? []).includes('pull_request')) continue;
      const allow = cap.execute?.allow ?? [];
      assert.ok(allow.some((g) => /^git push/.test(g)),
        `${nome}/${a.slug} declara write: [pull_request] mas não tem git push em execute.allow — capacidade inalcançável`);
      assert.ok((cap.execute?.deny ?? []).some((g) => /force/.test(g)),
        `${nome}/${a.slug} pode dar push e tem de negar push --force explicitamente`);
    }
  }
});

test('fabrica-de-testes: zero erro', () => {
  const { errors } = relatorio('fabrica-de-testes');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
});

test('fabrica-de-testes: zero aviso', () => {
  const { warnings } = relatorio('fabrica-de-testes');
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('fabrica-de-testes: só polaris é raiz; os cinco especialistas reportam a ela', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const raizes = pkg.agents.filter((a) => a.frontmatter.reportsTo == null);
  assert.deepEqual(raizes.map((a) => a.slug), ['polaris']);
  for (const a of pkg.agents.filter((x) => x.slug !== 'polaris')) {
    assert.equal(a.frontmatter.reportsTo, 'polaris', `${a.slug} reporta a polaris`);
  }
});

test('fabrica-de-testes: nenhum especialista pode emitir veredito', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  for (const a of pkg.agents.filter((x) => x.slug !== 'polaris')) {
    assert.deepEqual(a.frontmatter.metadata.capabilities.approve, [],
      `${a.slug} não assina portão — veredito é de polaris`);
    assert.deepEqual(a.frontmatter.metadata.capabilities.delegate, [],
      `${a.slug} não delega — especialista é folha`);
  }
});

test('fabrica-de-testes: só polaris delega, e para os cinco especialistas', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const polaris = pkg.agents.find((a) => a.slug === 'polaris');
  assert.deepEqual(polaris.frontmatter.metadata.capabilities.delegate.sort(), [
    'acessibilidade', 'contrato-api', 'exploratorio', 'integridade-de-dados', 'privacidade',
  ]);
});

test('fabrica-de-testes: nenhum especialista lê database sem portão humano declarado', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const integridade = pkg.agents.find((a) => a.slug === 'integridade-de-dados');
  assert.ok(integridade.frontmatter.metadata.capabilities.read.includes('database'),
    'integridade-de-dados precisa ler base para comparar origem e destino');
  assert.ok(integridade.frontmatter.metadata.boundary.cannot.some((t) => /produ[çc][ãa]o/i.test(t)),
    'e a prosa precisa negar produção explicitamente');
});
