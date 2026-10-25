import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGovernance, validatePackage } from '../tools/rules.mjs';

function pacote({ companyBudget = null, agents = [] } = {}) {
  return {
    slug: 'teste',
    company: {
      path: 'COMPANY.md',
      frontmatter: {
        slug: 'teste', license: 'MIT',
        metadata: { human_gates: [], ...(companyBudget ? { budget: companyBudget } : {}) },
      },
      body: '',
    },
    agents: agents.map((a) => ({
      path: `agents/${a.slug}/AGENTS.md`,
      slug: a.slug,
      frontmatter: {
        slug: a.slug, reportsTo: a.reportsTo ?? null, skills: a.skills ?? ['x'],
        metadata: {
          ...(a.boundary === null ? {} : { boundary: a.boundary ?? { can: ['ler'], cannot: [] } }),
          capabilities: a.capabilities ?? {},
          ...(a.persona === null ? {} : { persona: a.persona ?? { display_name: 'N', icon: '🧪' } }),
        },
      },
      body: a.body ?? '',
    })),
    skills: [], teams: [], tasks: [], warnings: [],
  };
}

const codigos = (pkg) => validateGovernance(pkg).map((e) => e.code);

test('E06: papel sem boundary falha', () => {
  assert.ok(codigos(pacote({ agents: [{ slug: 'a', boundary: null }] })).includes('E06'));
});

test('E06: papel com boundary passa', () => {
  assert.ok(!codigos(pacote({ agents: [{ slug: 'a' }] })).includes('E06'));
});

test('E07: papel que escreve sem orçamento nenhum falha', () => {
  const erros = validateGovernance(pacote({
    agents: [{ slug: 'a', capabilities: { write: ['code'] } }],
  }));
  const e = erros.find((x) => x.code === 'E07');
  assert.ok(e, 'E07 emitido');
  assert.match(e.message, /or[çc]amento/i);
});

test('E07: papel que escreve com orçamento próprio passa', () => {
  assert.ok(!codigos(pacote({
    agents: [{ slug: 'a', capabilities: {
      write: ['code'],
      budget: { currency: 'BRL', monthly_cap: 100, alert_at: 0.7, alert_to: 'a' },
    } }],
  })).includes('E07'));
});

test('E07: papel que escreve com orçamento herdado da empresa passa', () => {
  assert.ok(!codigos(pacote({
    companyBudget: { currency: 'BRL', monthly_cap: 1000, alert_at: 0.7, alert_to: 'a' },
    agents: [{ slug: 'a', capabilities: { write: ['code'] } }],
  })).includes('E07'));
});

test('E07: papel que só lê não precisa de orçamento', () => {
  assert.ok(!codigos(pacote({
    agents: [{ slug: 'a', capabilities: { read: ['repository'] } }],
  })).includes('E07'));
});

test('E07: papel com execute.allow não vazio precisa de orçamento', () => {
  assert.ok(codigos(pacote({
    agents: [{ slug: 'a', capabilities: { execute: { allow: ['npm test*'], deny: [] } } }],
  })).includes('E07'));
});

test('E08: alert_to que não é papel do pacote falha', () => {
  assert.ok(codigos(pacote({
    agents: [{ slug: 'a', capabilities: {
      write: ['code'],
      budget: { currency: 'BRL', monthly_cap: 100, alert_at: 0.7, alert_to: 'fantasma' },
    } }],
  })).includes('E08'));
});

test('E08: teto sem alert_to falha — teto que ninguém lê não é teto', () => {
  assert.ok(codigos(pacote({
    agents: [{ slug: 'a', capabilities: {
      write: ['code'], budget: { currency: 'BRL', monthly_cap: 100 },
    } }],
  })).includes('E08'));
});

test('E09: chave de API literal no corpo falha', () => {
  assert.ok(codigos(pacote({
    agents: [{ slug: 'a', body: 'use sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' }],
  })).includes('E09'));
});

test('E09: caminho absoluto de máquina falha', () => {
  // Usuário GENÉRICO de propósito: o acervo é público, e nome de usuário
  // real de quem escreveu o teste é justamente o tipo de dado que a regra
  // existe para manter fora do repositório. O padrão dispara igual.
  assert.ok(codigos(pacote({
    agents: [{ slug: 'a', body: 'leia /Users/usuario/segredos/token.txt' }],
  })).includes('E09'));
});

