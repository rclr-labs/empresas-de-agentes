import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { loadPackage, listPackages } from '../tools/schema.mjs';
import { validatePackage, validateAcervo, COMANDOS_DE_REDE, COMANDOS_LOCAIS, descascarRunner, RUNNERS } from '../tools/rules.mjs';
import { applyBinding } from '../tools/bindings.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function relatorio(nome) {
  const pkg = loadPackage(join(RAIZ, nome));
  return { pkg, ...validatePackage(pkg) };
}

test('software-house: zero erro', () => {
  const { errors } = relatorio('software-house');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
});

test('software-house: zero aviso — nada de alias, toda persona preenchida', () => {
  const { warnings } = relatorio('software-house');
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('software-house: nove papéis depois da expansão', () => {
  const { pkg } = relatorio('software-house');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(), [
    'coordenacao', 'desenvolvimento', 'desenvolvimento-backend',
    'desenvolvimento-frontend', 'desenvolvimento-fullstack',
    'portao-qualidade', 'product-owner', 'revisao', 'tech-lead',
  ]);
});

test('software-house: só backend e fullstack leem banco', () => {
  const { pkg } = relatorio('software-house');
  const comBanco = pkg.agents
    .filter((a) => (a.frontmatter.metadata.capabilities.read ?? []).includes('database'))
    .map((a) => a.slug).sort();
  assert.deepEqual(comBanco, ['desenvolvimento-backend', 'desenvolvimento-fullstack'],
    'frontend não toca banco — é a fronteira que separa os perfis');
});

test('software-house: tech-lead delega para os quatro perfis de dev e para revisao', () => {
  const { pkg } = relatorio('software-house');
  const tl = pkg.agents.find((a) => a.slug === 'tech-lead');
  assert.deepEqual(tl.frontmatter.metadata.capabilities.delegate.sort(), [
    'desenvolvimento', 'desenvolvimento-backend', 'desenvolvimento-frontend',
    'desenvolvimento-fullstack', 'revisao',
  ]);
});

test('software-house: product-owner nao prioriza capacidade e coordenacao nao escreve critério', () => {
  const { pkg } = relatorio('software-house');
  const po = pkg.agents.find((a) => a.slug === 'product-owner');
  const co = pkg.agents.find((a) => a.slug === 'coordenacao');
  // O par de risco: se as duas fronteiras convergirem, é um papel com dois nomes.
  assert.ok(po.frontmatter.metadata.boundary.cannot.some((t) => /capacidade|fila|or[çc]amento/i.test(t)),
    'o PO declara que não prioriza capacidade');
  assert.ok(co.frontmatter.metadata.boundary.cannot.some((t) => /crit[ée]rio/i.test(t)),
    'a coordenação declara que não escreve critério de aceite');
  assert.notDeepEqual(po.frontmatter.metadata.capabilities, co.frontmatter.metadata.capabilities,
    'dois papéis com as mesmas capacidades são um papel com dois nomes');
});

test('software-house: as cinco skills de stack existem e nenhuma é papel', () => {
  const { pkg } = relatorio('software-house');
  const stacks = pkg.skills.map((s) => s.slug).filter((s) => s.startsWith('stack-')).sort();
  assert.deepEqual(stacks, ['stack-dotnet', 'stack-java', 'stack-node', 'stack-php', 'stack-python']);
  for (const s of stacks) {
    assert.ok(!pkg.agents.some((a) => a.slug === s), `${s} é skill, não papel`);
  }
});

test('software-house: nenhum papel de dev amarra stack no slug', () => {
  const { pkg } = relatorio('software-house');
  for (const a of pkg.agents) {
    assert.ok(!/java|php|python|node|dotnet/i.test(a.slug),
      `${a.slug} amarra stack no papel; stack é skill anexável`);
  }
});

test('todo pacote do acervo: nenhuma chave de topo nova — só o que a spec permite', () => {
  // Era só software-house (achado Important 7). PERMITIDAS é a mesma
  // lista, testada agora contra os oito pacotes.
  const PERMITIDAS = new Set([
    'name', 'title', 'slug', 'description', 'schema', 'kind', 'version',
    'license', 'authors', 'goals', 'tags', 'requirements', 'reportsTo',
    'skills', 'metadata', 'manager', 'includes', 'assignee', 'recurring',
    'allowed-tools',
  ]);
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    for (const arquivo of [pkg.company, ...pkg.agents, ...pkg.skills, ...pkg.teams, ...pkg.tasks]) {
      for (const chave of Object.keys(arquivo.frontmatter)) {
        assert.ok(PERMITIDAS.has(chave),
          `chave de topo "${chave}" em ${arquivo.path} não é da spec; extensão vai sob metadata.*`);
      }
    }
  }
});

