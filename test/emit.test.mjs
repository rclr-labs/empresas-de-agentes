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
  // Tarefa 30: software-house agora também ganha `.claude/` (settings.json
  // com permissions.ask, dos gatilhos de human_gates) — por isso o
  // diretório não é só os .md. Tarefa 19 expandiu o pacote de cinco para
  // nove papéis.
  const arquivos = readdirSync(out).sort();
  assert.deepEqual(arquivos, [
    '.claude', 'coordenacao.md', 'desenvolvimento-backend.md',
    'desenvolvimento-frontend.md', 'desenvolvimento-fullstack.md',
    'desenvolvimento.md', 'portao-qualidade.md', 'product-owner.md',
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

test('claude-code: skills, memory e disallowedTools saem do frontmatter quando o papel os declara', () => {
  // Medido em 2026-10-25: skills e memory são campos documentados de
  // code.claude.com/docs/en/sub-agents — ficaram sem estado em nenhum
  // binding até a tarefa 27/28 (classe de defeito 2 do relato). polaris
  // declara os dois: skills: [veredito-com-confianca, evidencia-
  // replayavel] e memory.scope: project.
  const { out } = emitir(['--package', 'fabrica-de-testes', '--binding', 'claude-code']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'polaris.md'), 'utf8'));
  assert.match(frontmatter.skills, /veredito-com-confianca/);
  assert.match(frontmatter.skills, /evidencia-replayavel/);
  assert.equal(frontmatter.memory, 'project');
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: papel sem execute.allow e com execute.deny recebe disallowedTools: Bash', () => {
  // Nenhum papel real do acervo cai nesse caso hoje (todos declaram
  // execute.allow não vazio) — por isso o teste exercita o escritor
  // direto, com um agente sintético, em vez de depender de um pacote
  // publicado ter esse formato.
  const agent = {
    slug: 'sintetico', body: '\n# Sintético\n',
    frontmatter: {
      name: 'Sintético', title: 'Sintético', slug: 'sintetico', skills: [],
      metadata: {
        capabilities: { execute: { allow: [], deny: ['sudo *'] } },
      },
    },
  };
  const { content } = writers['claude-code'](agent, { tools: [] });
  const { frontmatter } = parseMarkdown(content);
  assert.equal(frontmatter.disallowedTools, 'Bash');
});

