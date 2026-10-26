#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { loadPackage } from './schema.mjs';
import { validatePackage } from './rules.mjs';
import { applyBinding } from './bindings.mjs';
import { writers, portableManifest } from './writers.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? null : process.argv[i + 1];
}

const alvo = arg('package');
const runtime = arg('binding');
const out = arg('out');
const verbose = process.argv.includes('--verbose');

if (!alvo || !runtime || !out) {
  console.error('uso: node tools/emit.mjs --package <slug|dir> --binding <runtime> --out <dir>');
  process.exit(2);
}

const dirPacote = existsSync(alvo) ? resolve(alvo) : join(RAIZ, alvo);
const arquivoBinding = join(RAIZ, 'bindings', `${runtime}.yml`);
if (!existsSync(arquivoBinding)) {
  console.error(`binding "${runtime}" não existe. Disponíveis em bindings/`);
  process.exit(2);
}

const binding = yaml.load(readFileSync(arquivoBinding, 'utf8'), { schema: yaml.CORE_SCHEMA });
const pkg = loadPackage(dirPacote);
const { errors } = validatePackage(pkg);
// pkg.problems: itens de coleção que não carregaram (ex.: AGENTS.md
// malformado) — loadPackage já os isola sem abortar o pacote inteiro, mas
// emitir um pacote com arquivo quebrado é tão inválido quanto emitir um
// com erro de regra. O mesmo padrão de tools/validate.mjs.
const todosErros = [...(pkg.problems ?? []), ...errors];