test('nenhum papel assina o portão de teto sobre os próprios limites', () => {
  // Teste estreito, de propósito — e isso é aceitável aqui porque o
  // portão de teto tem razão própria para nunca ter um papel como signer,
  // mesmo quando esse papel seria tecnicamente elegível: alertar a si
  // mesmo é notificação, autorizar o próprio estouro é conflito. A
  // cobertura universal — nenhum approve pode discordar do signer
  // declarado, de qualquer portão — é o teste seguinte, que espelha a
  // regra E14 do validador em vez de uma lista de padrões de nome.
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const slugs = new Set(pkg.agents.map((a) => a.slug));
    for (const g of pkg.company.frontmatter.metadata?.human_gates ?? []) {
      const id = typeof g === 'string' ? g : g.id;
      if (!/gasto|teto|or[çc]amento/i.test(id)) continue;
      const signer = typeof g === 'string' ? null : g.signer;
      assert.ok(!slugs.has(signer),
        `${nome}: o portão "${id}" é assinado pelo papel "${signer}". Alertar a si mesmo é notificação; autorizar o próprio estouro é conflito — o signer tem de ser pessoa nomeada`);
    }
    for (const a of pkg.agents) {
      const aprova = a.frontmatter.metadata?.capabilities?.approve ?? [];
      const propria = aprova.find((x) => /gasto|teto/i.test(x));
      assert.ok(!propria,
        `${nome}/${a.slug} lista "${propria}" em approve — nenhum papel aprova o portão do próprio teto`);
    }
  }
});

test('nenhum pacote do acervo produz E14 — approve sempre concorda com o signer declarado', () => {
  // Cobertura universal, escrita a partir do princípio (approve == "eu
  // assino"), não do padrão de nome do portão encontrado na última
  // rodada. É esta a diferença entre a guarda acima — que só pega o
  // portão de teto — e esta, que pega qualquer portão, de qualquer
  // pacote, cujo approve discorde do signer.
  for (const nome of listPackages(RAIZ)) {
    const { errors } = relatorio(nome);
    const e14 = errors.filter((e) => e.code === 'E14');
    assert.deepEqual(e14, [], e14.map((e) => `${e.where}: ${e.message}`).join('\n'));
  }
});

test('TAREFA 30: só os portões com padrão de comando real declaram triggers', () => {
  // human_gates[].triggers é opcional e aditivo — um portão sem padrão de
  // comando (contato com cliente, divulgar achado de segurança, gasto
  // acima do teto) não pode ganhar um glob inventado só para preencher o
  // campo. software-house: deploy-producao e remocao-de-dado-de-producao
  // têm; fabrica-de-testes: tocar-producao e carga-acima-do-acordado têm.
  const COM_TRIGGERS = new Set(['deploy-producao', 'remocao-de-dado-de-producao',
    'tocar-producao', 'carga-acima-do-acordado']);
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    for (const g of pkg.company.frontmatter.metadata?.human_gates ?? []) {
      if (typeof g === 'string') continue;
      const temTriggers = Array.isArray(g.triggers) && g.triggers.length > 0;
      if (COM_TRIGGERS.has(g.id)) {
        assert.ok(temTriggers, `${nome}: "${g.id}" deveria declarar triggers`);
      } else {
        assert.ok(!temTriggers, `${nome}: "${g.id}" não tem padrão de comando real — não deveria declarar triggers`);
      }
    }
  }
});

test('todo comando de execute.allow do acervo está classificado — rede ou local', () => {
  // Fix round 1 da Task 1: a revisão achou nmap/nuclei/ffuf fora de
  // COMANDOS_DE_REDE — sexta aparição do mesmo defeito ("enumerar em vez
  // de derivar"). Fix round 2: a mesma lacuna reapareceu embrulhada —
  // `npx artillery*` classificava "local" só porque `npx` é local, sem
  // nunca testar `artillery`. Por isso este teste SEMPRE descasca o
  // runner (`descascarRunner`, a mesma função que tools/rules.mjs usa
  // para E15/W05) antes de classificar — testar o padrão crú de novo
  // seria o caminho paralelo que recriou a lacuna da vez passada.
  // Comando novo que não bater em nenhuma das duas listas (ex.: alguém
  // acrescenta `httpie` ou `aws`, puro ou atrás de `npx`) deixa este
  // teste vermelho, nomeando o comando — classificar passa a ser
  // obrigatório, não opcional.
  const naoClassificados = [];
  for (const nome of listPackages(RAIZ)) {
    for (const a of loadPackage(join(RAIZ, nome)).agents) {
      const allow = a.frontmatter.metadata?.capabilities?.execute?.allow ?? [];
      for (const padrao of allow) {
        const real = descascarRunner(padrao);
        const classificado = COMANDOS_DE_REDE.some((re) => re.test(real))
          || COMANDOS_LOCAIS.some((re) => re.test(real));
        if (!classificado) {
          const comando = real.match(/^\S+/)?.[0] ?? real;
          naoClassificados.push(`${nome}/${a.slug}: "${padrao}" (comando real "${comando}")`);
        }
      }
    }
  }
  assert.deepEqual(naoClassificados, [],
    `comando(s) de execute.allow sem classificação em COMANDOS_DE_REDE nem COMANDOS_LOCAIS:\n${naoClassificados.join('\n')}`);
});

