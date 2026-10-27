import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStructure, validateGovernance, validatePackage } from '../tools/rules.mjs';

function pacote({ companyBudget = null, agents = [], gates = [] } = {}) {
  return {
    slug: 'teste',
    company: {
      path: 'COMPANY.md',
      frontmatter: {
        slug: 'teste', license: 'MIT',
        metadata: { human_gates: gates, ...(companyBudget ? { budget: companyBudget } : {}) },
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

// Pacote de um agente só, espelho de test/fixtures/pacote-minimo/ em
// memória — para os testes de E15/W05, que só precisam de um papel com
// capabilities.network e execute.allow controláveis, sem o resto do
// aparato de `pacote()` acima (gates, hierarquia, orçamento).
function pacoteMinimo({ slug, capabilities = {}, body = '' } = {}) {
  return {
    slug,
    dir: null,
    company: {
      path: 'COMPANY.md',
      frontmatter: { slug, license: 'MIT', metadata: { human_gates: [] } },
      body: '',
    },
    agents: [{
      path: `agents/${slug}/AGENTS.md`,
      slug,
      frontmatter: {
        slug, reportsTo: null, skills: ['x'],
        metadata: {
          boundary: { can: ['ler'], cannot: [] },
          capabilities,
          persona: { display_name: 'N', icon: '🧪' },
        },
      },
      body,
    }],
    skills: [], teams: [], tasks: [], projects: [], warnings: [], problems: [],
  };
}

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
  const e = validateGovernance(pacote({
    agents: [{ slug: 'a', capabilities: {
      write: ['code'], budget: { currency: 'BRL', monthly_cap: 100 },
    } }],
  })).find((x) => x.code === 'E08');
  assert.ok(e);
  assert.match(e.message, /sem alert_to/i, 'a mensagem tem de distinguir o ramo');
});

test('E08: orçamento válido com alert_to resolvível NÃO dispara', () => {
  assert.ok(!validateGovernance(pacote({
    agents: [{ slug: 'a', capabilities: {
      write: ['code'],
      budget: { currency: 'BRL', monthly_cap: 100, alert_at: 0.7, alert_to: 'a' },
    } }],
  })).some((x) => x.code === 'E08'));
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

test('E09: segredo no COMPANY.md falha — não basta varrer os agentes', () => {
  // Especime de caminho absoluto, não de chave sk-ant-*: o hook de
  // secret-scan deste repositório bloqueia commit cujo diff contenha o
  // padrão sk-ant-* literal, mesmo em fixture de teste. O padrão de
  // caminho absoluto já cobre o mesmo ponto — E09 varrendo COMPANY.md —
  // sem colidir com o scanner. A chave sk-ant-* já é exercida pelo teste
  // 'E09: chave de API literal no corpo falha', sobre um agente.
  const pkg = pacote({ agents: [{ slug: 'a' }] });
  pkg.company.body = 'segredo em /Users/alguem/segredos/token.txt';
  const e = validateGovernance(pkg).find((x) => x.code === 'E09');
  assert.ok(e, 'E09 tem de varrer o COMPANY.md');
  assert.equal(e.where, 'COMPANY.md', 'e apontar o arquivo certo');
});

test('E09: caminho absoluto num SKILL.md falha', () => {
  const pkg = pacote({ agents: [{ slug: 'a' }] });
  pkg.skills = [{ path: 'skills/s/SKILL.md', slug: 's', frontmatter: { name: 's' },
    body: 'leia /Users/outro/.ssh/id_rsa' }];
  const e = validateGovernance(pkg).find((x) => x.code === 'E09');
  assert.ok(e, 'E09 tem de varrer skills, teams e tasks também');
  assert.equal(e.where, 'skills/s/SKILL.md');
});

test('E09 varre projects/ e as tarefas aninhadas nele', () => {
  // Especime genérico de caminho absoluto, mesmo padrão dos dois testes
  // acima — não é sobre QUAL padrão dispara, é sobre o ESCOPO: projects/
  // é uma coleção aninhada (PROJECT.md com tasks/ dentro), e ficou de fora
  // tanto do loader quanto do E09 até ser medido contra o acervo real.
  const pkg = pacote({ agents: [{ slug: 'a' }] });
  pkg.projects = [{ path: 'projects/p/PROJECT.md', slug: 'p', frontmatter: { name: 'p' },
    body: 'leia /Users/outro/.ssh/id_rsa',
    tasks: [{ path: 'projects/p/tasks/t/TASK.md', slug: 't', frontmatter: { name: 't' }, body: '' }] }];
  const e = validateGovernance(pkg).find((x) => x.code === 'E09');
  assert.ok(e, 'E09 tem de varrer projects/');
  assert.equal(e.where, 'projects/p/PROJECT.md');
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

test('E04: portão com acento resolve pelo slug natural', () => {
  const pkg = pacote({
    gates: ['deploy em produção', 'remoção de dado de produção'],
    agents: [{ slug: 'a', capabilities: { approve: ['deploy-em-producao', 'remocao-de-dado-de-producao'] } }],
  });
  const e04 = validateStructure(pkg).filter((x) => x.code === 'E04');
  assert.deepEqual(e04, [], e04.map((x) => x.message).join('\n'));
});

test('E05: um ciclo é reportado uma vez, não uma por nó', () => {
  const erros = validateStructure(pacote({
    agents: [
      { slug: 'a', reportsTo: 'b' },
      { slug: 'b', reportsTo: 'c' },
      { slug: 'c', reportsTo: 'a' },
    ],
  }));
  const ciclos = erros.filter((e) => e.code === 'E05' && /ciclo/i.test(e.message));
  assert.equal(ciclos.length, 1, 'três nós, um ciclo, um erro');
});

test('E15: papel com comando de rede e network false é erro', () => {
  const pkg = pacoteMinimo({
    slug: 'coleta', capabilities: {
      read: ['repository'], write: ['report'],
      execute: { allow: ['curl -s*'], deny: ['sudo *'] },
      network: false,
    },
  });
  const { errors } = validatePackage(pkg);
  const e15 = errors.filter((e) => e.code === 'E15');
  assert.equal(e15.length, 1, JSON.stringify(errors, null, 2));
  assert.match(e15[0].message, /curl -s\*/);
});

test('E15: papel que lê web e nega rede é erro', () => {
  const pkg = pacoteMinimo({
    slug: 'leitor', capabilities: {
      read: ['repository', 'web'], write: ['report'],
      execute: { allow: ['rg *'], deny: ['sudo *'] }, network: false,
    },
  });
  assert.equal(validatePackage(pkg).errors.filter((e) => e.code === 'E15').length, 1);
});

test('E15: o mesmo papel com domínio declarado passa', () => {
  const pkg = pacoteMinimo({
    slug: 'coleta', capabilities: {
      read: ['repository'], write: ['report'],
      execute: { allow: ['curl -s*'], deny: ['sudo *'] },
      network: ['api.exemplo.com.br'],
    },
  });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E15'), []);
});

test('W05: domínio + comando de rede sem a ressalva no corpo é aviso', () => {
  const pkg = pacoteMinimo({
    slug: 'coleta', capabilities: {
      read: ['repository'], write: ['report'],
      execute: { allow: ['curl -s*'], deny: ['sudo *'] },
      network: ['api.exemplo.com.br'],
    },
    body: 'Você coleta evidência.\n',
  });
  const w = validatePackage(pkg).warnings.filter((x) => x.code === 'W05');
  assert.equal(w.length, 1);
  assert.match(w[0].message, /allowlist_scope/);
});

test('W05: com a ressalva no corpo, nenhum aviso', () => {
  const pkg = pacoteMinimo({
    slug: 'coleta', capabilities: {
      read: ['repository'], write: ['report'],
      execute: { allow: ['curl -s*'], deny: ['sudo *'] },
      network: ['api.exemplo.com.br'],
    },
    body: 'No Claude Code a allowlist é fronteira de SO (`allowlist_scope: os`); no OpenCode V2 e no janus `kind=cli` é `fetch-only` e o `curl` escapa.\n',
  });
  assert.deepEqual(validatePackage(pkg).warnings.filter((x) => x.code === 'W05'), []);
});
