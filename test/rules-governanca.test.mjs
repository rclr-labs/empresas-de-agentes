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
function pacoteMinimo({ slug, capabilities = {}, body = '', persona } = {}) {
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
          persona: persona ?? { display_name: 'N', icon: '🧪' },
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

// E20 — boundary PRESENTE com alguma metade vazia. Diferente de E06 (que
// cobra AUSÊNCIA de boundary): aqui o nó existe, e o defeito é a vitrine
// medir — esvaziar can/cannot pelo editor é dois cliques, e sem esta regra
// o gate certifica limpo um papel sem fronteira nenhuma. Todo caso aqui
// precisa de `boundary` PRESENTE para não morrer na guarda de E06 antes de
// chegar na regra que o teste quer provar.
test('E20: cannot vazio com can preenchido falha', () => {
  const erros = codigos(pacote({
    agents: [{ slug: 'a', boundary: { can: ['ler código'], cannot: [] } }],
  }));
  assert.ok(erros.includes('E20'), erros.join(','));
  assert.ok(!erros.includes('E06'), 'E06 não deve duplicar: boundary existe');
});

test('E20: can vazio com cannot preenchido falha — as duas metades são exigidas', () => {
  const erros = codigos(pacote({
    agents: [{ slug: 'a', boundary: { can: [], cannot: ['fazer deploy'] } }],
  }));
  assert.ok(erros.includes('E20'), erros.join(','));
});

test('E20: can e cannot vazios falha', () => {
  const erros = codigos(pacote({
    agents: [{ slug: 'a', boundary: { can: [], cannot: [] } }],
  }));
  assert.ok(erros.includes('E20'), erros.join(','));
});

test('E20: item presente mas em branco conta como vazio', () => {
  const comEspacos = codigos(pacote({
    agents: [{ slug: 'a', boundary: { can: ['ler código'], cannot: ['   '] } }],
  }));
  assert.ok(comEspacos.includes('E20'), comEspacos.join(','));

  const comVazio = codigos(pacote({
    agents: [{ slug: 'a', boundary: { can: ['ler código'], cannot: [''] } }],
  }));
  assert.ok(comVazio.includes('E20'), comVazio.join(','));
});

test('E20: cannot como string em vez de lista também conta como vazio — não duplica guarda de E19', () => {
  // E19 não valida o TIPO de boundary.can/cannot hoje (só capabilities.*) —
  // medido antes de escrever esta regra. `listaDeTexto` trata não-array
  // como lista vazia, então essa forma cai na mesma guarda de "vazio", sem
  // precisar de uma checagem de tipo própria para boundary.
  const erros = codigos(pacote({
    agents: [{ slug: 'a', boundary: { can: ['ler código'], cannot: '' } }],
  }));
  assert.ok(erros.includes('E20'), erros.join(','));
});

test('E20: as duas metades preenchidas com texto real passa', () => {
  const erros = codigos(pacote({
    agents: [{ slug: 'a', boundary: { can: ['ler código'], cannot: ['fazer deploy'] } }],
  }));
  assert.ok(!erros.includes('E20'), erros.join(','));
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
    // boundary explícito e com as duas metades preenchidas: o default de
    // `pacote()` tem `cannot: []`, e sem este override o teste colidiria
    // com E20 (metade vazia) — um defeito que este teste não quer provar.
    agents: [{ slug: 'a', persona: null, boundary: { can: ['ler código'], cannot: ['fazer deploy'] } }],
  }));
  assert.ok(warnings.some((w) => w.code === 'W03'));
  assert.ok(!errors.some((e) => e.code.startsWith('E')) || errors.length === 0);
});