test('nenhum papel declara curinga de runner puro em execute.allow — Task 8, fix-round 1', () => {
  // A Task 8 estreitou `npx *` em cinco papéis (vitrine-fase-1-acervo),
  // mas a medição pós-commit do coordenador (fix-round 1) achou três
  // curingas de runner puro fora do escopo original: `npx *` em
  // `fabrica-de-testes/api-funcional` (excluído de propósito — declara
  // domínio) e `npm *` em `engenharia-de-dados/pipeline-de-dados` e
  // `plataforma-e-operacao/plataforma-e-entrega` (nunca medidos, porque
  // a issue original só olhava `npx`). SCHEMA.md agora afirma que
  // curinga de runner não é fronteira — um papel publicado com curinga
  // puro contradiz esse princípio documentado, a mesma classe de defeito
  // que foi Critical na revisão da Fase F (COMPANY.md afirmando algo que
  // um papel publicado desmentia). Este teste fecha o ciclo: sem ele,
  // nada impede o curinga de voltar no próximo papel novo.
  //
  // "Curinga de runner puro" = o padrão, depois de descascar o prefixo
  // de RUNNERS (`npx`, `pnpm dlx`, `yarn dlx`, `bunx`, `pipx run`, `uvx`,
  // `dotnet run --`), não sobra nome de comando nenhum — só espaço e/ou
  // `*`. `npm` bare entra mesmo não estando em RUNNERS — por isso soma-se
  // a RUNNERS aqui, em vez de reescrever a lista: `tools/rules.mjs` já é
  // a fonte única dos prefixos de runner, e copiar essa lista à mão é
  // exatamente o defeito ("enumerar em vez de derivar") que esta fase
  // caçou o dia inteiro.
  //
  // O QUE ESTA GUARDA COBRE, medido na revisão ampla de 2026-10-27 — e
  // escrito aqui porque a versão anterior deste comentário afirmava o
  // critério "qualquer subcomando do ecossistema, sem nome nenhum
  // declarado", que a guarda NÃO implementa:
  //
  //   acusa   "npx *"  "npm *"  "pnpm dlx *"  "yarn dlx *"  "bunx *"
  //           "uvx *"  "pipx run *"  "dotnet run -- *"
  //   passa   "pnpm *"  "yarn *"  "bun *"  "mvn *"  "gradle *"  "pip *"
  //           "dotnet *"  "composer *"  "npm*"  "npx*"
  //
  // Cobre, então, os RUNNERS na forma `npx`/`npm`/`dlx` com espaço antes
  // do curinga. NÃO cobre `yarn`/`pnpm` nus — que não são runners pela
  // definição da lista, mas permitem tudo o que `yarn dlx *`/`pnpm dlx *`
  // permitem, e mais —, nem a forma sem espaço (`npx*`, `npm*`), porque
  // os prefixos de RUNNERS exigem `\s+`. O padrão estreito é pego; o
  // superconjunto, não.
  //
  // `yarn *` e `pnpm *` estão VIVOS em
  // `software-house/desenvolvimento-frontend` e `desenvolvimento-fullstack`
  // e não foram estreitados: é decisão de fronteira do dono do acervo, a
  // classe exata da issue #1, e apertar a guarda aqui deixaria a suíte
  // vermelha em papel publicado. Nenhum papel usa hoje a forma sem
  // espaço. Ver SCHEMA.md, "Decisão: curinga de runner não é fronteira".
  const PREFIXOS_CURINGA = [...RUNNERS, /^npm\s+/i];
  const curingasPuros = [];
  for (const nome of listPackages(RAIZ)) {
    for (const a of loadPackage(join(RAIZ, nome)).agents) {
      const allow = a.frontmatter.metadata?.capabilities?.execute?.allow ?? [];
      for (const padrao of allow) {
        for (const prefixo of PREFIXOS_CURINGA) {
          const m = padrao.match(prefixo);
          if (!m) continue;
          const resto = padrao.slice(m[0].length);
          if (/^[\s*]*$/.test(resto)) {
            curingasPuros.push(`${nome}/${a.slug}: "${padrao}"`);
          }
          break;
        }
      }
    }
  }
  assert.deepEqual(curingasPuros, [],
    `curinga de runner puro em execute.allow — SCHEMA.md diz que isso não é fronteira; nomeie o comando ou documente a exceção no corpo do papel:\n${curingasPuros.join('\n')}`);
});

