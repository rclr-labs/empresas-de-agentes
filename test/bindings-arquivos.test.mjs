import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { loadPackage, listPackages } from '../tools/schema.mjs';
import { capabilityKeys, applyBinding } from '../tools/bindings.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'bindings');

const nomes = () => readdirSync(DIR).filter((f) => f.endsWith('.yml')).sort();
const carregar = (f) =>
  yaml.load(readFileSync(join(DIR, f), 'utf8'), { schema: yaml.CORE_SCHEMA });

test('existem os quatro bindings previstos', () => {
  assert.deepEqual(nomes(),
    ['claude-code.yml', 'opencode.yml', 'paperclip.yml', 'portable.yml']);
});

test('todo binding declara runtime, emits, format e procedência', () => {
  for (const f of nomes()) {
    const b = carregar(f);
    assert.ok(b.runtime, `${f} sem runtime`);
    assert.ok(b.emits, `${f} sem emits`);
    assert.ok(b.format, `${f} sem format`);
    assert.ok(b.source, `${f} sem source — procedência do formato é obrigatória`);
  }
});

test('REGRA CENTRAL: todo binding cobre toda capacidade do acervo, em map ou unsupported', () => {
  const usadas = new Set();
  for (const nome of listPackages(RAIZ)) {
    for (const a of loadPackage(join(RAIZ, nome)).agents) {
      for (const k of capabilityKeys(a)) usadas.add(k);
    }
  }
  assert.ok(usadas.size > 0, 'o acervo declara capacidades');

  for (const f of nomes()) {
    const b = carregar(f);
    // skills/memory/context agora são chave endereçável de capabilityKeys
    // (tarefa 27), e viviam só em `unsupported_metadata`, fora do
    // vocabulário de `map`/`unsupported` que esta regra varre — unir os
    // dois é o que impede a classe de defeito 2 (skills sem casa) de
    // voltar: toda chave nova em capabilityKeys cai automaticamente sob
    // esta mesma verificação, sem precisar de um segundo mecanismo.
    // TAREFA 30 soma `not_emitted` à união pela mesma razão: o quarto
    // estado não é "esquecer de declarar" — uma capacidade em
    // `not_emitted` conta como coberta; uma capacidade fora dos quatro
    // continua sendo o defeito que esta regra existe para apanhar.
    const cobertas = new Set([
      ...Object.keys(b.map ?? {}), ...(b.unsupported ?? []), ...(b.unsupported_metadata ?? []),
      ...Object.keys(b.translates ?? {}), ...(b.preserves ?? []), ...(b.loses ?? []),
      ...Object.keys(b.not_emitted ?? {}),
    ]);
    const descobertas = [...usadas].filter((k) => !cobertas.has(k));
    assert.deepEqual(descobertas, [],
      `${f} não cobre: ${descobertas.join(', ')}. Toda capacidade entra em translates, preserves, loses ou not_emitted — perda silenciosa não é opção`);
  }
});

test('not_emitted exige mechanism e falta em toda célula dos bindings publicados', () => {
  // A obrigação que distingue "não emitido" de "perdido com outro nome":
  // sem mechanism, não há mecanismo nomeado para cobrar depois; sem
  // falta, não há o que resolver. MUTAÇÃO: remover `mechanism` de
  // qualquer célula de `not_emitted` em bindings/*.yml tem de fazer este
  // teste falhar.
  for (const f of nomes()) {
    const b = carregar(f);
    for (const [cap, info] of Object.entries(b.not_emitted ?? {})) {
      assert.ok(typeof info === 'object' && info !== null,
        `${f}: not_emitted.${cap} não é objeto — precisa de { mechanism, falta }`);
      assert.ok((info.mechanism ?? '').trim().length > 0,
        `${f}: not_emitted.${cap} sem "mechanism" — sem mecanismo nomeado, é só perda com outro nome`);
      assert.ok((info.falta ?? '').trim().length > 0,
        `${f}: not_emitted.${cap} sem "falta" — sem dizer o que falta, não há o que resolver`);
    }
  }
});

test('portable não perde nada — é o alvo sem perda por desenho', () => {
  const b = carregar('portable.yml');
  assert.deepEqual(b.unsupported ?? [], [],
    'portable existe justamente para não perder capacidade');
  assert.deepEqual(b.unsupported_metadata ?? [], [],
    'nem memory nem context se perdem no portable');
});