// W03 — ruling de 2026-10-27 (fix-round 1 da Task 4): existência de `icon`
// e `pronouns` é degradação de vitrine, não defeito de governança — mesma
// classe de `display_name` ausente, que já era W03 antes desta tarefa.
// E18 cobre só o que está DECLARADO e está ERRADO (ASCII, 3 linhas, corpo);
// nunca existência.
test('W03: persona sem icon avisa, não é E18', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', pronouns: 'ele/dele',
    headline: 'Escreve código', background: ['a', 'b', 'c'],
    signature_question: 'E se faltar?' } });
  const { errors, warnings } = validatePackage(pkg);
  assert.deepEqual(errors.filter((e) => e.code === 'E18'), []);
  assert.ok(warnings.some((w) => w.code === 'W03' && /icon/.test(w.message)));
});

test('W03: persona sem pronouns avisa, não é E18', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', icon: '🔧',
    headline: 'Escreve código', background: ['a', 'b', 'c'],
    signature_question: 'E se faltar?' } });
  const { errors, warnings } = validatePackage(pkg);
  assert.deepEqual(errors.filter((e) => e.code === 'E18'), []);
  assert.ok(warnings.some((w) => w.code === 'W03' && /pronouns/.test(w.message)));
});

test('W03: persona completa (display_name, icon, pronouns) não avisa', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código', background: ['a', 'b', 'c'],
    signature_question: 'E se faltar?' } });
  const { warnings } = validatePackage(pkg);
  assert.deepEqual(warnings.filter((w) => w.code === 'W03'), []);
});

// W03/E18 — ruling de 2026-10-27 (fix-round 2 da Task 4), corrigindo uma
// lacuna do ruling do round 1: `background` AUSENTE é W03 (persona não
// entra no prompt, exceto signature_question — background custa token e
// não muda comportamento, serve só o humano e a vitrine), nunca E18.
// `background` DECLARADO com contagem errada continua E18, nunca W03 — os
// dois lados desta mesma separação, num par de testes.
test('W03/E18: background ausente avisa (W03), zero E18', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código',
    signature_question: 'E se faltar?' } });
  const { errors, warnings } = validatePackage(pkg);
  assert.deepEqual(errors.filter((e) => e.code === 'E18'), [],
    `background ausente é W03, não E18: ${JSON.stringify(errors, null, 2)}`);
  assert.ok(warnings.some((w) => w.code === 'W03' && /background/.test(w.message)));
});

test('W03/E18: background declarado com 2 linhas é E18, zero W03', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código', background: ['a', 'b'],
    signature_question: 'E se faltar?' } });
  const { errors, warnings } = validatePackage(pkg);
  assert.equal(errors.filter((e) => e.code === 'E18').length, 1);
  assert.deepEqual(warnings.filter((w) => w.code === 'W03' && /background/.test(w.message)), [],
    `background declarado, mesmo com contagem errada, não é ausência: ${JSON.stringify(warnings, null, 2)}`);
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

