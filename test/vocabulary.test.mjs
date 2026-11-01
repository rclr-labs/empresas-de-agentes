import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOCABULARY, ALIASES, VERSION } from '../capabilities/v1.mjs';

test('a versão do vocabulário é capabilities/v1', () => {
  assert.equal(VERSION, 'capabilities/v1');
});

test('read declara exatamente os seis alvos da spec', () => {
  assert.deepEqual(VOCABULARY.read, [
    'repository', 'documentation', 'audit_trail',
    'test_evidence', 'database', 'web',
  ]);
});

test('write declara exatamente os cinco alvos da spec', () => {
  assert.deepEqual(VOCABULARY.write, [
    'code', 'documentation', 'test_evidence', 'report', 'pull_request',
  ]);
});

test('o vocabulário é congelado — crescer exige nova versão', () => {
  assert.throws(() => { VOCABULARY.read.push('filesystem'); });
});

test('todo alias pt-BR aponta para chave canônica conhecida', () => {
  const canonicos = new Set([
    'persona', 'boundary', 'capabilities', 'memory', 'context',
    'budget', 'human_gates', 'can', 'cannot', 'currency',
    'monthly_cap', 'alert_at', 'alert_to', 'capability_vocabulary',
    'task_protocol',
  ]);
  for (const [alias, canonico] of Object.entries(ALIASES)) {
    assert.ok(canonicos.has(canonico), `alias ${alias} → ${canonico} desconhecido`);
  }
});

test('fronteira, orcamento e capacidades estão entre os aliases', () => {
  assert.equal(ALIASES.fronteira, 'boundary');
  assert.equal(ALIASES.orcamento, 'budget');
  assert.equal(ALIASES.capacidades, 'capabilities');
  assert.equal(ALIASES.pode, 'can');
  assert.equal(ALIASES.nao_pode, 'cannot');
  assert.equal(ALIASES.teto_mensal, 'monthly_cap');
  assert.equal(ALIASES.portoes_humanos, 'human_gates');
});

test('os CONTÊINERES VOCABULARY e ALIASES também são congelados', () => {
  assert.ok(Object.isFrozen(VOCABULARY), 'VOCABULARY congelado');
  assert.ok(Object.isFrozen(ALIASES), 'ALIASES congelado');
  assert.throws(() => { VOCABULARY.novoVerbo = []; });
  assert.throws(() => { ALIASES.novoAlias = 'x'; });
});

test('task_protocol_on_runtime declara os cinco mecanismos de status', () => {
  assert.deepEqual(VOCABULARY.task_protocol_on_runtime, [
    'wake_blocked', 'create_followup_issue', 'wake_on_unblock',
    'notify_assignee_chain', 'escalate_to_role',
  ]);
  assert.throws(() => { VOCABULARY.task_protocol_on_runtime.push('x'); });
});

test('protocolo_de_tarefa está entre os aliases', () => {
  assert.equal(ALIASES.protocolo_de_tarefa, 'task_protocol');
});
