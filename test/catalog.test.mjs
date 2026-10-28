import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackage, listPackages, parseMarkdown } from '../tools/schema.mjs';
import { toMarkdown } from '../tools/serialize.mjs';
import { buildCatalog, CHAVES_DERIVADAS } from '../tools/catalog.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('catalog: oito pacotes, e todo papel traz persona, fronteira e capacidades (metadata aninhado, fix round 3)', () => {
  const cat = buildCatalog(RAIZ);
  assert.equal(cat.schema, 'catalog/v1');
  assert.equal(cat.packages.length, listPackages(RAIZ).length);
  for (const p of cat.packages) {
    assert.ok(p.license, `${p.slug} sem license`);
    for (const a of p.agents) {
      // Ruling do coordenador (fix round 3): metadata — persona, boundary,
      // capabilities, memory, context — mora DENTRO de `a.metadata`, igual
      // ao arquivo. Achatar no topo (rounds 1-2) dava ergonomia, não
      // correção, e criava as duas convenções que a prova de suficiência
      // expôs (ver fix round 3 no relatório).
      assert.ok(a.metadata.persona.display_name, `${p.slug}/${a.slug} sem display_name`);
      assert.ok(a.metadata.boundary, `${p.slug}/${a.slug} sem boundary`);
      assert.ok(a.metadata.capabilities, `${p.slug}/${a.slug} sem capabilities`);
      assert.equal(typeof a.body, 'string');
    }
  }
});

test('catalog: o catálogo não inventa papel nem perde papel (furo 2 — projects/ já ficou invisível uma vez)', () => {
  const cat = buildCatalog(RAIZ);
  for (const nome of listPackages(RAIZ)) {
    const doDisco = loadPackage(join(RAIZ, nome)).agents.map((a) => a.slug).sort();
    const doCatalogo = cat.packages.find((p) => p.slug === nome).agents.map((a) => a.slug).sort();
    assert.deepEqual(doCatalogo, doDisco, `${nome} divergiu`);
  }
});

test('catalog: contagem de pacotes e agentes é derivada do disco, não cravada (furo 3)', () => {
  const cat = buildCatalog(RAIZ);
  const nomes = listPackages(RAIZ);
  const totalAgentesNoDisco = nomes.reduce(
    (n, nome) => n + loadPackage(join(RAIZ, nome)).agents.length, 0);
  assert.equal(cat.packages.length, nomes.length);
  assert.equal(
    cat.packages.reduce((n, p) => n + p.agents.length, 0),
    totalAgentesNoDisco);
});

test('catalog: metadata do papel (boundary, capabilities, memory, context, persona — incluindo background/strengths) sobrevive por inteiro (furo 4)', () => {
  const cat = buildCatalog(RAIZ);
  let algumBackgroundConferido = false;
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const pacoteCatalogo = cat.packages.find((p) => p.slug === nome);
    for (const agente of pkg.agents) {
      const entry = pacoteCatalogo.agents.find((a) => a.slug === agente.slug);
      const meta = agente.frontmatter.metadata ?? {};
      // Com `metadata` aninhado (fix round 3), furo 4 vira uma comparação
      // de objeto só — `a.metadata` É `meta`, cópia direta, sem achatar
      // nem reclassificar nada. Isto cobre toda chave presente E futura
      // (metadata.tools, se um dia existir) sem precisar enumerar nada à
      // mão: `deepEqual` nos dois objetos inteiros já é a derivação.
      assert.deepEqual(entry.metadata, meta,
        `${nome}/${agente.slug} perdeu ou alterou algo em metadata no catálogo`);
      if (Array.isArray(meta.persona?.background) && meta.persona.background.length > 0) {
        algumBackgroundConferido = true;
      }
    }
  }
  // Guarda contra teste infalsificável: se nenhum papel real do acervo
  // tivesse `background`, o deepEqual acima nunca exercitaria o caso que
  // importa, e passaria mesmo com uma regressão que voltasse a excluir o
  // campo em `construirPapel`.
  assert.ok(algumBackgroundConferido,
    'nenhum papel do acervo real tem persona.background — o teste não teria pego a exclusão');
});

test('catalog: nenhum pacote some nem é inventado (slug a slug)', () => {
  const cat = buildCatalog(RAIZ);
  assert.deepEqual(
    cat.packages.map((p) => p.slug).sort(),
    listPackages(RAIZ).sort());
});