test('E04: gate com acento resolve pelo slug natural', () => {
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

test('E15: nmap com network false também é erro — a lacuna de 2026-10-27', () => {
  // fix round 1 da revisão: curl mordia, nmap/nuclei/ffuf não. Mesmo
  // formato do teste de curl acima, só para provar que a lacuna foi
  // fechada — não que a regra em si mudou de forma.
  const pkg = pacoteMinimo({
    slug: 'scan', capabilities: {
      read: ['repository'], write: ['report'],
      execute: { allow: ['nmap -sV*'], deny: ['sudo *'] },
      network: false,
    },
  });
  const e15 = validatePackage(pkg).errors.filter((e) => e.code === 'E15');
  assert.equal(e15.length, 1, JSON.stringify(validatePackage(pkg).errors, null, 2));
  assert.match(e15[0].message, /nmap -sV\*/);
});

test('E15: npx artillery com network false é erro — o runner não pode esconder o comando', () => {
  // fix round 2 da revisão: k6/artillery entraram em COMANDOS_DE_REDE, mas
  // o risco de verdade era o extrator de runner — `npx artillery*`
  // classificava "local" porque `/^npx\s/i` batia primeiro, sem nunca
  // testar "artillery". Este é o caso exato que passava verde antes da
  // correção: execute.allow só com o comando embrulhado em npx.
  const pkg = pacoteMinimo({
    slug: 'carga', capabilities: {
      read: ['repository'], write: ['report'],
      execute: { allow: ['npx artillery*'], deny: ['sudo *'] },
      network: false,
    },
  });
  const e15 = validatePackage(pkg).errors.filter((e) => e.code === 'E15');
  assert.equal(e15.length, 1, JSON.stringify(validatePackage(pkg).errors, null, 2));
  assert.match(e15[0].message, /npx artillery\*/);
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

test('E16: write pull_request sem git push é erro', () => {
  const pkg = pacoteMinimo({ slug: 'dev', capabilities: {
    read: ['repository'], write: ['code', 'pull_request'],
    execute: { allow: ['npm test*'], deny: ['sudo *'] }, network: false } });
  assert.equal(validatePackage(pkg).errors.filter((e) => e.code === 'E16').length, 1);
});

test('E16: git push sem write pull_request é erro — a direção inversa', () => {
  // deny já nega --force aqui de propósito: isolar a direção sob teste
  // (write sem pull_request) da terceira perna (force-deny ausente),
  // que tem teste próprio mais abaixo.
  const pkg = pacoteMinimo({ slug: 'dev', capabilities: {
    read: ['repository'], write: ['code'],
    execute: { allow: ['git push*'], deny: ['git push --force*', 'sudo *'] }, network: false } });
  const e16 = validatePackage(pkg).errors.filter((e) => e.code === 'E16');
  assert.equal(e16.length, 1);
  assert.match(e16[0].message, /pull_request/);
});

test('E16: os dois juntos passam', () => {
  const pkg = pacoteMinimo({ slug: 'dev', capabilities: {
    read: ['repository'], write: ['code', 'pull_request'],
    execute: { allow: ['git push*'], deny: ['git push --force*', 'sudo *'] }, network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E16'), []);
});

test('E16: git push sem deny de force é erro — a terceira perna', () => {
  const pkg = pacoteMinimo({ slug: 'dev', capabilities: {
    read: ['repository'], write: ['code', 'pull_request'],
    execute: { allow: ['git push*'], deny: ['sudo *'] }, network: false } });
  const e16 = validatePackage(pkg).errors.filter((e) => e.code === 'E16');
  assert.equal(e16.length, 1);
  assert.match(e16[0].message, /force/);
});

test('E16: git push com deny de force é limpo — a terceira perna satisfeita', () => {
  const pkg = pacoteMinimo({ slug: 'dev', capabilities: {
    read: ['repository'], write: ['code', 'pull_request'],
    execute: { allow: ['git push*'], deny: ['git push --force*', 'sudo *'] }, network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E16'), []);
});

test('E16: npx gh pr create* sem write pull_request é erro — o runner não esconde o comando', () => {
  const pkg = pacoteMinimo({ slug: 'dev', capabilities: {
    read: ['repository'], write: ['code'],
    execute: { allow: ['npx gh pr create*'], deny: ['sudo *'] }, network: false } });
  const e16 = validatePackage(pkg).errors.filter((e) => e.code === 'E16');
  assert.ok(e16.some((e) => /pull_request/.test(e.message)),
    JSON.stringify(e16, null, 2));
});

// Achado da revisão da Task 2 (tools/rules.mjs:504): a terceira perna
// disparava em `temPush`, que inclui `gh pr create*` — um comando que não
// aceita `--force`. Um papel com só `gh pr create*` em allow e SEM
// `git push*` não deve ser mandado negar uma flag que o comando nem tem;
// a perna 3 agora ancora só em `/^git push/` sobre o padrão descascado.
test('E16: só "gh pr create*" sem "git push*" não recebe a terceira perna (force-deny)', () => {
  const pkg = pacoteMinimo({ slug: 'dev', capabilities: {
    read: ['repository'], write: ['code', 'pull_request'],
    execute: { allow: ['gh pr create*'], deny: ['sudo *'] }, network: false } });
  const e16 = validatePackage(pkg).errors.filter((e) => e.code === 'E16');
  assert.ok(!e16.some((e) => /force/.test(e.message)),
    `papel só com "gh pr create*" não deveria receber a perna de force-deny: ${JSON.stringify(e16, null, 2)}`);
  // As outras pernas continuam corretas: write já inclui pull_request e o
  // comando já está presente em allow, então nenhum E16 deveria sobrar.
  assert.deepEqual(e16, []);
});

test('E17: cliente SQL sem nenhum deny é erro', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c*'], deny: ['sudo *'] }, network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1);
  assert.match(e17[0].message, /psql/);
});

test('E17: deny só em maiúscula é erro — SQL não é sensível a caixa', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c*'],
      deny: ['psql*DROP*', 'psql*TRUNCATE*', 'psql*DELETE*', 'sudo *'] },
    network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1, 'a grafia minúscula não está coberta');
  assert.match(e17[0].message, /minúscula|lowercase|drop/i);
});

test('E17: trio completo nas duas caixas passa', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c*'], deny: [
      'psql*DROP*', 'psql*drop*', 'psql*TRUNCATE*', 'psql*truncate*',
      'psql*DELETE*', 'psql*delete*', 'sudo *'] },
    network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E17'), []);
});

test('E17: dois clientes no allow exigem o trio para cada um', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c*', 'mysql -e*'], deny: [
      'psql*DROP*', 'psql*drop*', 'psql*TRUNCATE*', 'psql*truncate*',
      'psql*DELETE*', 'psql*delete*', 'sudo *'] },
    network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1);
  assert.match(e17[0].message, /mysql/);
});

