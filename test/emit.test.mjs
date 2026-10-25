import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { writers } from '../tools/writers.mjs';
import { loadPackage, listPackages } from '../tools/schema.mjs';
import { applyBinding } from '../tools/bindings.mjs';
import { parseMarkdown } from '../tools/schema.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function emitir(args) {
  const out = mkdtempSync(join(tmpdir(), 'emit-'));
  const stdout = execFileSync('node',
    [join(RAIZ, 'tools/emit.mjs'), ...args, '--out', out],
    { cwd: RAIZ, encoding: 'utf8' });
  return { out, stdout };
}

test('claude-code: emite um .md por agente, com name, description e tools', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  const arquivos = readdirSync(out).sort();
  assert.deepEqual(arquivos, [
    'coordenacao.md', 'desenvolvimento.md', 'portao-qualidade.md',
    'revisao.md', 'tech-lead.md',
  ]);
  const { frontmatter, body } = parseMarkdown(readFileSync(join(out, 'tech-lead.md'), 'utf8'));
  assert.equal(frontmatter.name, 'tech-lead');
  assert.ok(frontmatter.description, 'description preenchida');
  assert.equal(typeof frontmatter.tools, 'string', 'tools é string separada por vírgula');
  assert.match(frontmatter.tools, /Read/);
  assert.match(body, /Lideran[çc]a T[ée]cnica/, 'o corpo do agente é preservado');
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: delegação sai como Agent(slug)', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'tech-lead.md'), 'utf8'));
  assert.match(frontmatter.tools, /Agent\(desenvolvimento\)/);
  assert.match(frontmatter.tools, /Agent\(revisao\)/);
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: a persona NÃO vai para o corpo, só a headline na description', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  const texto = readFileSync(join(out, 'tech-lead.md'), 'utf8');
  assert.ok(texto.includes('divide problema'), 'a headline chega na description');
  assert.ok(!texto.includes('14 anos em engenharia de plataforma'),
    'o background NÃO é emitido — custa token em toda chamada e não muda comportamento');
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: avisa a perda de budget e de execute.deny', () => {
  const { out, stdout } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  assert.match(stdout, /budget/);
  assert.match(stdout, /execute\.deny/);
  assert.match(stdout, /perdid|n[ãa]o expressa/i);
  rmSync(out, { recursive: true, force: true });
});

test('opencode: emite bloco permission com bash deny por padrão', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'opencode']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'desenvolvimento.md'), 'utf8'));
  assert.equal(frontmatter.mode, 'subagent');
  assert.equal(frontmatter.permission.bash['*'], 'deny', 'deny por padrão');
  assert.equal(frontmatter.permission.edit, 'allow', 'quem escreve código pode editar');
  assert.equal(frontmatter.permission.task['*'], 'deny');
  rmSync(out, { recursive: true, force: true });
});

test('opencode: quem não escreve código não recebe edit allow', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'opencode']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'revisao.md'), 'utf8'));
  assert.equal(frontmatter.permission.edit, 'deny');
  rmSync(out, { recursive: true, force: true });
});

test('portable: um JSON por pacote, com budget preservado', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'portable']);
  const manifesto = JSON.parse(readFileSync(join(out, 'agent-manifest.json'), 'utf8'));
  assert.equal(manifesto.package, 'software-house');
  assert.equal(manifesto.agents.length, 5);
  const pq = manifesto.agents.find((a) => a.slug === 'portao-qualidade');
  // NOTA: o brief original desta tarefa esperava
  // `pq.capabilities.approve` igual a ['deploy-producao']. Não é o que o
  // pacote real declara: software-house/COMPANY.md diz explicitamente que
  // "capabilities.approve fica vazio em todos os cinco papéis,
  // deliberadamente" — nenhum signer de human_gates é um papel, todos são
  // "pessoa nomeada no kickoff", e E14 reprovaria qualquer approve que
  // apontasse para um desses portões. A asserção certa é que o valor REAL
  // (vazio) sobrevive intacto ao portable, não que um valor que o pacote
  // nunca declarou apareça.
  assert.deepEqual(pq.capabilities.approve, [],
    'portable não perde approve — aqui, vazio por desenho do pacote, preservado como vazio');
  assert.ok(pq.capabilities.budget, 'portable não perde budget');
  assert.ok(manifesto.human_gates.length >= 4, 'os portões da empresa viajam no manifesto');
  rmSync(out, { recursive: true, force: true });
});

