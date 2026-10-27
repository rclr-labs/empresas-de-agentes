import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { toMarkdown } from '../tools/serialize.mjs';
import { verificarEmissao } from '../tools/fix-guard.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function rodar(args, cwd = RAIZ) {
  try {
    const stdout = execFileSync('node', [join(RAIZ, 'tools/validate.mjs'), ...args],
      { cwd, encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

test('toMarkdown produz frontmatter e corpo relegíveis', () => {
  const texto = toMarkdown({ frontmatter: { name: 'X', slug: 'x' }, body: '\n# X\n' });
  assert.match(texto, /^---\n/);
  assert.match(texto, /name: X/);
  assert.match(texto, /# X/);
});

test('toMarkdown é determinístico — duas chamadas, texto idêntico', () => {
  const obj = { frontmatter: { a: 1, b: ['x', 'y'], c: { d: true } }, body: '\ncorpo\n' };
  assert.equal(toMarkdown(obj), toMarkdown(obj));
});

test('toMarkdown não quebra linha longa — lineWidth -1', () => {
  const longa = 'palavra '.repeat(40).trim();
  const texto = toMarkdown({ frontmatter: { headline: longa }, body: '' });
  assert.ok(texto.includes(longa), 'a linha longa sobreviveu inteira');
});

// --- Fix round 3: a guarda de sanidade pós-emissão (tools/fix-guard.mjs),
// testada em nível de unidade com pares (frontmatter de origem, texto
// emitido) construídos à mão — não precisa que o emissor real tenha
// produzido o texto divergente, só que o par não bata. "Este teste
// passaria se o mecanismo estivesse ausente?" — não: sem a guarda, os
// três casos abaixo não detectariam nada, e a mensagem não nomearia
// campo nenhum.

test('verificarEmissao DETECTA campo faltando e NOMEIA o campo', () => {
  const original = { name: 'X', slug: 'x', version: '1.0.0' };
  const emitido = '---\nname: X\nslug: x\n---\n\ncorpo\n'; // "version" sumiu
  const veredito = verificarEmissao(original, emitido);
  assert.equal(veredito.ok, false, 'tem de detectar a divergência');
  assert.match(veredito.motivo, /version/, 'a mensagem tem de nomear o campo que divergiu');
});

test('verificarEmissao DETECTA valor alterado e NOMEIA o campo', () => {
  const original = { name: 'X', slug: 'x' };
  const emitido = '---\nname: Y\nslug: x\n---\n\ncorpo\n'; // "name" mudou de X para Y
  const veredito = verificarEmissao(original, emitido);
  assert.equal(veredito.ok, false, 'tem de detectar a divergência');
  assert.match(veredito.motivo, /name/, 'a mensagem tem de nomear o campo que divergiu');
});

test('verificarEmissao DETECTA campo a mais e NOMEIA o campo', () => {
  const original = { name: 'X', slug: 'x' };
  const emitido = '---\nname: X\nslug: x\nextra: surpresa\n---\n\ncorpo\n'; // "extra" não existia
  const veredito = verificarEmissao(original, emitido);
  assert.equal(veredito.ok, false, 'tem de detectar a divergência');
  assert.match(veredito.motivo, /extra/, 'a mensagem tem de nomear o campo que divergiu');
});

test('verificarEmissao aprova um par que de fato bate (caso de controle)', () => {
  const original = { name: 'X', slug: 'x' };
  const emitido = '---\nname: X\nslug: x\n---\n\ncorpo\n';
  assert.deepEqual(verificarEmissao(original, emitido), { ok: true });
});

test('verificarEmissao NÃO GRAVA nada — o módulo não importa capacidade de escrita', () => {
  // A prova de "não grava" não pode ser comportamental (a função não
  // recebe caminho de arquivo nenhum para escrever) — é estrutural: o
  // módulo da guarda só pode decidir, nunca persistir, porque ele não
  // importa writeFileSync nem qualquer outra função de escrita de
  // tools/fix-guard.mjs. Quem grava é o caller (validate.mjs), e só
  // depois de checar `ok: true`.
  const fonte = readFileSync(join(RAIZ, 'tools/fix-guard.mjs'), 'utf8');
  const linhasDeImport = fonte.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
  assert.ok(!/writeFileSync|appendFile|rmSync|unlink/.test(linhasDeImport),
    'tools/fix-guard.mjs não pode IMPORTAR nenhuma capacidade de escrita');
});

test('o CLI aprova os pacotes reais do acervo', () => {
  const { code, stdout } = rodar([]);
  assert.equal(code, 0, `o acervo deve estar válido. Saída:\n${stdout}`);
});

test('o CLI falha num pacote sem license e nomeia E01', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  mkdirSync(join(dir, 'agents', 'a'), { recursive: true });
  writeFileSync(join(dir, 'COMPANY.md'),
    '---\nname: Sem Licenca\nslug: sem-licenca\nschema: agentcompanies/v1\nkind: company\n---\n\n# x\n');
  writeFileSync(join(dir, 'agents', 'a', 'AGENTS.md'),
    '---\nname: A\nslug: a\nreportsTo: null\nmetadata:\n  boundary:\n    can: [ler]\n    cannot: []\n---\n\n# A\n');
  const { code, stdout } = rodar([dir]);
  assert.equal(code, 1);
  assert.match(stdout, /E01/);
  rmSync(dir, { recursive: true, force: true });
});

test('--fix reescreve alias pt-BR para canônico e o arquivo volta sem aviso', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  mkdirSync(join(dir, 'agents', 'a'), { recursive: true });
  writeFileSync(join(dir, 'COMPANY.md'),
    '---\nname: Alias\nslug: alias\nschema: agentcompanies/v1\nkind: company\nlicense: MIT\n---\n\n# x\n');
  const comAlias = '---\nname: A\nslug: a\nreportsTo: null\nmetadata:\n  fronteira:\n    pode: [ler]\n    nao_pode: []\n---\n\n# A\n';
  writeFileSync(join(dir, 'agents', 'a', 'AGENTS.md'), comAlias);

  const antes = rodar([dir]);
  assert.match(antes.stdout, /W01/, 'avisa antes do fix');

  rodar([dir, '--fix']);
  const depois = readFileSync(join(dir, 'agents', 'a', 'AGENTS.md'), 'utf8');
  assert.match(depois, /boundary:/);
  assert.ok(!depois.includes('fronteira:'), 'alias removido');
  assert.ok(!depois.includes('nao_pode'), 'alias interno removido');

  const final = rodar([dir]);
  assert.ok(!final.stdout.includes('W01'), 'sem aviso depois do fix');
  rmSync(dir, { recursive: true, force: true });
});

test('um AGENTS.md malformado não aborta o pacote: nomeia o arquivo e deixa os demais agentes serem validados', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  mkdirSync(join(dir, 'agents', 'bom'), { recursive: true });
  mkdirSync(join(dir, 'agents', 'quebrado'), { recursive: true });
  writeFileSync(join(dir, 'COMPANY.md'),
    '---\nname: Quebrado\nslug: quebrado\nschema: agentcompanies/v1\nkind: company\nlicense: MIT\n---\n\n# x\n');
  // frontmatter sem o "---" de fechamento — YAML malformado de propósito.
  writeFileSync(join(dir, 'agents', 'quebrado', 'AGENTS.md'),
    '---\nname: Quebrado\nslug: quebrado\nreportsTo: null\n\n# corpo sem fechar o frontmatter\n');
  writeFileSync(join(dir, 'agents', 'bom', 'AGENTS.md'),
    '---\nname: Bom\nslug: bom\nreportsTo: null\nmetadata:\n  boundary:\n    can: [ler]\n    cannot: []\n---\n\n# Bom\n');

  const { code, stdout } = rodar([dir]);
  assert.equal(code, 1, 'o pacote reprova por causa do arquivo malformado');
  assert.match(stdout, /E12/, 'o código do erro de carga aparece');
  assert.match(stdout, /agents[\\/]quebrado[\\/]AGENTS\.md/, 'o caminho do arquivo ofensor é nomeado');
  assert.doesNotMatch(stdout, /at Object\.|at file:|Error:\s*$/m, 'sem stack trace bruto na saída');
  rmSync(dir, { recursive: true, force: true });
});

test('toMarkdown preserva corpo CRLF byte a byte', () => {
  const corpo = '\r\n# Titulo\r\nlinha\r\n';
  const texto = toMarkdown({ frontmatter: { name: 'X' }, body: corpo });
  const depois = texto.slice(texto.indexOf('---\r\n', 4) + 5);
  assert.equal(depois, corpo, 'o corpo tem de sair idêntico ao que entrou');
});

test('toMarkdown não apaga espaço no fim da última linha do corpo', () => {
  const corpo = '\n# X\nlinha com espaco   \n';
  const texto = toMarkdown({ frontmatter: { name: 'X' }, body: corpo });
  assert.ok(texto.includes('linha com espaco   '), 'espaço é conteúdo, não lixo');
});

test('--fix sem alvo é RECUSADO, não aplicado a tudo', () => {
  const { code, stdout, stderr } = rodar(['--fix']);
  assert.equal(code, 2, 'sai 2: erro de uso, não de validação');
  assert.match(stdout + stderr, /alvo expl[íi]cito/i);
});

test('--fix NÃO reescreve pacote que tem erro', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  mkdirSync(join(dir, 'agents', 'a'), { recursive: true });
  writeFileSync(join(dir, 'COMPANY.md'),
    '---\nname: X\nslug: x\nschema: agentcompanies/v1\nkind: company\n---\n\n# x\n');
  const comAlias = '---\nname: A\nslug: a\nreportsTo: null\nmetadata:\n  fronteira:\n    pode: [ler]\n    nao_pode: []\n---\n\n# A\n';
  writeFileSync(join(dir, 'agents', 'a', 'AGENTS.md'), comAlias);

  const { code } = rodar([dir, '--fix']);
  assert.equal(code, 1, 'o erro ainda reprova');
  assert.equal(readFileSync(join(dir, 'agents', 'a', 'AGENTS.md'), 'utf8'), comAlias,
    'arquivo intocado: reescrever pacote reprovado esconde o defeito atrás de formatação');
  rmSync(dir, { recursive: true, force: true });
});

