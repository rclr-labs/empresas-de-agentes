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

// Seis ocorrências, em cinco arquivos, não fecham byte-a-byte — e a
// causa, medida, NÃO é uma regra de estilo derivável: é formatação manual
// inconsistente do próprio acervo.
//
// 1) `documentacao-e-suporte/agents/suporte-nivel-2/AGENTS.md`,
//    `engenharia-de-dados/agents/{analytics-bi,modelagem-de-dados,
//    pipeline-de-dados,qualidade-de-dados}/AGENTS.md` (5 ocorrências):
//    a lista `execute.deny` quebra em várias linhas quando ficaria muito
//    longa numa só. MAS a mesma regra não vale para `execute.allow` no
//    MESMO arquivo: `pipeline-de-dados` tem `allow` com 141 caracteres
//    numa linha só (sem quebra) e `deny` quebrado ao lado — e arquivos
//    de OUTROS pacotes (`fabrica-de-testes/agents/api-funcional`, 184
//    caracteres; `software-house/agents/desenvolvimento-backend`, 293
//    caracteres) não quebram nunca. Não há threshold de coluna nem de
//    contagem de item que explique os dois lados sem citar o nome do
//    arquivo — é edição manual, não estilo.
// 2) `seguranca-ofensiva/agents/pentest-aplicacao/AGENTS.md` (1
//    ocorrência): `capabilities.network` sai em BLOCO ali, mas em FLUXO
//    em todo outro arquivo do acervo que tem `network` como lista
//    (inclusive com a mesma contagem de 2 itens em
//    `fabrica-de-testes/agents/automacao-e2e`). Mesma conclusão.
const EXCECOES_CONHECIDAS = new Set([
  'documentacao-e-suporte/agents/suporte-nivel-2/AGENTS.md',
  'engenharia-de-dados/agents/analytics-bi/AGENTS.md',
  'engenharia-de-dados/agents/modelagem-de-dados/AGENTS.md',
  'engenharia-de-dados/agents/pipeline-de-dados/AGENTS.md',
  'engenharia-de-dados/agents/qualidade-de-dados/AGENTS.md',
  'seguranca-ofensiva/agents/pentest-aplicacao/AGENTS.md',
]);

test('yaml-emit: reemitir todo papel do acervo não muda um byte, exceto as seis exceções documentadas', () => {
  let total = 0;
  let excecoesEncontradas = 0;
  for (const { nome, f } of arquivosDoAcervo()) {
    total++;
    const original = readFileSync(join(RAIZ, nome, f.path), 'utf8');
    const reemitido = toMarkdown(f);
    const chave = join(nome, f.path);
    if (EXCECOES_CONHECIDAS.has(chave)) {
      excecoesEncontradas++;
      assert.notEqual(reemitido, original,
        `${chave} está na lista de exceções conhecidas mas bateu byte-a-byte — remova da lista`);
    } else {
      assert.equal(reemitido, original, `${chave} mudou na reemissão`);
    }
  }
  assert.equal(total, 85, `esperado 85 arquivos no acervo, achou ${total}`);
  assert.equal(excecoesEncontradas, EXCECOES_CONHECIDAS.size,
    'todas as seis exceções conhecidas precisam aparecer no acervo real');
});

test('PARIDADE semântica: todo frontmatter real do acervo faz ida e volta sem perda (mesmo nas seis exceções de formatação)', () => {
  for (const { nome, f } of arquivosDoAcervo()) {
    const volta = recarregar(f.frontmatter);
    assert.deepEqual(volta, f.frontmatter, `${nome}/${f.path} não sobreviveu à ida e volta semântica`);
  }
});