test('fabrica-de-testes: zero erro', () => {
  const { errors } = relatorio('fabrica-de-testes');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
});

test('fabrica-de-testes: zero aviso', () => {
  const { warnings } = relatorio('fabrica-de-testes');
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('fabrica-de-testes: só polaris é raiz; os oito especialistas reportam a ela', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const raizes = pkg.agents.filter((a) => a.frontmatter.reportsTo == null);
  assert.deepEqual(raizes.map((a) => a.slug), ['polaris']);
  for (const a of pkg.agents.filter((x) => x.slug !== 'polaris')) {
    assert.equal(a.frontmatter.reportsTo, 'polaris', `${a.slug} reporta a polaris`);
  }
});

test('fabrica-de-testes: nenhum especialista pode emitir veredito', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  for (const a of pkg.agents.filter((x) => x.slug !== 'polaris')) {
    assert.deepEqual(a.frontmatter.metadata.capabilities.approve, [],
      `${a.slug} não assina portão — veredito é de polaris`);
    assert.deepEqual(a.frontmatter.metadata.capabilities.delegate, [],
      `${a.slug} não delega — especialista é folha`);
  }
});

test('fabrica-de-testes: nove papéis depois da expansão', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(), [
    'acessibilidade', 'api-funcional', 'automacao-e2e', 'contrato-api',
    'desempenho-e-carga', 'exploratorio', 'integridade-de-dados',
    'polaris', 'privacidade',
  ]);
});

test('fabrica-de-testes: automacao-e2e é o único especialista que escreve código', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const escrevemCodigo = pkg.agents
    .filter((a) => (a.frontmatter.metadata.capabilities.write ?? []).includes('code'))
    .map((a) => a.slug);
  assert.deepEqual(escrevemCodigo, ['automacao-e2e'],
    'manter a suíte de regressão é escrever código; executar checagem não é');
});

test('fabrica-de-testes: contrato-api e api-funcional têm fronteiras distintas', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const c = pkg.agents.find((a) => a.slug === 'contrato-api').frontmatter.metadata;
  const f = pkg.agents.find((a) => a.slug === 'api-funcional').frontmatter.metadata;
  assert.notDeepEqual(c.capabilities, f.capabilities,
    'contrato valida forma, funcional exercita comportamento — se as capacidades convergirem, é um papel só');
  assert.ok((c.capabilities.write ?? []).includes('test_evidence'));
  assert.ok(f.boundary.can.some((t) => /dado de teste|cen[áa]rio/i.test(t)),
    'o funcional declara que cria dado de teste; o de contrato não');
});

test('fabrica-de-testes: desempenho-e-carga exige portão humano de carga', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const d = pkg.agents.find((a) => a.slug === 'desempenho-e-carga');
  assert.ok(d.frontmatter.metadata.boundary.cannot.some((t) => /carga|volume/i.test(t)),
    'passar da carga acordada é portão humano, não decisão do agente');
});

test('fabrica-de-testes: polaris delega para os oito especialistas', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const p = pkg.agents.find((a) => a.slug === 'polaris');
  assert.equal(p.frontmatter.metadata.capabilities.delegate.length, 8);
  assert.ok(!p.frontmatter.metadata.capabilities.delegate.includes('polaris'));
});

test('fabrica-de-testes: nenhum especialista lê database sem portão humano declarado', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const integridade = pkg.agents.find((a) => a.slug === 'integridade-de-dados');
  assert.ok(integridade.frontmatter.metadata.capabilities.read.includes('database'),
    'integridade-de-dados precisa ler base para comparar origem e destino');
  assert.ok(integridade.frontmatter.metadata.boundary.cannot.some((t) => /produ[çc][ãa]o/i.test(t)),
    'e a prosa precisa negar produção explicitamente');
});

