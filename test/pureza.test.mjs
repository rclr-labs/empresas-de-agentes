import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Os módulos que o navegador importa — e, por transitividade, tudo que
// eles importam. `serialize.mjs` entra porque é a porta por onde o editor
// da Fase 2 vai emitir arquivo, e ela puxa `yaml-emit.mjs`; `rules.mjs`
// puxa `capabilities/v1.mjs`.
const MODULOS_PUROS = [
  'tools/rules.mjs',
  'tools/yaml-emit.mjs',
  'tools/serialize.mjs',
  'capabilities/v1.mjs',
];

// --- Prova estática: nenhum `node:*`, nenhum `process`, nenhum `require`
//
// Barata, roda em todo `npm test`, e pega a regressão mais provável (um
// `import { readFileSync } from 'node:fs'` acrescentado sem pensar). NÃO
// é prova de pureza transitiva nem de ausência em tempo de execução — é
// a prova de ida-e-volta em `vm` abaixo que fecha isso.
test('pureza (estática): nenhum módulo do navegador importa node:*, process ou require', () => {
  for (const rel of MODULOS_PUROS) {
    const src = readFileSync(join(RAIZ, rel), 'utf8');
    // Só o CÓDIGO: os comentários destes arquivos falam de `node:*` e de
    // `process` o tempo todo, justamente para explicar por que não os
    // usam.
    const codigo = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    assert.ok(!/from\s*['"]node:/.test(codigo), `${rel} importa node:*`);
    assert.ok(!/\brequire\s*\(/.test(codigo), `${rel} usa require()`);
    assert.ok(!/\bprocess\s*\./.test(codigo), `${rel} acessa process`);
  }
});

// --- Prova de execução: carregar os quatro módulos num contexto de `vm`
// montado de `Object.create(null)` — sem `process`, sem `require`, sem
// `Buffer`, sem `fs` — e com um linker que LANÇA em qualquer especificador
// nu. É o método que o revisor usou na revisão ampla de 2026-10-27, e
// aqui ele deixa de ser um experimento de revisão e passa a ser teste da
// suíte.
//
// Roda num processo FILHO porque `vm.SourceTextModule` exige
// `--experimental-vm-modules`, e `npm test` é `node --test` sem flag
// nenhuma (contrato da fase). O filho é a camada impura desta prova — o
// que está sob teste é o que acontece DENTRO do contexto.
const SANDBOX = [
  "import vm from 'node:vm';",
  "import { readFileSync } from 'node:fs';",
  "import { resolve, dirname } from 'node:path';",
  'const RAIZ = process.argv[1];',
  'const MODULOS = JSON.parse(process.argv[2]);',
  // Contexto sem nenhum global de host: o que existir aqui são só os
  // intrínsecos de JS (Object, Array, RegExp, JSON, Map, Set...).
  'const contexto = vm.createContext(Object.create(null));',
  'const cache = new Map();',
  'function compilar(caminho) {',
  '  if (cache.has(caminho)) return cache.get(caminho);',
  '  const mod = new vm.SourceTextModule(readFileSync(caminho, "utf8"),',
  '    { identifier: caminho, context: contexto });',
  '  cache.set(caminho, mod);',
  '  return mod;',
  '}',
  // Qualquer `import` que não seja caminho relativo é dependência de
  // ambiente, e o navegador não tem resolvedor para ela.
  'async function linker(especificador, referente) {',
  '  if (!especificador.startsWith(".")) {',
  '    throw new Error("ESPECIFICADOR_NU " + especificador + " em " + referente.identifier);',
  '  }',
  '  return compilar(resolve(dirname(referente.identifier), especificador));',
  '}',
  'const ns = {};',
  // `status` é consultado porque os quatro módulos se importam entre si
  // (serialize → yaml-emit, rules → capabilities/v1): quando o segundo
  // entra como entrada própria, o primeiro já o linkou, e `link()` duas
  // vezes lança ERR_VM_MODULE_STATUS.
  'for (const rel of MODULOS) {',
  '  const mod = compilar(resolve(RAIZ, rel));',
  '  if (mod.status === "unlinked") await mod.link(linker);',
  '  if (mod.status !== "evaluated") await mod.evaluate();',
  '  ns[rel] = mod.namespace;',
  '}',
  // O corpo do módulo rodou. Agora as funções também têm de rodar: um
  // `process.env` escondido dentro de uma função só aparece na chamada.
  'const { validatePackage, validateAcervo, globCasa } = ns["tools/rules.mjs"];',
  'const { emitYaml } = ns["tools/yaml-emit.mjs"];',
  'const { toMarkdown } = ns["tools/serialize.mjs"];',
  'const { VOCABULARY } = ns["capabilities/v1.mjs"];',
  'const pkg = {',
  '  slug: "t",',
  '  company: { path: "COMPANY.md", body: "corpo", frontmatter: { slug: "t", license: "MIT",',
  '    metadata: { human_gates: [{ id: "g", description: "g", signer: "p" }] } } },',
  '  agents: [{ path: "agents/a/AGENTS.md", slug: "a", body: "corpo", frontmatter: {',
  '    name: "A", title: "A", slug: "a", reportsTo: null, skills: ["s"],',
  '    metadata: { boundary: { can: ["ler"], cannot: ["fazer deploy"] },',
  '      capabilities: { read: ["repository"], write: [], execute: { allow: [], deny: [] }, network: false },',
  '      persona: { display_name: "Ana Vieira", icon: "X", pronouns: "ela/dela",',
  '        headline: "h", background: ["a", "b", "c"], strengths: ["x"], signature_question: "q?" } } } }],',
  '  skills: [], teams: [], tasks: [], projects: [], warnings: [], problems: [],',
  '};',
  'const veredito = validatePackage(pkg);',
  'const acervo = validateAcervo([pkg]);',
  'const yaml = emitYaml({ k: "a\\rb", lista: ["x"], mapa: { n: 1 } });',
  'const md = toMarkdown({ frontmatter: { name: "A" }, body: "\\n# A\\n" });',
  'const tipoMalformado = validatePackage({ ...pkg, agents: [{ ...pkg.agents[0],',
  '  frontmatter: { ...pkg.agents[0].frontmatter,',
  '    metadata: { ...pkg.agents[0].frontmatter.metadata, capabilities: "oops" } } }] });',
  // O que o contexto NÃO tem, perguntado de dentro dele.
  'const globais = vm.runInContext(',
  '  "[typeof process, typeof require, typeof Buffer, typeof module, typeof fs, typeof globalThis.process].join(\',\')",',
  '  contexto);',
  'console.log(JSON.stringify({',
  '  globais,',
  '  erros: veredito.errors.length,',
  '  avisos: veredito.warnings.length,',
  '  verificados: acervo.verificados,',
  '  vocabulario: Object.keys(VOCABULARY).length,',
  '  glob: globCasa("psql -*", "psql -c"),',
  '  yaml,',
  '  md,',
  '  e19: tipoMalformado.errors.filter((e) => e.code === "E19").map((e) => e.code),',
  '}));',
].join('\n');

test('pureza (execução): os módulos do navegador carregam e RODAM num vm.Context sem process, require, Buffer nem fs', () => {
  const saida = execFileSync(
    process.execPath,
    ['--experimental-vm-modules', '--input-type=module', '-e', SANDBOX,
      RAIZ, JSON.stringify(MODULOS_PUROS)],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const r = JSON.parse(saida);

  // O contexto é de fato nu: se algum destes virasse "object"/"function",
  // a prova inteira passaria a valer nada.
  assert.equal(r.globais, 'undefined,undefined,undefined,undefined,undefined,undefined',
    `o contexto do vm não estava nu: ${r.globais}`);

  // E os módulos funcionaram lá dentro, não só carregaram.
  assert.equal(r.erros, 0, 'pacote de controle deveria passar limpo dentro do sandbox');
  assert.equal(r.avisos, 0);
  assert.deepEqual(r.verificados, ['t']);
  assert.ok(r.vocabulario > 0);
  assert.equal(r.glob, true);
  // O emissor escapou o CR lá dentro (C3), e o serializador montou o
  // arquivo — as duas funções que o navegador chama para SALVAR.
  assert.match(r.yaml, /k: "a\\rb"/);
  assert.match(r.md, /^---\nname: A\n---\n\n# A\n$/);
  // E a regra de tipo reprovou o container malformado lá dentro (C1).
  assert.deepEqual(r.e19, ['E19']);
});
