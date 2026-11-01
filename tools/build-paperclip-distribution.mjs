#!/usr/bin/env node
// Gera, a partir de um pacote validado, o diretório pronto para
// `npx paperclipai@latest company import <dir>`. Reaproveita tools/emit.mjs
// (binding `paperclip`, format identity) para a cópia do pacote, e só
// acrescenta o `.paperclip.yaml` — extensão vendor do Paperclip (adapter por
// agente), fora do schema agentcompanies/v1 por desenho: não entra no pacote
// fonte, só no diretório de distribuição.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? null : process.argv[i + 1];
}

const alvo = arg('package');
const out = arg('out');

if (!alvo || !out) {
  console.error('uso: node tools/build-paperclip-distribution.mjs --package <slug> --out <dir>');
  process.exit(2);
}

const emit = spawnSync(
  process.execPath,
  [join(RAIZ, 'tools', 'emit.mjs'), '--package', alvo, '--binding', 'paperclip', '--out', out],
  { stdio: 'inherit' },
);
if (emit.status !== 0) process.exit(emit.status ?? 1);

const dirAgentes = join(out, 'agents');
const slugs = existsSync(dirAgentes)
  ? readdirSync(dirAgentes, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  : [];

const agents = {};
for (const slug of slugs) agents[slug] = { adapter: { type: 'claude_local' } };

const conteudo = yaml.dump({ schema: 'paperclip/v1', agents }, { sortKeys: false });
writeFileSync(join(out, '.paperclip.yaml'), conteudo, 'utf8');

console.log(`.paperclip.yaml escrito em ${out} (${slugs.length} agente(s), adapter claude_local)`);