test('E17: cliente SQL atrás de runner exige o mesmo trio — o runner não esconde o comando', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['npx psql -c*'], deny: ['sudo *'] }, network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1);
  assert.match(e17[0].message, /psql/);
});

// Fix-round 1 (achado do coordenador, 2026-10-27): a checagem de cobertura
// media CONTENÇÃO DE TOKEN — "o padrão começa com o cliente e contém a
// palavra" — e isso aceitava uma string de prosa como se fosse glob que
// bloqueia algo. Este teste é o caso exato: o padrão de "deny" para DROP foi
// substituído por um comentário, que não é glob válido e não casaria
// nenhum comando real pelo hook de `tools/writers.mjs`.
test('E17: deny com prosa em vez de glob não cobre nada — contenção de token não é efeito', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c*'], deny: [
      'psql nunca rode DROP em producao', 'psql*drop*',
      'psql*TRUNCATE*', 'psql*truncate*', 'psql*DELETE*', 'psql*delete*',
      'sudo *'] },
    network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1,
    `a prosa não casa nenhum comando como glob, logo DROP (maiúsculo) continua descoberto: ${JSON.stringify(e17, null, 2)}`);
  assert.match(e17[0].message, /DROP/);
});

// O espelho do teste acima: um deny MAIS LARGO que o pedido (bloqueia todo
// "psql", não só o trio) é cobertura real — medir por efeito, não por
// forma, tem de aceitar isto. A versão por contenção de token reprovaria,
// porque "psql*" não contém a palavra "DROP"/"TRUNCATE"/"DELETE".
test('E17: deny "psql*" sozinho cobre o trio por ser mais largo — cobertura por efeito, não por forma', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c*'], deny: ['psql*', 'sudo *'] }, network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E17'), []);
});

// Fix-round 2 (achado do revisor, 2026-10-27): o representativo cravava a
// flag `-c` para TODO cliente, inclusive `mysql`, cuja forma real no
// acervo é `-e`. Os dois testes abaixo são o repro exato, nas duas
// direções: `deny` ancorado numa flag que o `allow` real nunca invoca
// (`-c`, quando o `allow` é `-e`) tem de ser acusado; `deny` ancorado na
// flag que o `allow` de fato usa (`-e`) tem de passar limpo.
test('E17: allow "mysql -e*" com deny ancorado em "-c" é erro — a flag errada não cobre nada', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['mysql -e*'], deny: [
      'mysql -c*DROP*', 'mysql -c*drop*', 'mysql -c*TRUNCATE*',
      'mysql -c*truncate*', 'mysql -c*DELETE*', 'mysql -c*delete*',
      'sudo *'] },
    network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1,
    `o deny está ancorado em "-c", mas o allow real é "-e" — nenhum dos padrões casa a invocação de verdade: ${JSON.stringify(e17, null, 2)}`);
  assert.match(e17[0].message, /mysql/);
});

