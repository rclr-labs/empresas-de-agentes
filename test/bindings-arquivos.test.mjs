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

test('claude-code declara budget e execute.deny como perdidos', () => {
  const b = carregar('claude-code.yml');
  assert.ok(b.unsupported.includes('budget'),
    'Claude Code não tem teto por agente; a perda tem de estar declarada');
  assert.ok(b.unsupported.includes('execute.deny'),
    'tools é lista aditiva, sem deny-list');
});

test('opencode está marcado como pendente de confirmação', () => {
  const b = carregar('opencode.yml');
  assert.match(b.source, /pendente|observado|n[ãa]o confirmado/i,
    'formato observado em uso interno não pode ser declarado verificado');
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
