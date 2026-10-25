import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAliases } from '../tools/rules.mjs';

test('renomeia fronteira/pode/nao_pode para boundary/can/cannot', () => {
  const { meta } = normalizeAliases({
    fronteira: { pode: ['ler'], nao_pode: ['deployar'] },
  });
  assert.deepEqual(meta, { boundary: { can: ['ler'], cannot: ['deployar'] } });
});

test('renomeia orcamento e seus campos internos', () => {
  const { meta } = normalizeAliases({
    orcamento: { moeda: 'BRL', teto_mensal: 400, alerta_em: 0.7, destinatario_do_alerta: 'coordenacao' },
  });
  assert.deepEqual(meta.budget, {
    currency: 'BRL', monthly_cap: 400, alert_at: 0.7, alert_to: 'coordenacao',
  });
});

test('emite um aviso por alias encontrado, com o caminho', () => {
  const { warnings } = normalizeAliases({ fronteira: { pode: ['ler'] } });
  const caminhos = warnings.map((w) => w.path);
  assert.ok(caminhos.includes('fronteira'));
  assert.ok(caminhos.includes('fronteira.pode'));
  assert.ok(warnings.every((w) => w.code === 'W01'));
});

test('não emite aviso quando já está canônico', () => {
  const { warnings } = normalizeAliases({ boundary: { can: ['ler'] } });
  assert.deepEqual(warnings, []);
});

test('não muta a entrada', () => {
  const entrada = { fronteira: { pode: ['ler'] } };
  normalizeAliases(entrada);
  assert.deepEqual(entrada, { fronteira: { pode: ['ler'] } });
});

test('normaliza dentro de array de objetos', () => {
  const { meta } = normalizeAliases({ portoes_humanos: [{ id: 'x', descricao: 'y' }] });
  assert.equal(meta.human_gates[0].id, 'x');
});

test('canônico tem precedência quando ambos existem', () => {
  const { meta, warnings } = normalizeAliases({
    boundary: { can: ['canonico'] },
    fronteira: { pode: ['alias'] },
  });
  assert.deepEqual(meta.boundary.can, ['canonico']);
  assert.ok(warnings.some((w) => w.code === 'W02'));
});