if (todosErros.length) {
  console.error(`emissão recusada: pacote "${pkg.slug}" é inválido (${todosErros.length} erro)`);
  for (const e of todosErros) console.error(`  ${e.code} ${e.where}: ${e.message}`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
const perdas = [];
const preservadas = [];
const avisos = [];
const aplicados = [];

for (const agente of pkg.agents) {
  const applied = applyBinding(agente, binding, pkg);
  aplicados.push({ agente, applied });
  for (const l of applied.lost) perdas.push({ slug: agente.slug, ...l });
  for (const p of applied.preserved) preservadas.push({ slug: agente.slug, ...p });
  for (const w of applied.warnings) avisos.push({ slug: agente.slug, ...w });
}

if (binding.format === 'portable') {
  const { path, content } = portableManifest(pkg, binding, aplicados);
  writeFileSync(join(out, path), content, 'utf8');
} else if (binding.format === 'identity') {
  // Identidade de verdade: cópia byte a byte da ÁRVORE INTEIRA, não das
  // coleções que o loader conhece. Copiar por enumeração (company +
  // agents + skills + teams + tasks) foi exatamente o que deixou
  // projects/ invisível à emissão "zero perda" — qualquer diretório novo
  // que loadPackage ainda não saiba nomear repetiria o defeito. Andar o
  // disco em vez de enumerar fecha a CLASSE do problema, não só a
  // instância medida.
  const copiarArvore = (relativo) => {
    for (const entrada of readdirSync(join(pkg.dir, relativo), { withFileTypes: true })) {
      if (entrada.name.startsWith('.')) continue;
      const rel = relativo ? join(relativo, entrada.name) : entrada.name;
      if (entrada.isDirectory()) { copiarArvore(rel); continue; }
      const destino = join(out, rel);
      mkdirSync(dirname(destino), { recursive: true });
      copyFileSync(join(pkg.dir, rel), destino);
    }
  };
  copiarArvore('');
} else {
  const escritor = writers[binding.format];
  if (!escritor) {
    console.error(`binding declara format "${binding.format}", que não tem escritor`);
    process.exit(2);
  }
  for (const { agente, applied } of aplicados) {
    const { path, content } = escritor(agente, applied, pkg, binding);
    const destino = join(out, path);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, content, 'utf8');
  }
  // network.allowlist, Claude Code: o binding declara `translates` desde
  // o fix round 1 porque este bloco de fato EMITE o mecanismo —
  // `.claude/settings.json` com `sandbox.network.allowedDomains`, união
  // dos domínios de `capabilities.network` de todo agente do pacote.
  // Escopo de PROJETO, não por agente — ver o caveat em
  // bindings/claude-code.yml (allowlist_scope). Escrito só quando há ao
  // menos um domínio a declarar; pacote sem nenhum papel com allowlist
  // de rede não ganha um settings.json vazio.
  if (binding.format === 'claude-code') {
    const dominios = new Set();
    for (const agente of pkg.agents) {
      const cap = agente.frontmatter?.metadata?.capabilities ?? {};
      if (Array.isArray(cap.network)) for (const d of cap.network) dominios.add(d);
    }
    if (dominios.size) {
      const settings = { sandbox: { network: { allowedDomains: [...dominios].sort() } } };
      const destino = join(out, '.claude', 'settings.json');
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    }
  }
}

console.log(`${pkg.slug} → ${runtime}: ${pkg.agents.length} agente(s) em ${out}`);

// Três saídas distintas, de propósito: PRESERVADA não é perdida (o dado
// sobrevive no arquivo, só não é agido pelo runtime) e PERDIDA não é
// preservada (nem sobrevive, nem é honrada) — tratar as duas como a
// mesma coisa é exatamente o "no loss" que a tarefa 27 existe para
// corrigir, porque "paperclip copia byte a byte" e "claude-code aplica a
// permissão" não são a mesma garantia.
//
// Fix round 1 (achado 2 da auditoria): PRESERVADA agrega por MOTIVO, não
// por papel × capacidade. Quando toda capacidade de um pacote some sob o
// mesmo motivo (identidade/portable: a spec base não define a maioria),
// listar papel × capacidade produz 49, 66, 72 linhas carregando uma
// única informação — o sinal real (as poucas perdas nomeadas de
// claude-code/opencode) passa a competir com ruído, e um operador que
// aprende a pular esse bloco aprende a pular a parte que importa. PERDIDA
// continua item a item, sempre: perda é rara e específica, cada uma
// nomeia uma lacuna diferente — agregar aqui esconderia exatamente o que
// a tarefa 27 existe para não esconder.
function agruparPorMotivo(itens) {
  const grupos = new Map();
  for (const it of itens) {
    if (!grupos.has(it.reason)) grupos.set(it.reason, []);
    grupos.get(it.reason).push(it);
  }
  return grupos;
}

if (preservadas.length) {
  const grupos = agruparPorMotivo(preservadas);
  console.log(`\nAVISO — ${preservadas.length} capacidade(s) PRESERVADA(S) mas não aplicada(s), por ${grupos.size} motivo(s):`);
  for (const [motivo, itens] of grupos) {
    const slugsUnicos = [...new Set(itens.map((i) => i.slug))];
    const papeis = slugsUnicos.length === pkg.agents.length
      ? `todos os ${pkg.agents.length}`
      : slugsUnicos.join(', ');
    console.log(`  [${itens.length}] ${motivo}`);
    console.log(`       papéis: ${papeis}`);
  }
  if (verbose) {
    console.log('\n  Detalhe por papel:');
    for (const p of preservadas) console.log(`    ${p.slug}: ${p.capability} — ${p.reason}`);
  } else {
    console.log('\n  Detalhe por papel: --verbose');
  }
}

if (perdas.length) {
  console.log(`\nAVISO — ${perdas.length} capacidade(s) PERDIDA(S):`);
  for (const p of perdas) {
    console.log(`  ${p.slug}: ${p.capability} — ${p.reason}`);
  }
  console.log('\nA fronteira perdida continua escrita no pacote e precisa ser aplicada fora do runtime.');
}

if (avisos.length) {
  console.log(`\nAVISO — ${avisos.length} ressalva(s) de fronteira:`);
  for (const a of avisos) {
    console.log(`  ${a.slug}: ${a.message}`);
  }
}