test('claude-code: papel com execute.allow não recebe disallowedTools — Bash é legítimo', () => {
  const agent = {
    slug: 'sintetico2', body: '\n# Sintético\n',
    frontmatter: {
      name: 'Sintético 2', title: 'Sintético 2', slug: 'sintetico2', skills: [],
      metadata: {
        capabilities: { execute: { allow: ['npm test*'], deny: ['sudo *'] } },
      },
    },
  };
  const { content } = writers['claude-code'](agent, { tools: ['Bash'] });
  const { frontmatter } = parseMarkdown(content);
  assert.equal(frontmatter.disallowedTools, undefined);
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

test('claude-code: avisa a perda de budget — e NÃO avisa execute.deny como perda, tarefa 30 corrigiu isso', () => {
  // Tarefa 30: execute.deny deixou de ser perda — é hook emitido de
  // verdade agora (ver teste de emissão abaixo). budget continua
  // perdido, porque a ausência de campo de custo não mudou.
  const { out, stdout } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  assert.match(stdout, /budget/);
  assert.match(stdout, /PERDIDO/);
  assert.ok(!/execute\.deny/.test(stdout.split('PERDIDO')[1]?.split(/N[ÃA]O EMITIDO/)[0] ?? ''),
    'execute.deny não pode aparecer no bloco PERDIDO — virou translates, de fato emitido');
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: NÃO EMITIDO separa read.database e approve — dívida nossa, não limite do runtime', () => {
  const { out, stdout } = emitir(['--package', 'fabrica-de-testes', '--binding', 'claude-code']);
  assert.match(stdout, /N[ÃA]O EMITIDO/);
  assert.match(stdout, /read\.database/);
  assert.match(stdout, /mecanismo:/);
  assert.match(stdout, /falta:/);
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: execute.deny vira hook PreToolUse no frontmatter, escopado ao agente', () => {
  // VERIFICADO (não assumido): code.claude.com/docs/en/sub-agents confirma
  // hooks por agente, escopados a esse agente; code.claude.com/docs/en/
  // hooks confirma que exit 2 bloqueia PreToolUse. tech-lead declara
  // execute.deny: ["git push*", "git merge*", "sudo *"].
  const { out } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'tech-lead.md'), 'utf8'));
  assert.ok(frontmatter.hooks, 'tech-lead tem execute.deny — tem de ganhar hooks');
  const pre = frontmatter.hooks.PreToolUse;
  assert.ok(Array.isArray(pre) && pre.length === 1);
  assert.equal(pre[0].matcher, 'Bash');
  const comando = pre[0].hooks[0].command;
  assert.equal(pre[0].hooks[0].type, 'command');
  assert.match(comando, /git push\*/);
  assert.match(comando, /git merge\*/);
  assert.match(comando, /sudo \*/);
  assert.match(comando, /exit 2/);
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: hook de execute.deny NÃO vaza padrão de outro papel — escopo é o agente', () => {
  // software-house/desenvolvimento declara execute.allow com "git push*" e
  // "git commit*" — exatamente a razão pela qual a união por projeto foi
  // rejeitada (bindings/claude-code.yml `source`). Quatro outros papéis
  // negam "git push*"/"git commit*" explicitamente. Cada hook tem de
  // carregar só os PRÓPRIOS padrões de deny do agente — o de
  // desenvolvimento (git push --force*, git merge*, kubectl *, helm *,
  // terraform *, sudo *) nunca pode conter o bare "git push*"/"git
  // commit*" que bloquearia o que ele tem permissão explícita de fazer.
  const { out } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  const { frontmatter: dev } = parseMarkdown(readFileSync(join(out, 'desenvolvimento.md'), 'utf8'));
  const comandoDev = dev.hooks.PreToolUse[0].hooks[0].command;
  assert.ok(!/'git push\*'/.test(comandoDev),
    'desenvolvimento não pode herdar o "git push*" bare que outros papéis negam — ele tem allow explícito para isso');
  assert.ok(!/'git commit\*'/.test(comandoDev),
    'mesma razão para "git commit*"');
  assert.match(comandoDev, /git push --force\*/, 'o próprio deny de desenvolvimento sobrevive');
  const { frontmatter: rev } = parseMarkdown(readFileSync(join(out, 'revisao.md'), 'utf8'));
  assert.match(rev.hooks.PreToolUse[0].hooks[0].command, /git commit\*/,
    'revisao nega git commit* de verdade — e só revisao, não todo papel do pacote');
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: budget.max_turns emite maxTurns — proxy de turno, não de gasto', () => {
  // Nenhum papel real do acervo declara max_turns hoje (o acervo não tem
  // número de turno em lugar nenhum) — exercitado com agente sintético.
  const agent = {
    slug: 'sintetico4', body: '\n# Sintético\n',
    frontmatter: {
      name: 'Sintético 4', title: 'Sintético 4', slug: 'sintetico4', skills: [],
      metadata: { capabilities: { budget: { max_turns: 12 } } },
    },
  };
  const { content } = writers['claude-code'](agent, { tools: [] });
  const { frontmatter } = parseMarkdown(content);
  assert.equal(frontmatter.maxTurns, 12);
});

test('claude-code: sem budget.max_turns declarado, maxTurns não aparece', () => {
  const agent = {
    slug: 'sintetico5', body: '\n# Sintético\n',
    frontmatter: {
      name: 'Sintético 5', title: 'Sintético 5', slug: 'sintetico5', skills: [],
      metadata: { capabilities: { budget: { monthly_cap: 100 } } },
    },
  };
  const { content } = writers['claude-code'](agent, { tools: [] });
  const { frontmatter } = parseMarkdown(content);
  assert.equal(frontmatter.maxTurns, undefined);
});

