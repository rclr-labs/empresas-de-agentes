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
    const cobertas = new Set([
      ...Object.keys(b.map ?? {}), ...(b.unsupported ?? []), ...(b.unsupported_metadata ?? []),
      ...Object.keys(b.translates ?? {}), ...(b.preserves ?? []), ...(b.loses ?? []),
    ]);
    const descobertas = [...usadas].filter((k) => !cobertas.has(k));
    assert.deepEqual(descobertas, [],
      `${f} não cobre: ${descobertas.join(', ')}. Toda capacidade entra em map ou em unsupported — perda silenciosa não é opção`);
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

test('claude-code declara budget como perdido e execute.deny como traduzido, a partir da medição', () => {
  // Medido em 2026-10-25 (agent-studio/docs/pesquisa/2026-10-25-runtimes-
  // medidos.md): a versão anterior desta regra testava a INFERÊNCIA
  // errada ("tools é lista aditiva, sem deny-list" ignorava
  // disallowedTools e permissions.deny). budget continua perdido — não
  // há teto de moeda documentado em lugar nenhum da config do runtime.
  const b = carregar('claude-code.yml');
  assert.ok(b.loses.includes('budget'),
    'Claude Code não tem teto por agente; a perda tem de estar declarada');
  assert.ok('execute.deny' in b.translates,
    'disallowedTools + permissions.deny + hook PreToolUse/agent_type traduzem execute.deny, com ressalva de escopo');
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
