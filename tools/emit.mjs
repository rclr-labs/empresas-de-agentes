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
const aplicados = [];

for (const agente of pkg.agents) {
  const applied = applyBinding(agente, binding, pkg);
  aplicados.push({ agente, applied });
  for (const l of applied.lost) perdas.push({ slug: agente.slug, ...l });
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
}

console.log(`${pkg.slug} → ${runtime}: ${pkg.agents.length} agente(s) em ${out}`);

if (perdas.length) {
  console.log(`\nAVISO — ${perdas.length} capacidade(s) perdida(s) nesta emissão:`);
  for (const p of perdas) {
    console.log(`  ${p.slug}: ${p.capability} — ${p.reason}`);
  }
  console.log('\nA fronteira perdida continua escrita no pacote e precisa ser aplicada fora do runtime.');
}