test('claude-code: human_gates[].triggers emite permissions.ask com os globs; portão sem triggers não inventa nenhum', () => {
  // software-house: deploy-producao e remocao-de-dado-de-producao têm
  // triggers; gasto-acima-do-teto e contato-com-cliente não têm.
  const { out } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  const settings = JSON.parse(readFileSync(join(out, '.claude', 'settings.json'), 'utf8'));
  assert.ok(Array.isArray(settings.permissions.ask));
  assert.ok(settings.permissions.ask.includes('Bash(kubectl apply:*)'));
  assert.ok(settings.permissions.ask.includes('Bash(helm upgrade:*)'));
  assert.ok(settings.permissions.ask.includes('Bash(terraform apply:*)'));
  // nenhum glob fabricado para os portões sem triggers — a lista não
  // cresce um item por portão, só por glob declarado.
  const portoes = 4;
  assert.ok(settings.permissions.ask.length < portoes * 3,
    'a lista não pode ter crescido um glob fantasma por portão sem triggers');
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: NÃO emite settings.json quando nenhum papel declara allowlist E nenhum portão declara gatilho', () => {
  // operacao-de-conhecimento: human_gates sem nenhum padrão de comando
  // (publicar-para-fora, gasto-acima-do-teto, contato-com-cliente) e
  // nenhum papel com network como lista de domínio.
  const { out } = emitir(['--package', 'operacao-de-conhecimento', '--binding', 'claude-code']);
  assert.ok(!existsSync(join(out, '.claude', 'settings.json')),
    'operacao-de-conhecimento não tem allowlist de rede nem portão com gatilho de comando');
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: emite .claude/settings.json com sandbox.network.allowedDomains quando algum papel declara allowlist', () => {
  // INVARIANTE desta rodada: toda capacidade traduzida tem de ser
  // EMITIDA de verdade. network.allowlist é o único caso, entre os
  // quatro revisados, em que a Opção A (emitir o mecanismo) era segura
  // neste acervo — este teste prova que o arquivo existe e carrega o
  // domínio declarado.
  const { out } = emitir(['--package', 'fabrica-de-testes', '--binding', 'claude-code']);
  const settings = JSON.parse(readFileSync(join(out, '.claude', 'settings.json'), 'utf8'));
  assert.ok(settings.sandbox.network.allowedDomains.includes('api-staging.exemplo.com.br'));
  rmSync(out, { recursive: true, force: true });
});

test('claude-code: software-house GANHA settings.json pelos gatilhos de portão — mesmo sem allowlist de rede', () => {
  // TAREFA 30 muda este caso: antes, software-house não tinha allowlist
  // de rede nenhuma e por isso não ganhava settings.json. Agora
  // deploy-producao e remocao-de-dado-de-producao declaram triggers, e
  // isso sozinho já é motivo para o arquivo existir — ver o teste de
  // permissions.ask acima. sandbox.network não aparece, porque nenhum
  // papel do pacote declara allowlist.
  const { out } = emitir(['--package', 'software-house', '--binding', 'claude-code']);
  const settings = JSON.parse(readFileSync(join(out, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.sandbox, undefined,
    'software-house não tem nenhum papel com capabilities.network como lista de domínio');
  assert.ok(settings.permissions.ask.length > 0);
  rmSync(out, { recursive: true, force: true });
});

test('opencode V2: emite permissions como array {action,resource,effect}, shell deny por padrão', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'opencode']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'desenvolvimento.md'), 'utf8'));
  assert.equal(frontmatter.mode, 'subagent');
  assert.equal(frontmatter.temperature, undefined,
    'temperature é campo legado V1 — a doc do runtime pede para não usar em config V2 nova');
  assert.ok(Array.isArray(frontmatter.permissions), 'permissions é array em V2, não dict');
  const shellDeny = frontmatter.permissions.find((r) => r.action === 'shell' && r.resource === '*');
  assert.equal(shellDeny.effect, 'deny', 'deny amplo por padrão');
  const edit = frontmatter.permissions.find((r) => r.action === 'edit');
  assert.equal(edit.effect, 'allow', 'quem escreve código pode editar');
  const subagent = frontmatter.permissions.find((r) => r.action === 'subagent' && r.resource === '*');
  assert.equal(subagent.effect, 'deny');
  rmSync(out, { recursive: true, force: true });
});