test('--fix não se contradiz: recusou, então não diz que aplicou', () => {
  // Medido antes: a mesma execução imprimia "--fix NÃO aplicado" e depois
  // "--fix aplicado", porque o resumo era condicionado na flag e não na
  // escrita. Ferramenta que mente sobre o que fez é pior que a que não faz.
  const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  mkdirSync(join(dir, 'agents', 'a'), { recursive: true });
  writeFileSync(join(dir, 'COMPANY.md'),
    '---\nname: X\nslug: x\nschema: agentcompanies/v1\nkind: company\n---\n\n# x\n');
  writeFileSync(join(dir, 'agents', 'a', 'AGENTS.md'),
    '---\nname: A\nslug: a\nreportsTo: null\nmetadata:\n  fronteira:\n    pode: [ler]\n    nao_pode: []\n---\n\n# A\n');

  const { stdout, stderr } = rodar([dir, '--fix']);
  const saida = stdout + stderr;
  assert.match(saida, /N[ÃA]O aplicado/i, 'a recusa aparece');
  assert.ok(!/--fix aplicado/.test(saida), 'e o resumo NÃO diz que aplicou');
  assert.match(saida, /n[ãa]o reescreveu nenhum arquivo/i);
  rmSync(dir, { recursive: true, force: true });
});

test('--fix relata a contagem real de arquivos reescritos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  mkdirSync(join(dir, 'agents', 'a'), { recursive: true });
  writeFileSync(join(dir, 'COMPANY.md'),
    '---\nname: X\nslug: x\nschema: agentcompanies/v1\nkind: company\nlicense: MIT\n---\n\n# x\n');
  writeFileSync(join(dir, 'agents', 'a', 'AGENTS.md'),
    '---\nname: A\nslug: a\nreportsTo: null\nskills: [x]\nmetadata:\n  persona: {display_name: N, icon: Z, background: [a, b, c]}\n  fronteira:\n    pode: [ler]\n    nao_pode: []\n---\n\n# A\n');

  const { stdout } = rodar([dir, '--fix']);
  assert.match(stdout, /--fix aplicado: \d+ arquivo/, 'diz quantos');
  rmSync(dir, { recursive: true, force: true });
});

test('--json devolve saída parseável', () => {
  const { stdout } = rodar(['--json']);
  const dados = JSON.parse(stdout);
  assert.ok(Array.isArray(dados.packages));
  assert.ok(Object.hasOwn(dados, 'errors'));
});