test('catalog: teams/tasks/projects (e tasks aninhada em projects) não ficam invisíveis — mesmo furo de projects/ do commit 76fef37, agora na camada do catálogo', () => {
  const cat = buildCatalog(RAIZ);
  for (const nome of listPackages(RAIZ)) {
    const pkg = loadPackage(join(RAIZ, nome));
    const pCat = cat.packages.find((p) => p.slug === nome);
    assert.equal(pCat.teams.length, pkg.teams.length, `${nome}: teams divergiu`);
    assert.equal(pCat.tasks.length, pkg.tasks.length, `${nome}: tasks divergiu`);
    assert.equal(pCat.projects.length, pkg.projects.length, `${nome}: projects divergiu`);
    for (const proj of pkg.projects) {
      const projCat = pCat.projects.find((p) => p.slug === proj.slug);
      assert.equal(projCat.tasks.length, proj.tasks.length,
        `${nome}/${proj.slug}: tasks do projeto divergiram`);
    }
  }
});

test('catalog: pacote com erro de validação falha a geração', () => {
  assert.throws(() => buildCatalog(join(RAIZ, 'test/fixtures/catalog/pacote-invalido')),
    /erro de valida/i);
});

test('catalog: pacote com aviso (persona incompleta) ainda gera catálogo — aviso não é erro', () => {
  const cat = buildCatalog(join(RAIZ, 'test/fixtures/catalog/pacote-com-aviso'));
  assert.equal(cat.packages.length, 1);
  assert.equal(cat.packages[0].agents.length, 1);
});

test('catalog: generated_from é um sha curto quando o acervo está em git', () => {
  const cat = buildCatalog(RAIZ);
  assert.match(cat.generated_from, /^[0-9a-f]{7,40}$/);
});

test('catalog: --ref sobrepõe a detecção automática', () => {
  const cat = buildCatalog(RAIZ, { ref: 'deadbee' });
  assert.equal(cat.generated_from, 'deadbee');
});

// Prova de suficiência — fix round 3, estendida na revisão ampla às DUAS
// classes de arquivo que o catálogo tem de poder remontar.
//
// A revisão remontou os 42 papéis a partir do catálogo ACHATADO
// (rounds 1-2) e só bateu byte a byte na SEGUNDA tentativa, depois de
// descobrir a ordem de chave certa por fora — porque a ordem e a regra de
// re-aninhamento não estavam no dado. Com `metadata` aninhado como no
// arquivo (ver construirPapel em tools/catalog.mjs), a reconstrução é
// direta e bate na primeira tentativa.
//
// O que a prova NÃO perguntava, e por isso ficou aberto: "dá para
// remontar os 8 COMPANY.md?" — a resposta medida era ZERO de 8. O
// catálogo descartava de todo pacote `goals`, `metadata` (com `budget` e
// `capability_vocabulary`), `authors`, `kind`, `requirements`, `schema`,
// `tags`, `version` e o corpo inteiro, porque `construirPacote` era o
// único construtor com lista de campos enumerada à mão. Por isso a prova
// agora é PARAMETRIZADA sobre as duas classes, num laço só: a classe nova
// entra como linha de tabela, não como teste irmão que alguém esquece de
// escrever.
//
// A reconstrução remove as CHAVES DERIVADAS declaradas pelo próprio
// módulo (`CHAVES_DERIVADAS`), em vez de enumerar os campos do arquivo —
// é o que torna o defeito irreintroduzível: campo de frontmatter que
// pare de entrar no catálogo faz a reconstrução divergir, e chave nova
// que o catálogo acrescente sem declarar aqui também.
const CLASSES_RECONSTRUIVEIS = [
  {
    nome: 'COMPANY.md',
    entradas: (cat) => cat.packages,
    derivadas: CHAVES_DERIVADAS.pacote,
    // A ordem vem do DADO: `construirPacote` espalha o frontmatter, logo
    // a ordem de inserção do catálogo já é a ordem do arquivo (e
    // sobrevive a JSON.stringify/parse).
    ordem: null,
  },
  {
    nome: 'AGENTS.md',
    entradas: (cat) => cat.packages.flatMap((p) => p.agents),
    derivadas: CHAVES_DERIVADAS.agente,
    // LIMITE NOMEADO, não corrigido nesta onda: `construirPapel` monta o
    // objeto com `slug` PRIMEIRO, enquanto o arquivo escreve `name`
    // primeiro — a ordem do papel no catálogo não é a do arquivo, e por
    // isso esta classe precisa declarar a ordem aqui. É a mesma
    // convenção que o teste de "ordem de chave de topo" abaixo guarda
    // pelo lado do disco. Espalhar `construirPapel` resolveria (a ordem
    // passaria a vir do dado, como no pacote), mas muda a ordem de chave
    // do catálogo para os 42 papéis, o que está fora do escopo medido
    // desta onda — o findings nomeia `construirPacote` e `construirSkill`.
    ordem: ['name', 'title', 'slug', 'reportsTo', 'skills', 'metadata'],
  },
];

