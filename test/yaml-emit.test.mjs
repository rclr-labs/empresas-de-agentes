import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { emitYaml } from '../tools/yaml-emit.mjs';
import { toMarkdown } from '../tools/serialize.mjs';
import { loadPackage, listPackages } from '../tools/schema.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const recarregar = (obj) => yaml.load(emitYaml(obj), { schema: yaml.CORE_SCHEMA });

test('escalares sobrevivem à ida e volta', () => {
  const obj = { s: 'texto', n: 42, f: 1.5, b: true, z: false, nulo: null };
  assert.deepEqual(recarregar(obj), obj);
});

test('cita string que o YAML interpretaria como outro tipo', () => {
  const obj = { a: 'true', b: '42', c: 'null', d: 'sim', e: '', f: '2026-10-24' };
  assert.deepEqual(recarregar(obj), obj);
});

test('cita string com caractere especial de YAML', () => {
  const obj = { a: '*', b: 'x: y', c: '- item', d: '#hash', e: '{a}', f: '[b]', g: 'a"b', h: "a'b" };
  assert.deepEqual(recarregar(obj), obj);
});

test('não cita "#" quando não é precedido de espaço — C# do acervo real', () => {
  // Medido em software-house/skills/stack-dotnet/SKILL.md: o autor NÃO
  // citou "...C# — SDK..." porque "#" sem espaço antes não abre
  // comentário em YAML. Regra ingênua ("#\s") citaria por engano.
  const obj = { d: 'C# e .NET' };
  assert.equal(recarregar(obj).d, obj.d);
  assert.ok(!emitYaml(obj).includes('"'));
});

// --- Fix round 2: chave de mapa nunca passava por escalar() (Critical 1
// da revisão) e newline literal não era detectado nem escapado
// corretamente (Critical 2). O consumidor que exercita esses shapes é o
// editor da vitrine (Fase 2), gerando frontmatter a partir de
// formulário — nenhum dos 42 papéis do acervo tem chave perigosa ou
// newline em valor, por isso o teste de paridade sobre o acervo real não
// cobria nenhum destes casos.

test('chave de mapa com espaço+hash no meio não perde o par — "a #b" seria comentário YAML', () => {
  const obj = { 'a #b': 1, outro: 2 };
  assert.deepEqual(recarregar(obj), obj);
});

test('chave de mapa com espaço final não perde o espaço na releitura', () => {
  const obj = { 'key ': 1 };
  assert.deepEqual(recarregar(obj), obj);
});

test('chave de mapa com ": " não produz YAML inválido', () => {
  const obj = { 'a: b': 1 };
  assert.deepEqual(recarregar(obj), obj);
});

test('chave de mapa vazia não produz YAML inválido', () => {
  const obj = { '': 1, x: 2 };
  assert.deepEqual(recarregar(obj), obj);
});

test('chave de mapa com newline não produz YAML inválido', () => {
  const obj = { 'a\nb': 1 };
  assert.deepEqual(recarregar(obj), obj);
});

test('valor com newline sem outro gatilho de aspas não produz escalar plano cru', () => {
  const obj = { h: 'linha um\nlinha dois' };
  assert.deepEqual(recarregar(obj), obj);
});

test('valor com newline que também cairia em aspas por outro motivo (emoji) não sofre line folding', () => {
  // "?" ou emoji já forçam aspas por SIMBOLO_AUTORAL; sem o fix, o YAML
  // citado faz line folding do newline cru em espaço na releitura —
  // perda silenciosa. O valor abaixo carrega "?" E newline.
  const obj = { frase: 'Isso funciona?\nE se não funcionar?' };
  assert.deepEqual(recarregar(obj), obj);
});

test('newline no fim ou no início da string também sobrevive', () => {
  const obj = { a: '\ninicio', b: 'fim\n', c: '\n' };
  assert.deepEqual(recarregar(obj), obj);
});

test('preserva emoji e acento', () => {
  const obj = { icon: '🗂️', nome: 'Clara Mendes', frase: 'Como vamos saber que ficou pronto?' };
  assert.deepEqual(recarregar(obj), obj);
});