test('operacao-de-conhecimento: zero erro e zero aviso', () => {
  const { errors, warnings } = relatorio('operacao-de-conhecimento');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('operacao-de-conhecimento: os quatro papéis, curadoria na raiz', () => {
  const { pkg } = relatorio('operacao-de-conhecimento');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(),
    ['curadoria', 'pesquisa', 'redacao', 'triagem']);
  const raizes = pkg.agents.filter((a) => a.frontmatter.reportsTo == null);
  assert.deepEqual(raizes.map((a) => a.slug), ['curadoria']);
});

test('operacao-de-conhecimento: pesquisa é o único papel com acesso à web', () => {
  const { pkg } = relatorio('operacao-de-conhecimento');
  const comWeb = pkg.agents.filter((a) => (a.frontmatter.metadata.capabilities.read ?? []).includes('web'));
  assert.deepEqual(comWeb.map((a) => a.slug), ['pesquisa'],
    'só pesquisa lê a web; concentrar a saída externa num papel é o que torna a fronteira auditável');
});

test('operacao-de-conhecimento: nenhum papel escreve código', () => {
  const { pkg } = relatorio('operacao-de-conhecimento');
  for (const a of pkg.agents) {
    assert.ok(!(a.frontmatter.metadata.capabilities.write ?? []).includes('code'),
      `${a.slug} não escreve código — este arquétipo é operação de conhecimento`);
  }
});

test('produto-e-design: três papéis, descoberta na raiz', () => {
  const { pkg } = relatorio('produto-e-design');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(),
    ['descoberta-de-produto', 'design-ui', 'pesquisa-ux']);
  assert.deepEqual(
    pkg.agents.filter((a) => a.frontmatter.reportsTo == null).map((a) => a.slug),
    ['descoberta-de-produto']);
});