test('E17: allow "mysql -e*" com deny ancorado em "-e" passa limpo — a flag certa cobre', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['mysql -e*'], deny: [
      'mysql -e*DROP*', 'mysql -e*drop*', 'mysql -e*TRUNCATE*',
      'mysql -e*truncate*', 'mysql -e*DELETE*', 'mysql -e*delete*',
      'sudo *'] },
    network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E17'), []);
});

// Fix-round 3 (achado do coordenador, 2026-10-27): entrada de `allow` SEM
// curinga regredia para "fora da exigência de deny" — a entrada literal
// já é a sentença destrutiva (`DROP` está escrita nela), e o round 2
// desistia de checá-la por não ter onde injetar um curinga que nunca
// existiu. Os dois testes abaixo são o repro exato.
test('E17: allow literal já destrutivo sem nenhum deny de SQL é erro — a entrada já é a sentença', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c "DROP TABLE users"'], deny: ['sudo *'] }, network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1,
    `a entrada literal contém "DROP" e não há deny de SQL nenhum: ${JSON.stringify(e17, null, 2)}`);
  assert.match(e17[0].message, /psql/);
});

test('E17: allow literal já destrutivo coberto por deny largo passa limpo — mesma pergunta, por efeito', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c "DROP TABLE users"'], deny: ['psql*', 'sudo *'] }, network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E17'), []);
});

// O caso que NÃO muda: entrada com curinga segue com o comportamento do
// round 2 — prova de que a correção acima não regrediu o que já estava
// certo (a derivação do representativo a partir do próprio allow).
test('E17: entrada com curinga continua derivando o representativo do allow, sem regressão', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql --command*'], deny: [
      'psql --command*DROP*', 'psql --command*drop*',
      'psql --command*TRUNCATE*', 'psql --command*truncate*',
      'psql --command*DELETE*', 'psql --command*delete*',
      'sudo *'] },
    network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E17'), []);
});

// O negativo do mesmo par: `psql --command*` com o trio ancorado em `-c`,
// uma flag que ESTE allow nunca invoca. É o espelho do caso `mysql -e*`/
// `-c`, com a forma longa no lugar da curta — a flag cravada do round 1
// casaria aqui e certificaria cobertura inexistente.
test('E17: allow "psql --command*" com deny ancorado em "-c" é erro — a forma longa não é a curta', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql --command*'], deny: [
      'psql -c*DROP*', 'psql -c*drop*', 'psql -c*TRUNCATE*',
      'psql -c*truncate*', 'psql -c*DELETE*', 'psql -c*delete*',
      'sudo *'] },
    network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1,
    `o deny está ancorado em "-c" e o allow invoca "--command": nenhum padrão casa: ${JSON.stringify(e17, null, 2)}`);
  assert.match(e17[0].message, /psql --command\*/);
});

// Fix-round 4 (achado da revisão, 2026-10-27): a regra passou a perguntar,
// POR ENTRADA de `allow`, "esta entrada pode invocar comando destrutivo? e
// se pode, existe deny que o bloqueia?". Os testes abaixo são as bordas que
// essa formulação resolve e que a anterior errava.

// Entrada literal SEM verbo destrutivo: sem `*`, o shell só pode rodar
// exatamente essa string, e `DROP` é estruturalmente inalcançável ali. A
// versão anterior acusava e exigia cobertura — e a única forma de silenciar
// era `deny: ['psql --version']`, negar o que se acabou de permitir: a
// defesa decorativa exata que E17 existe para caçar.
test('E17: allow literal sem verbo destrutivo não exige deny nenhum', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql --version'], deny: ['sudo *'] }, network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E17'), [],
    '"psql --version" não tem curinga: nenhum comando destrutivo é alcançável a partir dela');
});