test('opencode V2: ORDEM da lista é deny-amplo-primeiro — last-match exige isso, inverter quebra a fronteira', () => {
  // packages/schema/src/permission.ts: regras resolvem última-regra-vence.
  // Uma lista [allow-específico, deny-amplo] faria o deny amplo (último)
  // vencer SEMPRE, cancelando o allow — o oposto da intenção. A ordem
  // certa é deny amplo primeiro, allow específico depois, para que o
  // allow específico seja o último a bater e vença.
  const { out } = emitir(['--package', 'software-house', '--binding', 'opencode']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'desenvolvimento.md'), 'utf8'));
  const shellRules = frontmatter.permissions
    .map((r, i) => ({ ...r, i }))
    .filter((r) => r.action === 'shell');
  const denyAmplo = shellRules.find((r) => r.resource === '*' && r.effect === 'deny');
  const allowEspecifico = shellRules.find((r) => r.effect === 'allow');
  assert.ok(denyAmplo, 'tem deny amplo');
  if (allowEspecifico) {
    assert.ok(denyAmplo.i < allowEspecifico.i,
      'deny amplo tem de vir ANTES do allow específico na lista — V2 é last-match-wins');
  }
  rmSync(out, { recursive: true, force: true });
});

test('opencode V2: network.allowlist restringe webfetch por domínio — fix round 1, segundo achado da auditoria', () => {
  // Auditoria do fix round 1: network.allowlist já estava declarado
  // translates, mas buildPermissions() só emitia uma regra webfetch
  // genérica (resource "*"), nunca restrita ao domínio — a mesma classe
  // de defeito de execute.deny/read.database/approve, só que aqui a
  // correção segura é emitir o mecanismo (Opção A), porque permissions
  // vive DENTRO do frontmatter de cada agente, sem risco de conflito
  // entre papéis do mesmo pacote.
  const { out } = emitir(['--package', 'fabrica-de-testes', '--binding', 'opencode']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'contrato-api.md'), 'utf8'));
  const webfetchRules = frontmatter.permissions
    .map((r, i) => ({ ...r, i }))
    .filter((r) => r.action === 'webfetch');
  const denyGeral = webfetchRules.find((r) => r.resource === '*' && r.effect === 'deny');
  const allowDominio = webfetchRules.find((r) => r.effect === 'allow');
  assert.ok(denyGeral, 'tem deny geral de webfetch');
  assert.ok(allowDominio, 'tem allow específico do domínio');
  assert.match(allowDominio.resource, /api-staging\.exemplo\.com\.br/);
  assert.ok(denyGeral.i < allowDominio.i,
    'deny geral antes do allow do domínio — last-match exige isso aqui também');
  rmSync(out, { recursive: true, force: true });
});

test('opencode: write.report também concede edit — a ação edit cobre edit/write/patch, não só código', () => {
  // Fix round 1 (achado na auditoria "translates significa emitido"): a
  // condição antiga checava só write.includes('code'); revisao escreve
  // `report`, declara write.report como translates no binding, e
  // recebia `edit: deny` na emissão real — exatamente o defeito desta
  // rodada, só que no lado do OpenCode. revisao é o exemplo real: não
  // escreve código, mas escreve relatório, e tem de poder editar o
  // arquivo do relatório.
  const { out } = emitir(['--package', 'software-house', '--binding', 'opencode']);
  const { frontmatter } = parseMarkdown(readFileSync(join(out, 'revisao.md'), 'utf8'));
  const edit = frontmatter.permissions.find((r) => r.action === 'edit');
  assert.equal(edit.effect, 'allow', 'revisao escreve report — edit tem de ser allow');
  rmSync(out, { recursive: true, force: true });
});

