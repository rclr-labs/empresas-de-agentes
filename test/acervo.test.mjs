import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackage, listPackages } from '../tools/schema.mjs';
import { validatePackage } from '../tools/rules.mjs';

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

test('software-house: toda persona tem nome, ícone, pronomes e histórico', () => {
  const { pkg } = relatorio('software-house');
  for (const a of pkg.agents) {
    const p = a.frontmatter.metadata.persona;
    assert.ok(p.display_name, `${a.slug} sem display_name`);
    assert.ok(p.icon, `${a.slug} sem icon`);
    assert.ok(p.pronouns, `${a.slug} sem pronouns`);
    assert.match(p.display_name, /^[A-Za-z][A-Za-z ]+$/,
      `${a.slug}: "${p.display_name}" tem diacrítico ou caractere não-ASCII. O nome tem de funcionar em pt-BR e em inglês`);
    assert.ok(Array.isArray(p.background) && p.background.length >= 2,
      `${a.slug} precisa de ao menos 2 linhas de histórico`);
  }
});

test('todo pacote do acervo: ícone único entre os declarados', () => {
  // Considera só ícone DECLARADO. Um agente ainda não migrado não tem
  // persona, logo `icon` é undefined — e sem o filtro, dois agentes sem
  // ícone colidem em `undefined` e o teste acusa repetição onde há
  // ausência. A ausência já é coberta por W03 (papel sem persona) e pelo
  // teste de roster da Task 26, que exige os 42 com ícone único.
  const icones = new Map();
  for (const nome of listPackages(RAIZ)) {
    for (const a of loadPackage(join(RAIZ, nome)).agents) {
      const icone = a.frontmatter.metadata?.persona?.icon;
      if (!icone) continue;
      assert.ok(!icones.has(icone), `ícone ${icone} repetido: ${icones.get(icone)} e ${nome}/${a.slug}`);
      icones.set(icone, `${nome}/${a.slug}`);
    }
  }
});

test('software-house: nenhuma chave de topo nova — só o que a spec permite', () => {
  const { pkg } = relatorio('software-house');
  const PERMITIDAS = new Set([
    'name', 'title', 'slug', 'description', 'schema', 'kind', 'version',
    'license', 'authors', 'goals', 'tags', 'requirements', 'reportsTo',
    'skills', 'metadata', 'manager', 'includes', 'assignee', 'recurring',
    'allowed-tools',
  ]);
  for (const arquivo of [pkg.company, ...pkg.agents, ...pkg.skills, ...pkg.teams, ...pkg.tasks]) {
    for (const chave of Object.keys(arquivo.frontmatter)) {
      assert.ok(PERMITIDAS.has(chave),
        `chave de topo "${chave}" em ${arquivo.path} não é da spec; extensão vai sob metadata.*`);
    }
  }
});

test('software-house: a persona não vaza para o corpo do agente', () => {
  const { pkg } = relatorio('software-house');
  for (const a of pkg.agents) {
    const nome = a.frontmatter.metadata.persona.display_name;
    assert.ok(!a.body.includes(nome),
      `${a.slug}: "${nome}" aparece no corpo. A persona não entra no prompt — custa token em toda chamada`);
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

test('todo papel que abre pull request consegue dar push', () => {
  for (const nome of listPackages(RAIZ)) {
    for (const a of loadPackage(join(RAIZ, nome)).agents) {
      const cap = a.frontmatter.metadata?.capabilities ?? {};
      if (!(cap.write ?? []).includes('pull_request')) continue;
      const allow = cap.execute?.allow ?? [];
      assert.ok(allow.some((g) => /^git push/.test(g)),
        `${nome}/${a.slug} declara write: [pull_request] mas não tem git push em execute.allow — capacidade inalcançável`);
      assert.ok((cap.execute?.deny ?? []).some((g) => /force/.test(g)),
        `${nome}/${a.slug} pode dar push e tem de negar push --force explicitamente`);
    }
  }
});

test('nenhum papel declara alcance que não tem', () => {
  // Mesma classe de defeito do teste de pull_request acima, nas duas
  // direções: ler "web" sem nenhum mecanismo de rede é alcance
  // inalcançável; e um comando de rede em execute.allow com
  // network: false é a contradição inversa — a capacidade promete
  // silêncio e o comando promete saída.
  const COMANDOS_DE_REDE = [/^curl\s/i, /^wget\s/i, /^http\s/i];
  for (const nome of listPackages(RAIZ)) {
    for (const a of loadPackage(join(RAIZ, nome)).agents) {
      const cap = a.frontmatter.metadata?.capabilities ?? {};
      const temRede = cap.network === true || (Array.isArray(cap.network) && cap.network.length > 0);
      if ((cap.read ?? []).includes('web')) {
        assert.ok(temRede,
          `${nome}/${a.slug} lê "web" mas network é ${JSON.stringify(cap.network)} — não há mecanismo declarado para alcançar a rede`);
      }
      const allow = cap.execute?.allow ?? [];
      const comandoDeRede = allow.find((g) => COMANDOS_DE_REDE.some((re) => re.test(g)));
      if (comandoDeRede) {
        assert.ok(temRede,
          `${nome}/${a.slug} tem "${comandoDeRede}" em execute.allow mas network é ${JSON.stringify(cap.network)} — a capacidade nega a mesma rede que o comando usa`);
      }
    }
  }
});

test('fabrica-de-testes: zero erro', () => {
  const { errors } = relatorio('fabrica-de-testes');
  assert.deepEqual(errors, [], errors.map((e) => `${e.code} ${e.where}: ${e.message}`).join('\n'));
});

test('fabrica-de-testes: zero aviso', () => {
  const { warnings } = relatorio('fabrica-de-testes');
  assert.deepEqual(warnings, [], warnings.map((w) => `${w.code} ${w.path ?? w.file}: ${w.message}`).join('\n'));
});

test('fabrica-de-testes: só polaris é raiz; os cinco especialistas reportam a ela', () => {
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

test('fabrica-de-testes: só polaris delega, e para os cinco especialistas', () => {
  const { pkg } = relatorio('fabrica-de-testes');
  const polaris = pkg.agents.find((a) => a.slug === 'polaris');
  assert.deepEqual(polaris.frontmatter.metadata.capabilities.delegate.sort(), [
    'acessibilidade', 'contrato-api', 'exploratorio', 'integridade-de-dados', 'privacidade',
  ]);
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

test('o acervo publica os três arquétipos', () => {
  assert.deepEqual(listPackages(RAIZ).sort(),
    ['fabrica-de-testes', 'operacao-de-conhecimento', 'software-house']);
});