function frontmatterDoCatalogo(entrada, derivadas, ordem) {
  const semDerivadas = Object.fromEntries(
    Object.entries(entrada).filter(([chave]) => !derivadas.includes(chave)));
  if (!ordem) return semDerivadas;
  return Object.fromEntries(ordem.map((chave) => [chave, semDerivadas[chave]]));
}

for (const classe of CLASSES_RECONSTRUIVEIS) {
  test(`catalog: reconstrução byte-a-byte de todo ${classe.nome} real a partir do catálogo (prova de suficiência)`, () => {
    const cat = buildCatalog(RAIZ);
    const entradas = classe.entradas(cat);
    for (const entrada of entradas) {
      const frontmatter = frontmatterDoCatalogo(entrada, classe.derivadas, classe.ordem);
      const reconstruido = toMarkdown({ frontmatter, body: entrada.body });
      const original = readFileSync(join(RAIZ, entrada.path), 'utf8');
      assert.equal(reconstruido, original,
        `${entrada.path} não reconstruiu byte a byte a partir do catálogo`);
    }
    // Não crava a contagem como condição do laço — deriva do catálogo e
    // só confirma que o laço correu sobre algo, não sobre lista vazia.
    assert.ok(entradas.length > 0, `nenhum ${classe.nome} reconstruído — acervo vazio?`);
  });

  // Guarda de irreintroduzibilidade, por CONJUNTO e não por ordem: pega
  // tanto campo do arquivo que o catálogo deixou de copiar (o Critical)
  // quanto chave que o catálogo acrescentou sem declarar em
  // CHAVES_DERIVADAS. A reconstrução byte a byte acima é que carrega a
  // prova de ORDEM.
  test(`catalog: as chaves de cada ${classe.nome} no catálogo são as do arquivo mais as derivadas declaradas — nada a mais, nada a menos`, () => {
    const cat = buildCatalog(RAIZ);
    for (const entrada of classe.entradas(cat)) {
      const doDisco = parseMarkdown(readFileSync(join(RAIZ, entrada.path), 'utf8'));
      const esperado = [...Object.keys(doDisco.frontmatter), ...classe.derivadas].sort();
      assert.deepEqual(Object.keys(entrada).sort(), esperado,
        `${entrada.path}: as chaves do catálogo divergem do frontmatter do arquivo mais ${classe.derivadas.join(', ')}`);
    }
  });
}

// O spec §6 nomeia SEIS campos de pacote para o editor da vitrine. Dois
// deles — metas e teto — simplesmente não existiam no catálogo, e nenhum
// teste perguntava por eles: a prova de suficiência olhava só os papéis.
// Esta é a asserção direta do critério escrito em prosa.
test('catalog: os seis campos de pacote que o spec §6 nomeia para o editor existem nos 8 pacotes', () => {
  const cat = buildCatalog(RAIZ);
  for (const p of cat.packages) {
    assert.ok(p.name, `${p.slug}: sem name`);
    assert.ok(p.description, `${p.slug}: sem description`);
    assert.ok(Array.isArray(p.goals) && p.goals.length > 0, `${p.slug}: sem goals (metas)`);
    assert.ok(Array.isArray(p.metadata?.human_gates) && p.metadata.human_gates.length > 0,
      `${p.slug}: sem metadata.human_gates (gates)`);
    assert.ok(p.metadata?.budget?.monthly_cap, `${p.slug}: sem metadata.budget.monthly_cap (teto)`);
    assert.ok(p.license, `${p.slug}: sem license`);
  }
  assert.ok(cat.packages.length > 0, 'nenhum pacote — acervo vazio?');
});

// O corpo do COMPANY.md é de 2,6 a 5,1 KB por pacote, e era descartado
// inteiro. Sem esta guarda, um `body: ''` passaria na reconstrução de um
// arquivo hipotético sem corpo e o teste pareceria verde.
test('catalog: o corpo do COMPANY.md entra no catálogo, não vem vazio', () => {
  const cat = buildCatalog(RAIZ);
  for (const p of cat.packages) {
    assert.ok(p.body.length > 500,
      `${p.slug}: corpo do COMPANY.md tem ${p.body.length} bytes no catálogo`);
  }
});