test('produto-e-design: zero erro e zero aviso', () => {
  const { errors, warnings } = relatorio('produto-e-design');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('produto-e-design: nenhum papel escreve código', () => {
  const { pkg } = relatorio('produto-e-design');
  for (const a of pkg.agents) {
    assert.ok(!(a.frontmatter.metadata.capabilities.write ?? []).includes('code'),
      `${a.slug} não implementa — desenho e implementação são pacotes diferentes`);
  }
});

test('produto-e-design: só pesquisa-ux condiciona o contato com usuário ao portão — os outros dois negam sem condição', () => {
  // O teste anterior só verificava que o portão `contato-com-usuario`
  // existe e que o `cannot` de pesquisa-ux menciona usuário — mas
  // descoberta-de-produto e design-ui também negam "falar diretamente
  // com usuário" no `cannot`, então o mesmo regex casaria com qualquer
  // um dos três e "só pesquisa-ux" podia ser falso sem o teste notar.
  // A fronteira que de fato distingue: só a cláusula de pesquisa-ux é
  // CONDICIONADA ao portão ("sem portão humano") — as outras duas
  // proíbem sem exceção, porque não têm o portão como válvula.
  const { pkg } = relatorio('produto-e-design');
  const ids = (pkg.company.frontmatter.metadata.human_gates ?? []).map((g) => g.id);
  assert.ok(ids.includes('contato-com-usuario'),
    'falar com usuário real é portão humano: tem gente de verdade do outro lado');
  const condicionamPeloPortao = pkg.agents
    .filter((a) => a.frontmatter.metadata.boundary.cannot.some(
      (t) => /usu[áa]rio/i.test(t) && /portão humano/i.test(t)))
    .map((a) => a.slug)
    .sort();
  assert.deepEqual(condicionamPeloPortao, ['pesquisa-ux'],
    'só pesquisa-ux condiciona o contato com usuário ao portão; se descoberta-de-produto ou ' +
    'design-ui ganhassem a mesma válvula, ou se pesquisa-ux a perdesse, a exclusividade colapsa');
});

test('seguranca-ofensiva: cinco papéis, liderança na raiz', () => {
  const { pkg } = relatorio('seguranca-ofensiva');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(), [
    'cadeia-de-suprimentos', 'configuracao-de-nuvem', 'lideranca-de-seguranca',
    'pentest-aplicacao', 'revisao-de-codigo-seguro',
  ]);
  assert.deepEqual(
    pkg.agents.filter((a) => a.frontmatter.reportsTo == null).map((a) => a.slug),
    ['lideranca-de-seguranca']);
});

test('seguranca-ofensiva: zero erro e zero aviso', () => {
  const { errors, warnings } = relatorio('seguranca-ofensiva');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('seguranca-ofensiva: autorização escrita é portão humano com assinante nomeado', () => {
  const { pkg } = relatorio('seguranca-ofensiva');
  const gates = pkg.company.frontmatter.metadata.human_gates ?? [];
  const autorizacao = gates.find((g) => g.id === 'escopo-autorizado-por-escrito');
  assert.ok(autorizacao, 'o escopo autorizado é portão, não campo de configuração');
  assert.ok(autorizacao.signer, 'e tem assinante nomeado');
});

test('seguranca-ofensiva: só pentest e cadeia-de-suprimentos saem para a rede, cada um com allowlist de domínio nomeando a própria função', () => {
  const { pkg } = relatorio('seguranca-ofensiva');
  const comRede = pkg.agents.filter((a) => a.frontmatter.metadata.capabilities.network !== false);
  assert.deepEqual(comRede.map((a) => a.slug).sort(), ['cadeia-de-suprimentos', 'pentest-aplicacao'],
    'nomear a rede pela função de cada papel é o que torna a fronteira auditável — nenhum outro papel deste pacote sai para a rede');
  for (const a of comRede) {
    const network = a.frontmatter.metadata.capabilities.network;
    assert.ok(Array.isArray(network),
      `${a.slug}: network é lista de domínio autorizado, nunca true — true é a internet inteira`);
    assert.ok(network.length > 0, `${a.slug}: lista de domínio não pode ser vazia`);
  }
});

test('seguranca-ofensiva: nenhum papel aplica mudança em ambiente', () => {
  const { pkg } = relatorio('seguranca-ofensiva');
  for (const a of pkg.agents) {
    const allow = a.frontmatter.metadata.capabilities.execute?.allow ?? [];
    for (const g of allow) {
      assert.ok(!/(apply|upgrade|destroy|delete)/i.test(g),
        `${a.slug}: "${g}" aplica mudança; este pacote avalia e não remedia`);
    }
  }
});

test('seguranca-ofensiva: só a liderança divulga achado, e por portão', () => {
  const { pkg } = relatorio('seguranca-ofensiva');
  for (const a of pkg.agents.filter((x) => x.slug !== 'lideranca-de-seguranca')) {
    assert.deepEqual(a.frontmatter.metadata.capabilities.approve, [],
      `${a.slug} não assina portão — divulgação é da liderança`);
  }
});

// EMISSÃO — desvio do brief (ver task-22-report.md): o Step 1 do brief
// pedia "a allowlist do pentest é reportada como perda em claude-code".
// Isso descreve um estado do binding que não existe mais neste acervo:
// `bindings/claude-code.yml` hoje TRADUZ `network.allowlist` de verdade
// (sandbox.network.allowedDomains, fix round 1) — não há "perda" nenhuma
// a reportar ali, e nenhum dos quatro bindings publicados tem
// `network.allowlist` em `loses` (claude-code e opencode traduzem,
// portable e paperclip preservam). `fase-f-constraints.md` ("Regra de
// allowlist de rede") e `contrato-api/AGENTS.md` descrevem o mecanismo
// real: Claude Code é fronteira de verdade (`allowlist_scope: os`);
// OpenCode V2 e o janus com provider `kind=cli` são `fetch-only` — a
// allowlist cobre só a chamada de busca da ferramenta, e o shell cru
// liberado em `execute.allow` (aqui, `curl -s*`) escapa dela. O teste
// abaixo verifica o par: opencode avisa, claude-code não.
test('EMISSÃO: opencode avisa que a allowlist do pentest é decorativa (fetch-only + shell); claude-code não avisa (os)', () => {
  const pkg = loadPackage(join(RAIZ, 'seguranca-ofensiva'));
  const pentest = pkg.agents.find((a) => a.slug === 'pentest-aplicacao');

  const opencode = yaml.load(readFileSync(join(RAIZ, 'bindings/opencode.yml'), 'utf8'),
    { schema: yaml.CORE_SCHEMA });
  const { warnings: avisosOpencode } = applyBinding(pentest, opencode, pkg);
  const avisoFetchOnly = avisosOpencode.find((w) => /curl/.test(w.message));
  assert.ok(avisoFetchOnly,
    'opencode é allowlist_scope: fetch-only e pentest-aplicacao tem curl em execute.allow — ' +
    'o operador TEM de ser avisado, senão a lista de domínio parece fronteira e não é');

  const claudeCode = yaml.load(readFileSync(join(RAIZ, 'bindings/claude-code.yml'), 'utf8'),
    { schema: yaml.CORE_SCHEMA });
  const { warnings: avisosClaudeCode, translated } = applyBinding(pentest, claudeCode, pkg);
  assert.deepEqual(avisosClaudeCode, [],
    'claude-code é allowlist_scope: os — o sandbox do sistema operacional cobre o shell cru, ' +
    'a lista é fronteira de verdade e não há perda a avisar');
  assert.ok(translated.includes('network.allowlist'),
    'claude-code traduz a allowlist de verdade (sandbox.network.allowedDomains)');
});

test('plataforma-e-operacao: quatro papéis, liderança na raiz', () => {
  const { pkg } = relatorio('plataforma-e-operacao');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(), [
    'confiabilidade-sre', 'lideranca-de-plataforma',
    'plataforma-e-entrega', 'resposta-a-incidente',
  ]);
  assert.deepEqual(
    pkg.agents.filter((a) => a.frontmatter.reportsTo == null).map((a) => a.slug),
    ['lideranca-de-plataforma']);
});

test('plataforma-e-operacao: zero erro e zero aviso', () => {
  const { errors, warnings } = relatorio('plataforma-e-operacao');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('REGRA DO PACOTE: nenhum papel aplica mudança em ambiente', () => {
  const { pkg } = relatorio('plataforma-e-operacao');
  for (const a of pkg.agents) {
    for (const g of a.frontmatter.metadata.capabilities.execute?.allow ?? []) {
      assert.ok(!/(apply|upgrade|destroy|rollout restart|delete)/i.test(g),
        `${a.slug}: "${g}" aplica mudança. plan, template e diff são de agente; apply é portão humano`);
    }
  }
});

test('plataforma-e-operacao: aplicar mudança e deploy são portões humanos nomeados', () => {
  const { pkg } = relatorio('plataforma-e-operacao');
  const ids = (pkg.company.frontmatter.metadata.human_gates ?? []).map((g) => g.id);
  assert.ok(ids.includes('aplicar-mudanca-em-ambiente'));
  assert.ok(ids.includes('acesso-a-dado-de-producao'));
});

test('plataforma-e-operacao: só resposta-a-incidente lê produção, e por portão', () => {
  const { pkg } = relatorio('plataforma-e-operacao');
  const comProducao = pkg.agents.filter((a) =>
    (a.frontmatter.metadata.capabilities.read ?? []).includes('database'));
  assert.deepEqual(comProducao.map((a) => a.slug), ['resposta-a-incidente']);
  assert.ok(comProducao[0].frontmatter.metadata.capabilities.approve.length === 0,
    'ele usa o portão, não o assina');
});

test('engenharia-de-dados: cinco papéis, liderança na raiz', () => {
  const { pkg } = relatorio('engenharia-de-dados');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(), [
    'analytics-bi', 'lideranca-de-dados', 'modelagem-de-dados',
    'pipeline-de-dados', 'qualidade-de-dados',
  ]);
  assert.deepEqual(
    pkg.agents.filter((a) => a.frontmatter.reportsTo == null).map((a) => a.slug),
    ['lideranca-de-dados']);
});

test('engenharia-de-dados: zero erro e zero aviso', () => {
  const { errors, warnings } = relatorio('engenharia-de-dados');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('PAR DE RISCO: qualidade-de-dados constrói checagem, integridade-de-dados verifica release', () => {
  const q = relatorio('engenharia-de-dados').pkg.agents.find((a) => a.slug === 'qualidade-de-dados');
  const i = relatorio('fabrica-de-testes').pkg.agents.find((a) => a.slug === 'integridade-de-dados');
  assert.ok((q.frontmatter.metadata.capabilities.write ?? []).includes('code'),
    'o de engenharia escreve a checagem');
  assert.ok(!(i.frontmatter.metadata.capabilities.write ?? []).includes('code'),
    'o da fábrica só produz evidência');
  assert.notDeepEqual(q.frontmatter.metadata.capabilities, i.frontmatter.metadata.capabilities);
});

test('engenharia-de-dados: nenhum papel escreve em base de produção', () => {
  const { pkg } = relatorio('engenharia-de-dados');
  for (const a of pkg.agents) {
    assert.ok(a.frontmatter.metadata.boundary.cannot.some((t) => /produ[çc][ãa]o/i.test(t)),
      `${a.slug} tem de negar produção na prosa`);
    for (const g of a.frontmatter.metadata.capabilities.execute?.allow ?? []) {
      assert.ok(!/(DROP|TRUNCATE|DELETE)/i.test(g), `${a.slug}: "${g}" destrói dado`);
    }
  }
});

test('engenharia-de-dados: analytics-bi não escreve pipeline e pipeline não define métrica', () => {
  const { pkg } = relatorio('engenharia-de-dados');
  const bi = pkg.agents.find((a) => a.slug === 'analytics-bi');
  const pl = pkg.agents.find((a) => a.slug === 'pipeline-de-dados');
  assert.ok(!(bi.frontmatter.metadata.capabilities.write ?? []).includes('code'));
  assert.ok(pl.frontmatter.metadata.boundary.cannot.some((t) => /m[ée]trica|defini[çc][ãa]o/i.test(t)));
});

test('documentacao-e-suporte: três papéis, documentação na raiz', () => {
  const { pkg } = relatorio('documentacao-e-suporte');
  assert.deepEqual(pkg.agents.map((a) => a.slug).sort(),
    ['base-de-conhecimento', 'documentacao-tecnica', 'suporte-nivel-2']);
  assert.deepEqual(
    pkg.agents.filter((a) => a.frontmatter.reportsTo == null).map((a) => a.slug),
    ['documentacao-tecnica']);
});

test('documentacao-e-suporte: zero erro e zero aviso', () => {
  const { errors, warnings } = relatorio('documentacao-e-suporte');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('PAR DE RISCO: suporte-nivel-2 reproduz, triagem só roteia', () => {
  const s = relatorio('documentacao-e-suporte').pkg.agents.find((a) => a.slug === 'suporte-nivel-2');
  const t = relatorio('operacao-de-conhecimento').pkg.agents.find((a) => a.slug === 'triagem');
  assert.ok(s.frontmatter.metadata.boundary.can.some((x) => /reproduz/i.test(x)));
  assert.ok(t.frontmatter.metadata.boundary.cannot.some((x) => /responder/i.test(x)));
  // `assert.notDeepEqual(capabilities, capabilities)` passaria mesmo se
  // só o `budget` diferisse enquanto a fronteira real (o que cada um lê
  // e executa) tivesse colapsado — campo irrelevante para o par de
  // risco mascarando a convergência que o teste deveria pegar. O que de
  // fato separa os dois: suporte-nivel-2 lê `database` (acesso a
  // produção pelo portão, com caso aberto) e roda `kubectl`/`psql`;
  // triagem não lê banco e só tem leitura de repositório.
  assert.ok(s.frontmatter.metadata.capabilities.read.includes('database'),
    'suporte-nivel-2 lê database: reproduzir o caso exige olhar o dado por trás dele');
  assert.ok(!t.frontmatter.metadata.capabilities.read.includes('database'),
    'triagem classifica e roteia — não lê banco');
  assert.ok(s.frontmatter.metadata.capabilities.execute.allow.some((g) => /^(kubectl|psql)/.test(g)),
    'suporte-nivel-2 roda kubectl/psql para reproduzir o caso');
  assert.ok(!t.frontmatter.metadata.capabilities.execute.allow.some((g) => /^(kubectl|psql)/.test(g)),
    'triagem não alcança log de produção nem banco');
  assert.notDeepEqual(s.frontmatter.metadata.capabilities.read, t.frontmatter.metadata.capabilities.read,
    'backstop: se a fronteira de leitura colapsar por qualquer outro caminho, isto também acusa');
  assert.notDeepEqual(s.frontmatter.metadata.capabilities.execute, t.frontmatter.metadata.capabilities.execute,
    'backstop: se a fronteira de execução colapsar por qualquer outro caminho, isto também acusa');
});

test('documentacao-e-suporte: nenhum papel fala com cliente sem portão', () => {
  const { pkg } = relatorio('documentacao-e-suporte');
  const ids = (pkg.company.frontmatter.metadata.human_gates ?? []).map((g) => g.id);
  assert.ok(ids.includes('responder-ao-cliente'));
  for (const a of pkg.agents) {
    assert.ok(a.frontmatter.metadata.boundary.cannot.some((t) => /cliente|usu[áa]rio/i.test(t)),
      `${a.slug} tem de negar contato direto na prosa`);
  }
});

test('ROSTER: nenhuma identidade repetida em todo o acervo', () => {
  // Esta era "ROSTER: 8 pacotes, 42 papéis, nome ASCII, ícone único,
  // sobrenome único" — três afirmações, cada uma com destino diferente
  // agora que o catálogo é editável pela vitrine (Task 5):
  //
  //   - contagem exata (8 pacotes, 42 papéis) SAI, sem substituto. O
  //     catálogo passa a ser editável pela vitrine; afirmar 42 faria o
  //     primeiro PR de quem adiciona um papel quebrar o CI sem haver
  //     defeito nenhum. Estrutura fixa não é mais um invariante real.
  //   - ASCII de display_name SAI daqui — já é E18
  //     (validateStructure/E18 em tools/rules.mjs), checado por papel,
  //     redundante com este teste de acervo. A regra cobre; este teste
  //     não precisa duplicar.
  //   - a unicidade feita à mão (três mapas, comparação ad-hoc) VIRA
  //     `validateAcervo` — Task 5, código A01. É o invariante estrutural
  //     que sobrevive: identidade de persona única em todo o acervo,
  //     agora verificado pela função que a vitrine e o CLI também chamam,
  //     não por uma guarda de teste que só existe aqui.
  const pacotes = listPackages(RAIZ).map((nome) => loadPackage(join(RAIZ, nome)));
  const { errors } = validateAcervo(pacotes);
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
});