test('memory, context e skills: todo binding declara se os preserva ou os perde', () => {
  for (const f of nomes()) {
    const b = carregar(f);
    assert.ok(Array.isArray(b.unsupported_metadata),
      `${f} sem unsupported_metadata — memory, context e skills não podem se perder em silêncio`);
    for (const k of b.unsupported_metadata) {
      assert.ok(['memory', 'context', 'skills'].includes(k), `${f}: "${k}" não é metadata conhecido`);
    }
  }
});

test('paperclip é identidade — o acervo já é o formato', () => {
  const b = carregar('paperclip.yml');
  assert.equal(b.format, 'identity');
  assert.deepEqual(b.unsupported ?? [], []);
});

test('claude-code: TAREFA 30 separa dívida nossa (not_emitted) de limite do runtime (loses)', () => {
  // Fix round 1 (2026-10-25) tinha movido execute.deny/read.database/
  // approve para `loses`, junto com budget — e isso repetia, com a mesma
  // palavra, o próprio erro que corrigia: "loses" não distinguia entre
  // "o Claude Code não tem onde guardar isto" (budget, context — campo
  // ausente, confirmado por busca) e "o Claude Code TEM onde guardar e
  // nós não geramos" (execute.deny, read.database, approve — mecanismo
  // real, nomeado, só não emitido). Tarefa 30 resolve as três de forma
  // diferente, verificando antes de decidir (ver claude-code.yml
  // `source`):
  //   - execute.deny: VERIFICADO que hooks por agente existem, escopados
  //     a esse agente, e que PreToolUse pode negar — volta para
  //     `translates`, de fato EMITIDO (tools/writers.mjs escreve
  //     frontmatter.hooks).
  //   - read.database e approve: mecanismo real, mas sem dado (servidor
  //     MCP; padrão de comando) para escrever — vão para `not_emitted`,
  //     não para `loses`: a lacuna é de dado/engenharia, não de runtime.
  // budget continua em `loses` — a ausência de campo de custo não mudou.
  const b = carregar('claude-code.yml');
  assert.ok(b.loses.includes('budget'),
    'Claude Code não tem teto de custo por agente; a perda tem de estar declarada');
  assert.ok('execute.deny' in b.translates,
    'hooks por agente são mecanismo real e verificado — execute.deny volta a ser traduzido, de fato emitido');
  assert.ok(!b.loses.includes('execute.deny'),
    'execute.deny não pode estar em loses E em translates ao mesmo tempo');
  assert.ok('read.database' in (b.not_emitted ?? {}),
    'mecanismo real (mcp__<servidor>__<ferramenta>), mas nenhum AGENTS.md nomeia o servidor — dívida nossa, não limite do runtime');
  assert.ok('approve' in (b.not_emitted ?? {}),
    'permissions.ask é mecanismo real; capabilities.approve não carrega o padrão de comando nem amarra o signer');
  assert.ok(!b.loses.includes('read.database') && !b.loses.includes('approve'),
    'as duas saíram de loses — não podem continuar lá E em not_emitted');
  assert.ok('network.allowlist' in b.translates,
    'network.allowlist continua de fato emitido — tools/emit.mjs escreve .claude/settings.json');
});

test('opencode foi MEDIDO em 2026-10-25 e deixou de ser "pendente de confirmação"', () => {
  // A medição (agent-studio/docs/pesquisa/2026-10-25-runtimes-medidos.md)
  // leu packages/schema/src/config/agent.ts e permission.ts direto do
  // repo anomalyco/opencode via `gh api` — não é mais observação de uso
  // interno não confirmada. O binding agora precisa dizer isso, citando
  // onde foi lido, e não mais se declarar pendente.
  const b = carregar('opencode.yml');
  assert.match(b.source, /medid[oa]/i,
    'source precisa declarar que o formato foi medido contra fonte primária');
  assert.match(b.source, /anomalyco\/opencode/,
    'source precisa nomear o repo real lido — sst/opencode foi movido');
  assert.ok(!/pendente de confirma[çc][ãa]o/i.test(b.source),
    'depois da medição, não é mais honesto chamar o binding de pendente');
});

