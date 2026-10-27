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

// --- Tabela adversarial de ida-e-volta (revisão ampla, 2026-10-27) ------
//
// O `\r` foi a QUINTA camada da mesma família de defeito: contenção de
// token → flag cravada → curinga ausente → literal sem verbo → `\r` logo
// abaixo do `\n` corrigido. O revisor varreu 49 formas para achá-lo. Esta
// tabela existe para que a sexta camada não precise de outra varredura
// manual: não guarda UM caractere, guarda a CLASSE — caractere de
// controle e indicador de YAML — afirmada por `yaml.load` com igualdade
// profunda, que é o único juiz que enxerga tanto o documento inválido
// (estoura) quanto o *line folding* (passa limpo e corrompe).
//
// A prova de 85/85 sobre o acervo real NÃO alcança nada disto, e
// estruturalmente não pode: zero arquivo do acervo tem controle em
// frontmatter. Quem produz estas formas é o editor da Fase 2, a partir de
// formulário e de texto colado — e lá não há parser para reclamar.
const TABELA_ADVERSARIAL = {
  // Caracteres de controle. CR em três posições, porque o modo de falha
  // muda com a posição: no meio é documento inválido, no fim e junto do
  // LF é folding silencioso.
  'CR no meio': 'a\rb',
  'CR no fim': 'a\r',
  'CR no início': '\ra',
  'CRLF': 'a\r\nb',
  'LF': 'a\nb',
  'LF no fim': 'a\n',
  'CR + gatilho de aspas (emoji)': 'a\r\u{1F600}',
  'CR + gatilho de aspas (?)': 'a?\rb',
  'TAB no meio': 'a\tb',
  'TAB no fim': 'a\t',
  'TAB no início': '\ta',
  'VT': 'a\v b',
  'FF': 'a\f b',
  'NUL': 'a\0b',
  'BS': 'a\bb',
  'BEL': 'a\x07b',
  'ESC': 'a\x1bb',
  'DEL': 'a\x7fb',
  'barra invertida': 'a\\b',
  'aspas': 'a"b',
  'barra + aspas + quebra': 'a\\"\nb',
  // Indicadores de YAML.
  'ancora': '&x',
  'alias': '*x',
  'tag': '!!str',
  'diretiva': '%YAML',
  'arroba': '@x',
  'acento grave': '`x',
  'dois-pontos no fim': 'a:',
  'dois-pontos no meio': 'a:b',
  'dois-pontos + espaço': 'a: b',
  'hash no fim': 'a #',
  'hash no meio': 'a #b',
  'interrogação': 'a?',
  'só interrogação': '?',
  'traço no início': '-a',
  'só traço': '-',
  'três pontos': '...',
  'separador de documento': '---',
  'bloco literal': '|texto',
  'bloco dobrado': '>texto',
  'chaves': '{a}',
  'colchetes': '[b]',
  'vírgula': 'a,b',
  'vazio': '',
  'só espaço': ' ',
  'espaço duplo no meio': 'a  b',
  'espaço no fim': 'a ',
  // Grafias que o core schema releria como outro TIPO.
  'hex': '0x1f',
  'octal': '0o17',
  'binário': '0b101',
  'inf': '.inf',
  'nan': '.nan',
  'tilde': '~',
  'True': 'True',
  'Null': 'Null',
  'expoente': '1e3',
  'mais quarenta e dois': '+42',
  'zero duplo': '00',
  'underscore numérico': '1_000',
  'reservada yes': 'yes',
  'reservada on': 'on',
  'data': '2026-10-24',
};

test('tabela adversarial: todo VALOR sobrevive à ida e volta, com igualdade profunda', () => {
  for (const [nome, valor] of Object.entries(TABELA_ADVERSARIAL)) {
    const obj = { k: valor };
    assert.deepEqual(recarregar(obj), obj,
      `[${nome}] ${JSON.stringify(valor)} não sobreviveu — emitido ${JSON.stringify(emitYaml(obj))}`);
  }
});

// LIMITE DECLARADO (ver chaveEmYaml em tools/yaml-emit.mjs e SCHEMA.md):
// `chaveEmYaml` não reaplica RESERVADAS/NUMERICA porque uma CHAVE `true`
// ou `42` é coagida de volta para a mesma string ao entrar no objeto JS.
// O argumento vale para a grafia CANÔNICA e NÃO vale para grafia não
// canônica do mesmo valor: como chave, `~` volta "null", `0x1f` volta
// "31", `.inf` volta "Infinity", `True` volta "true", `1e3` volta "1000",
// `+42` volta "42", `00` volta "0". Fechar isso é política de citação de
// chave, não caractere a escapar — está nomeado, não corrigido, e nenhuma
// chave do acervo ou do schema tem essa forma. As formas abaixo ficam
// FORA do laço de chave por isso, nomeadas uma a uma: a lista é o limite,
// não um "skip" genérico.
const CHAVES_FORA_DO_ALCANCE = new Set([
  'hex', 'octal', 'binário', 'inf', 'nan', 'tilde',
  'True', 'Null', 'expoente', 'mais quarenta e dois', 'zero duplo',
]);

test('tabela adversarial: toda CHAVE sobrevive à ida e volta, fora das grafias não canônicas declaradas', () => {
  for (const [nome, valor] of Object.entries(TABELA_ADVERSARIAL)) {
    if (CHAVES_FORA_DO_ALCANCE.has(nome)) continue;
    const obj = { [valor]: 1 };
    assert.deepEqual(recarregar(obj), obj,
      `[${nome}] como chave: ${JSON.stringify(valor)} não sobreviveu — emitido ${JSON.stringify(emitYaml(obj))}`);
  }
});

test('tabela adversarial: a premissa de chaveEmYaml vale para a grafia canônica', () => {
  // A razão documentada para NÃO citar chave numérica/booleana: o YAML a
  // resolve para escalar, e o objeto JS a coage de volta para a MESMA
  // string. Este teste é o que torna essa afirmação verificada em vez de
  // confiada — e é o contraponto positivo de CHAVES_FORA_DO_ALCANCE.
  for (const chave of ['true', 'false', 'null', '42', '-42', '0', '4.2']) {
    const obj = { [chave]: 1 };
    assert.deepEqual(recarregar(obj), obj, `chave canônica ${chave} mudou de grafia`);
  }
  // E segue sem aspas cosméticas — exceto `-42`, que PERIGOSO cita pelo
  // traço de abertura (um `- ` abriria sequência), não pelo número.
  for (const chave of ['true', 'false', 'null', '42', '0', '4.2']) {
    assert.ok(!emitYaml({ [chave]: 1 }).startsWith('"'),
      `chave ${chave} saiu citada sem necessidade`);
  }
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