// O agravante do mesmo achado: `faltando` era um Set por CLIENTE, logo a
// entrada inofensiva contaminava a entrada irmã JÁ CORRETAMENTE COBERTA.
// Aqui `psql -c*` tem o trio completo ancorado em `-c` — cobertura real do
// caminho destrutivo — e a presença de `psql --version` ao lado não pode
// reprovar o papel.
test('E17: entrada inofensiva não contamina a entrada irmã já coberta', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c*', 'psql --version'], deny: [
      'psql -c*DROP*', 'psql -c*drop*', 'psql -c*TRUNCATE*',
      'psql -c*truncate*', 'psql -c*DELETE*', 'psql -c*delete*',
      'sudo *'] },
    network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E17'), [],
    'o trio ancorado em "-c" cobre a entrada com curinga, e a entrada literal inofensiva não exige nada');
});

// Verbo destrutivo em CAIXA MISTA numa entrada literal. Acusar é correto, e
// não é zelo: `tools/writers.mjs` emite `case "$cmd" in $p)`, glob de shell
// case-sensitive, logo um `deny` ancorado em `DROP` ou em `drop` de fato
// NÃO bloquearia `psql -c "Drop Table users"`. A cobertura que o papel
// declara aqui é aparente, não real.
test('E17: verbo destrutivo em caixa mista não é coberto por deny de DROP/drop', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['psql -c "Drop Table users"'], deny: [
      'psql*DROP*', 'psql*drop*', 'psql*TRUNCATE*', 'psql*truncate*',
      'psql*DELETE*', 'psql*delete*', 'sudo *'] },
    network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1,
    `nem "psql*DROP*" nem "psql*drop*" casam "Drop" — o glob do hook é case-sensitive: ${JSON.stringify(e17, null, 2)}`);
  assert.match(e17[0].message, /psql/);
  // A mensagem tem de nomear a grafia COMO ESCRITA ("Drop"), não a grafia
  // canônica do vocabulário ("DROP"): dizer que falta cobrir DROP, quando o
  // que está escrito é Drop, descreve uma verificação que não correu —
  // o Minor de mensagem não-acionável que esta reestruturação fecha.
  assert.match(e17[0].message, /escreve Drop\b/);
});

// Mesma reestruturação, outra falsidade que ela desfaz (ver "Fora do
// pedido" no relatório): o representativo passou a sair da entrada CRUA, não
// da descascada de runner. `descascarRunner` detecta o cliente; o hook
// compara o comando INTEIRO (`tool_input.command`), logo o comando real aqui
// é `npx psql -c "DROP ..."`, que "psql*DROP*" não casa.
test('E17: cliente SQL atrás de runner exige deny que case o comando com o runner', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['npx psql -c*'], deny: [
      'psql*DROP*', 'psql*drop*', 'psql*TRUNCATE*', 'psql*truncate*',
      'psql*DELETE*', 'psql*delete*', 'sudo *'] },
    network: false } });
  const e17 = validatePackage(pkg).errors.filter((e) => e.code === 'E17');
  assert.equal(e17.length, 1,
    `o comando real começa com "npx", que nenhum padrão "psql*" casa: ${JSON.stringify(e17, null, 2)}`);
  assert.match(e17[0].message, /npx psql/);
});

test('E17: cliente SQL atrás de runner passa com deny que inclui o runner', () => {
  const pkg = pacoteMinimo({ slug: 'bi', capabilities: {
    read: ['database'], write: ['report'],
    execute: { allow: ['npx psql -c*'], deny: [
      'npx psql -c*DROP*', 'npx psql -c*drop*', 'npx psql -c*TRUNCATE*',
      'npx psql -c*truncate*', 'npx psql -c*DELETE*', 'npx psql -c*delete*',
      'sudo *'] },
    network: false } });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E17'), []);
});