test('array de string e array de objeto', () => {
  const obj = { tags: ['a', 'b'], gates: [{ id: 'x', description: 'y' }] };
  assert.deepEqual(recarregar(obj), obj);
});

test('mapa aninhado em três níveis', () => {
  const obj = { m: { capabilities: { execute: { allow: ['npm *'], deny: ['sudo *'] } } } };
  assert.deepEqual(recarregar(obj), obj);
});

test('array e mapa vazios sobrevivem', () => {
  const obj = { lista: [], mapa: {}, aninhado: { lista: [], mapa: {} } };
  assert.deepEqual(recarregar(obj), obj);
});

test('não quebra linha longa', () => {
  const longa = 'palavra '.repeat(40).trim();
  assert.ok(emitYaml({ h: longa }).includes(longa));
});

test('é determinístico — ordem de chave preservada, saída idêntica', () => {
  const obj = { z: 1, a: 2, m: { y: 3, b: 4 } };
  assert.equal(emitYaml(obj), emitYaml(obj));
  const linhas = emitYaml(obj).trim().split('\n');
  assert.ok(linhas[0].startsWith('z:'), 'ordem de inserção preservada');
});

test('chaves de capabilities saem em fluxo, preservando o estilo autoral', () => {
  const obj = { capabilities: { read: ['repository', 'documentation'], write: ['report'] } };
  const texto = emitYaml(obj);
  assert.match(texto, /read: \[repository, documentation\]/);
  assert.match(texto, /write: \[report\]/);
});

test('monthly_cap preserva duas casas decimais — convenção medida no acervo', () => {
  assert.equal(emitYaml({ monthly_cap: 500 }).trim(), 'monthly_cap: 500.00');
});

// --- Mapas auxiliares sobre o acervo real: os 85 arquivos dos 8 pacotes ---

function arquivosDoAcervo() {
  const arquivos = [];
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const todos = [pkg.company, ...pkg.agents, ...pkg.skills, ...pkg.teams, ...pkg.tasks, ...pkg.projects];
    for (const proj of pkg.projects) todos.push(...proj.tasks);
    for (const f of todos) arquivos.push({ nome, f });
  }
  return arquivos;
}

// Seis ocorrências, em cinco arquivos, não fechavam byte-a-byte na
// primeira passada do emissor. A causa, medida, não era escolha autoral
// de outubro: eram arquivos que os fix rounds desta mesma fase editaram
// à mão hoje (Task 3 expandiu o trio de SQL para 12 entradas nos cinco
// papéis de banco; Task 1 tocou `pentest-aplicacao`) — formatação ad hoc
// de uma edição de hoje, não estilo a preservar. Canonizados: o campo
// divergente de cada um foi reescrito no formato que este emissor deriva
// (fluxo numa linha só, sem quebra manual; `network` em fluxo como todo
// outro arquivo do acervo). A reescrita foi provada semanticamente nula
// — frontmatter parseado antes/depois é `deepEqual` nos 6 — e as 32
// emissões batem idênticas antes/depois da canonização. Ver
// task-6-report.md para a prova completa.

test('yaml-emit: reemitir todo papel do acervo não muda um byte', () => {
  let total = 0;
  for (const { nome, f } of arquivosDoAcervo()) {
    total++;
    const original = readFileSync(join(RAIZ, nome, f.path), 'utf8');
    const reemitido = toMarkdown(f);
    assert.equal(reemitido, original, `${join(nome, f.path)} mudou na reemissão`);
  }
  assert.equal(total, 85, `esperado 85 arquivos no acervo, achou ${total}`);
});

test('PARIDADE semântica: todo frontmatter real do acervo faz ida e volta sem perda', () => {
  for (const { nome, f } of arquivosDoAcervo()) {
    const volta = recarregar(f.frontmatter);
    assert.deepEqual(volta, f.frontmatter, `${nome}/${f.path} não sobreviveu à ida e volta semântica`);
  }
});