test('toda célula de translates/preserves/loses cita a fonte — ou se declara inferida e diz por quê', () => {
  for (const f of nomes()) {
    const b = carregar(f);
    const chaves = new Set([
      ...Object.keys(b.translates ?? {}), ...(b.preserves ?? []), ...(b.loses ?? []),
    ]);
    const citations = b.citations ?? {};
    for (const chave of chaves) {
      const cite = citations[chave];
      assert.ok(cite, `${f}: "${chave}" não tem entrada em citations — célula sem citação é inferência não declarada`);
      if (typeof cite === 'string') {
        assert.ok(cite.trim().length > 0, `${f}: citations.${chave} é string vazia`);
      } else {
        assert.equal(cite.inferido, true,
          `${f}: citations.${chave} não é string nem {inferido:true,...} — formato inválido`);
        assert.ok((cite.source ?? '').trim().length > 0,
          `${f}: citations.${chave} é inferido sem dizer a razão em "source"`);
      }
    }
  }
});

test('allowlist_scope é obrigatório sempre que network.allowlist entra em translates', () => {
  for (const f of nomes()) {
    const b = carregar(f);
    if ('network.allowlist' in (b.translates ?? {})) {
      assert.ok(['os', 'fetch-only'].includes(b.allowlist_scope),
        `${f} traduz network.allowlist mas não declara allowlist_scope — sem isso não se sabe se a lista cobre shell cru`);
    }
  }
});

test('todo agente do acervo aplica em todo binding sem perda não declarada', () => {
  for (const f of nomes()) {
    const b = carregar(f);
    for (const nome of listPackages(RAIZ)) {
      const pkg = loadPackage(join(RAIZ, nome));
      for (const a of pkg.agents) {
        const { lost } = applyBinding(a, b, pkg);
        const naoDeclaradas = lost.filter((l) => /n[ãa]o declarada/i.test(l.reason));
        assert.deepEqual(naoDeclaradas, [],
          `${f} × ${nome}/${a.slug}: ${naoDeclaradas.map((l) => l.capability).join(', ')}`);
      }
    }
  }
});

// --- Fix round 1: invariante "translates significa emitido" -----------

// Mecanismos que o escritor do Claude Code emite SEM passar pela lista
// `tools` (destino vazio em `translates` é esperado para eles, cada um
// com teste próprio provando a emissão em test/emit.test.mjs):
//   - skills/memory: campo de frontmatter escrito direto de
//     frontmatter.skills / metadata.memory.scope.
//   - network.allowlist: .claude/settings.json escrito por tools/emit.mjs.
//   - execute.deny (TAREFA 30): frontmatter.hooks.PreToolUse, escrito por
//     tools/writers.mjs — ver test/emit.test.mjs "execute.deny vira hook".
// Qualquer OUTRA chave de `translates` com destino vazio é suspeita por
// definição — ou tem destino de ferramenta, ou é um dos mecanismos
// especiais acima (com teste de emissão correspondente), ou não devia
// estar em `translates`. Foi exatamente a ausência desta verificação que
// deixou execute.deny/read.database/approve declarados como `translates`
// sem o emissor escrever nada para os três, no fix round 1. MUTAÇÃO: se
// execute.deny voltar para `translates` sem que writers.mjs o emita (ou
// sair desta lista sem sair de `translates`), este teste tem de falhar.
const MECANISMOS_ESPECIAIS_CLAUDE_CODE = new Set(['skills', 'memory', 'network.allowlist', 'execute.deny']);

test('INVARIANTE: toda capacidade traduzida do claude-code é emitida ou é mecanismo especial testado — nunca nenhum dos dois', () => {
  const b = carregar('claude-code.yml');
  for (const [chave, destino] of Object.entries(b.translates)) {
    const alvos = typeof destino === 'string' ? [destino] : destino;
    if (alvos.length === 0 && !MECANISMOS_ESPECIAIS_CLAUDE_CODE.has(chave)) {
      assert.fail(
        `claude-code.yml declara "${chave}" em translates com destino vazio, e não está em ` +
        `MECANISMOS_ESPECIAIS_CLAUDE_CODE — isso é exatamente o defeito "translates sem emitir" ` +
        `do fix round 1. Ou dá um destino de ferramenta real, ou implementa e testa a emissão e ` +
        `soma a chave à lista de mecanismos especiais, ou move a chave para loses.`,
      );
    }
  }
});