test('opencode: papel que não escreve NENHUM alvo de arquivo recebe edit: deny', () => {
  // Nenhum papel real do acervo tem write vazio (todos escrevem ao menos
  // report) — exercita o escritor direto com um agente sintético para
  // provar o caso negativo, agora que write.report também concede edit.
  const agent = {
    slug: 'sintetico3', body: '\n# Sintético\n',
    frontmatter: {
      name: 'Sintético 3', title: 'Sintético 3', slug: 'sintetico3', skills: [],
      metadata: { capabilities: { write: [], read: [] } },
    },
  };
  const applied = applyBinding(agent, { translates: {}, preserves: [], loses: [], permissions: true }, { slug: 'p' });
  const { content } = writers.opencode(agent, applied);
  const { frontmatter } = parseMarkdown(content);
  const edit = frontmatter.permissions.find((r) => r.action === 'edit');
  assert.equal(edit.effect, 'deny');
});

test('portable: um JSON por pacote, com budget preservado', () => {
  const { out } = emitir(['--package', 'software-house', '--binding', 'portable']);
  const manifesto = JSON.parse(readFileSync(join(out, 'agent-manifest.json'), 'utf8'));
  assert.equal(manifesto.package, 'software-house');
  assert.equal(manifesto.agents.length, 9); // tarefa 19: cinco papéis → nove
  const pq = manifesto.agents.find((a) => a.slug === 'portao-qualidade');
  // NOTA: o brief original desta tarefa esperava
  // `pq.capabilities.approve` igual a ['deploy-producao']. Não é o que o
  // pacote real declara: software-house/COMPANY.md diz explicitamente que
  // "capabilities.approve fica vazio em todos os nove papéis,
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

test('VOLUME: saída padrão (sem --verbose) de um pacote de 6 agentes fica sob 40 linhas, em todo binding', () => {
  // Achado 2 da auditoria (fix round 1): paperclip/portable chegavam a
  // 69/75 linhas para fabrica-de-testes (6 agentes) porque listavam
  // PRESERVADA por papel × capacidade em vez de por motivo — 66/72
  // linhas carregando 1-2 fatos. Threshold justificado pelo pior caso
  // LEGÍTIMO medido: opencode, que não agrega perda (perda é item a
  // item por desenho), fica em 33 linhas para 6 agentes — 40 dá margem
  // sem esconder uma regressão de volume que volte a listar por papel.
  for (const binding of ['claude-code', 'opencode', 'paperclip', 'portable']) {
    const { out, stdout } = emitir(['--package', 'fabrica-de-testes', '--binding', binding]);
    const linhas = stdout.trim().split('\n').length;
    assert.ok(linhas < 40,
      `${binding} × fabrica-de-testes: ${linhas} linhas na saída padrão — threshold é 40; agregar PRESERVADA por motivo é o que mantém isso baixo independente do número de agentes`);
    rmSync(out, { recursive: true, force: true });
  }
});

test('VOLUME: --verbose devolve o detalhe por papel que o padrão esconde', () => {
  const { out, stdout: padrao } = emitir(['--package', 'fabrica-de-testes', '--binding', 'paperclip']);
  rmSync(out, { recursive: true, force: true });
  const { out: out2, stdout: detalhado } = emitir(['--package', 'fabrica-de-testes', '--binding', 'paperclip', '--verbose']);
  rmSync(out2, { recursive: true, force: true });
  assert.ok(detalhado.length > padrao.length, '--verbose produz mais saída que o padrão');
  assert.match(detalhado, /polaris: budget —/,
    '--verbose lista o detalhe por papel que a agregação por motivo esconde no padrão');
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