// E18 — persona por pacote. Só o que é verificável DENTRO de um pacote só:
// `display_name` ASCII, `background` com 3 linhas, e o corpo não vazando o
// `display_name`. Unicidade de ícone/nome entre pacotes é validateAcervo,
// Task 5 — `validatePackage(pkg)` recebe um pacote só e não pode decidir
// unicidade global.
test('E18: display_name com acento é erro', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'João Silva', icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código', background: ['a', 'b', 'c'],
    signature_question: 'E se faltar?' } });
  const e18 = validatePackage(pkg).errors.filter((e) => e.code === 'E18');
  assert.equal(e18.length, 1);
  assert.match(e18[0].message, /ASCII/);
});

test('E18: background com 2 linhas é erro', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código', background: ['a', 'b'],
    signature_question: 'E se faltar?' } });
  assert.equal(validatePackage(pkg).errors.filter((e) => e.code === 'E18').length, 1);
});

test('E18: display_name no corpo do agente é erro', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código', background: ['a', 'b', 'c'],
    signature_question: 'E se faltar?' },
    body: 'Joao Silva escreve o código desta casa.\n' });
  const e18 = validatePackage(pkg).errors.filter((e) => e.code === 'E18');
  assert.equal(e18.length, 1);
  assert.match(e18[0].message, /corpo/);
});

test('E18: persona correta passa', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código', background: ['a', 'b', 'c'],
    signature_question: 'E se faltar?' }, body: 'Você escreve código.\n' });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E18'), []);
});

// Correção ao brief: a checagem é `body.includes(display_name)` — inclusão
// da STRING COMPLETA do nome ("Ana Lima"), não casamento por palavra isolada
// do primeiro nome ("Ana"). Um papel chamado "Ana Lima" cujo corpo fala de
// "analisa"/"anomalia" (que contêm "ana"/"Ana" como substring de OUTRA
// palavra, não "Ana Lima" por extenso) não pode disparar E18 por acidente —
// só dispararia se o corpo contivesse "Ana Lima" literalmente, nome e
// sobrenome juntos.
test('E18: nome que é substring de outra palavra no corpo não é falso positivo', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Ana Lima', icon: '🔎', pronouns: 'ela/dela',
    headline: 'Analisa dados', background: ['a', 'b', 'c'],
    signature_question: 'Os dados confirmam?' },
    body: 'Você analisa dados e detecta anomalia.\n' });
  assert.deepEqual(validatePackage(pkg).errors.filter((e) => e.code === 'E18'), []);
});

// Correção ao brief: background com TIPO errado (string em vez de lista) dá
// E19 (tipo de campo), não E18 — E18 só reclama de CONTEÚDO, depois que o
// tipo já está correto. Sem esta separação, um `background` string dispararia
// os dois códigos para o mesmo defeito, e quem lê o relatório veria duas
// causas onde há uma.
test('E18/E19: background como string (tipo errado) dá E19, não E18', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 'Joao Silva', icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código', background: 'uma string, não uma lista',
    signature_question: 'E se faltar?' } });
  const { errors } = validatePackage(pkg);
  assert.deepEqual(errors.filter((e) => e.code === 'E18'), [],
    `tipo errado é E19, não E18: ${JSON.stringify(errors, null, 2)}`);
  assert.equal(errors.filter((e) => e.code === 'E19').length, 1);
});

// Mesma separação, do outro lado: display_name com tipo errado (número) dá
// E19, não E18 — a checagem de ASCII pressupõe string e não pode rodar sobre
// outro tipo.
test('E18/E19: display_name como número (tipo errado) dá E19, não E18', () => {
  const pkg = pacoteMinimo({ slug: 'dev', persona: {
    display_name: 42, icon: '🔧', pronouns: 'ele/dele',
    headline: 'Escreve código', background: ['a', 'b', 'c'],
    signature_question: 'E se faltar?' } });
  const { errors } = validatePackage(pkg);
  assert.deepEqual(errors.filter((e) => e.code === 'E18'), [],
    `tipo errado é E19, não E18: ${JSON.stringify(errors, null, 2)}`);
  assert.equal(errors.filter((e) => e.code === 'E19').length, 1);
});