test('portable: zero perda em todo agente de todo pacote', () => {
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const binding = yaml.load(
      readFileSync(join(RAIZ, 'bindings/portable.yml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA });
    for (const a of pkg.agents) {
      const { lost } = applyBinding(a, binding, pkg);
      assert.deepEqual(lost, [], `${nome}/${a.slug} perdeu capacidade no portable`);
    }
  }
});

test('paperclip: identidade — o pacote sai íntegro', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'paperclip']);
  assert.ok(existsSync(join(out, 'COMPANY.md')));
  assert.ok(existsSync(join(out, 'agents', 'tech-lead', 'AGENTS.md')));
  const original = readFileSync(join(RAIZ, 'software-house/agents/tech-lead/AGENTS.md'), 'utf8');
  const emitido = readFileSync(join(out, 'agents', 'tech-lead', 'AGENTS.md'), 'utf8');
  assert.equal(emitido, original,
    'identidade é byte a byte: o acervo já é agentcompanies/v1, não há o que traduzir');
  rmSync(out, { recursive: true, force: true });
});

test('IDENTIDADE: a árvore inteira sai byte a byte, diretório nenhum esquecido', () => {
  // O teste de UM arquivo acima prova que o escritor não reformata. Este
  // prova a afirmação real da identidade — "zero perda" — comparando a
  // LISTA de arquivos, não só o conteúdo de um já escolhido. Foi assim
  // que projects/ ficou invisível: o teste de um arquivo passava mesmo
  // com o diretório inteiro ausente da saída.
  const { out } = emitir(['--package', 'software-house', '--binding', 'paperclip']);
  const arvore = (raiz) => {
    const acc = [];
    const andar = (rel) => {
      for (const e of readdirSync(join(raiz, rel), { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const r = rel ? join(rel, e.name) : e.name;
        if (e.isDirectory()) andar(r); else acc.push(r);
      }
    };
    andar('');
    return acc.sort();
  };
  const origem = join(RAIZ, 'software-house');
  assert.deepEqual(arvore(out), arvore(origem), 'mesma lista de arquivos');
  for (const rel of arvore(origem)) {
    assert.equal(readFileSync(join(out, rel), 'utf8'), readFileSync(join(origem, rel), 'utf8'),
      `${rel} não saiu byte a byte`);
  }
  rmSync(out, { recursive: true, force: true });
});

test('portable: projects/ viaja no manifesto — não é só agents', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'portable']);
  const manifesto = JSON.parse(readFileSync(join(out, 'agent-manifest.json'), 'utf8'));
  assert.ok(Array.isArray(manifesto.projects) && manifesto.projects.length > 0,
    'projects precisa estar no manifesto portable, ou o alvo "zero perda" perde projeto em silêncio');
  const proj = manifesto.projects.find((p) => p.slug === 'entrada-de-demanda');
  assert.ok(proj, 'projeto entrada-de-demanda presente');
  assert.ok(proj.tasks.some((t) => t.slug === 'triagem-de-demanda'),
    'tarefa aninhada do projeto viaja junto');
  rmSync(out, { recursive: true, force: true });
});

test('recusa emitir pacote inválido', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ruim-'));
  // COMPANY.md sem license → E01. writeFileSync vem do import do topo:
  // require() não existe em pacote "type": "module".
  writeFileSync(join(dir, 'COMPANY.md'),
    '---\nname: X\nslug: x\nschema: agentcompanies/v1\nkind: company\n---\n\n# x\n');
  let falhou = false;
  try {
    execFileSync('node', [join(RAIZ, 'tools/emit.mjs'),
      '--package', dir, '--binding', 'portable', '--out', join(dir, 'out')],
      { encoding: 'utf8' });
  } catch (e) {
    falhou = true;
    assert.match(e.stdout + e.stderr, /E01/);
    assert.match(e.stdout + e.stderr, /recusad|inv[áa]lid/i);
  }
  assert.ok(falhou, 'emissão de pacote inválido tem de falhar');
  rmSync(dir, { recursive: true, force: true });
});

test('PROVA DE AGNOSTICISMO: os três pacotes compilam para os quatro bindings', () => {
  for (const pacote of listPackages(RAIZ)) {
    for (const binding of ['claude-code', 'opencode', 'paperclip', 'portable']) {
      const { out } = emitir(['--package', pacote, '--binding', binding]);
      assert.ok(readdirSync(out).length > 0,
        `${pacote} × ${binding} não produziu saída`);
      rmSync(out, { recursive: true, force: true });
    }
  }
});