test('E09: nome de variável de ambiente é permitido', () => {
  assert.ok(!codigos(pacote({
    agents: [{ slug: 'a', body: 'o segredo chega em ANTHROPIC_API_KEY' }],
  })).includes('E09'));
});

test('E10: cannot nega deploy mas execute.allow permite kubectl apply', () => {
  const erros = validateGovernance(pacote({
    agents: [{ slug: 'a',
      boundary: { can: ['ler'], cannot: ['autorizar deploy em produção'] },
      capabilities: {
        write: ['code'],
        execute: { allow: ['kubectl apply*'], deny: [] },
        budget: { currency: 'BRL', monthly_cap: 1, alert_at: 0.7, alert_to: 'a' },
      } }],
  }));
  const e = erros.find((x) => x.code === 'E10');
  assert.ok(e, 'E10 emitido');
  assert.match(e.message, /kubectl apply/);
});

test('E10: cannot nega merge mas execute.allow permite git merge', () => {
  assert.ok(codigos(pacote({
    agents: [{ slug: 'a',
      boundary: { can: ['ler'], cannot: ['fazer merge do próprio trabalho'] },
      capabilities: {
        execute: { allow: ['git merge*'], deny: [] },
        budget: { currency: 'BRL', monthly_cap: 1, alert_at: 0.7, alert_to: 'a' },
      } }],
  })).includes('E10'));
});

test('E10: prosa e capacidade coerentes passam', () => {
  assert.ok(!codigos(pacote({
    agents: [{ slug: 'a',
      boundary: { can: ['ler'], cannot: ['fazer deploy'] },
      capabilities: {
        execute: { allow: ['git log*'], deny: ['kubectl*'] },
        budget: { currency: 'BRL', monthly_cap: 1, alert_at: 0.7, alert_to: 'a' },
      } }],
  })).includes('E10'));
});

test('E11: papel que escreve código e aprova o próprio trabalho falha', () => {
  const erros = validateGovernance(pacote({
    agents: [{ slug: 'a', capabilities: {
      write: ['code'], approve: ['deploy'],
      budget: { currency: 'BRL', monthly_cap: 1, alert_at: 0.7, alert_to: 'a' },
    } }],
  }));
  const e = erros.find((x) => x.code === 'E11');
  assert.ok(e, 'E11 emitido');
  assert.match(e.message, /segrega/i);
});

test('E11: quem aprova sem escrever passa', () => {
  assert.ok(!codigos(pacote({
    agents: [{ slug: 'a', capabilities: { read: ['repository'], approve: ['deploy'] } }],
  })).includes('E11'));
});

test('W03: papel sem persona avisa, não falha', () => {
  const { errors, warnings } = validatePackage(pacote({
    agents: [{ slug: 'a', persona: null }],
  }));
  assert.ok(warnings.some((w) => w.code === 'W03'));
  assert.ok(!errors.some((e) => e.code.startsWith('E')) || errors.length === 0);
});

test('W04: papel sem skills avisa', () => {
  const { warnings } = validatePackage(pacote({ agents: [{ slug: 'a', skills: [] }] }));
  assert.ok(warnings.some((w) => w.code === 'W04'));
});

test('validatePackage junta estruturais e de governança', () => {
  const pkg = pacote({ agents: [{ slug: 'a', boundary: null }] });
  pkg.company.frontmatter.license = undefined;
  const { errors } = validatePackage(pkg);
  const cs = errors.map((e) => e.code);
  assert.ok(cs.includes('E01'), 'estrutural presente');
  assert.ok(cs.includes('E06'), 'governança presente');
});

test('validatePackage propaga os avisos de normalização que vieram no pkg', () => {
  const pkg = pacote({ agents: [{ slug: 'a' }] });
  pkg.warnings = [{ code: 'W01', path: 'fronteira', message: 'alias', file: 'x' }];
  const { warnings } = validatePackage(pkg);
  assert.ok(warnings.some((w) => w.code === 'W01'));
});
