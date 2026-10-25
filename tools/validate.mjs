#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadPackage, listPackages } from './schema.mjs';
import { validatePackage } from './rules.mjs';
import { toMarkdown } from './serialize.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const fix = argv.includes('--fix');
const json = argv.includes('--json');
const alvos = argv.filter((a) => !a.startsWith('--'));

// --fix é a única operação destrutiva deste CLI, e sem alvo ele significa
// "todos os pacotes do repositório". Medido: os pacotes publicados têm 47
// avisos de alias, logo um `npm run validate -- --fix` reescreveria os dois
// na hora. A guarda vive aqui, na ferramenta, e não num aviso ao operador.
if (fix && alvos.length === 0) {
  console.error('--fix exige alvo explícito. Sem alvo, ele reescreveria todos os pacotes do repositório.');
  console.error('uso: node tools/validate.mjs <pacote> [--fix]');
  process.exit(2);
}

const dirs = alvos.length
  ? alvos.map((a) => resolve(a))
  : listPackages(RAIZ).map((n) => join(RAIZ, n));

const relatorio = { packages: [], errors: 0, warnings: 0 };

for (const dir of dirs) {
  let pkg;
  try {
    pkg = loadPackage(dir);
  } catch (e) {
    // COMPANY.md não carregou (ausente, YAML malformado, etc.): não há
    // pacote coerente para validar. loadFile já embutiu o caminho relativo
    // do arquivo ofensor em e.message — erro acionável, não stack trace.
    relatorio.packages.push({
      slug: dir,
      errors: [{ code: 'E12', rule: 'arquivo-malformado', where: dir, message: e.message }],
      warnings: [],
    });
    relatorio.errors += 1;
    continue;
  }

  const { errors, warnings } = validatePackage(pkg);
  // pkg.problems: itens da coleção (um AGENTS.md malformado, por exemplo)
  // que loadPackage já isolou sem abortar o resto do pacote. Entram no
  // relatório como erros — e, por isso, contam para o exit code — ao lado
  // dos erros de regra.
  const todosErros = [...(pkg.problems ?? []), ...errors];
  relatorio.packages.push({ slug: pkg.slug, errors: todosErros, warnings });
  relatorio.errors += todosErros.length;
  relatorio.warnings += warnings.length;

  const temAlias = warnings.some((w) => w.code === 'W01' || w.code === 'W02');
  if (fix && temAlias && todosErros.length > 0) {
    console.error(`${pkg.slug}: --fix NÃO aplicado — o pacote tem ${todosErros.length} erro. Reescrever arquivo que o validador acabou de reprovar esconde o defeito atrás de uma mudança de formatação. Corrija os erros e rode de novo.`);
  } else if (fix && temAlias) {
    // O pkg já vem normalizado por loadPackage; reescrever o arquivo
    // a partir dele é o próprio fix.
    for (const arquivo of [pkg.company, ...pkg.agents, ...pkg.skills, ...pkg.teams, ...pkg.tasks]) {
      writeFileSync(join(dir, arquivo.path), toMarkdown(arquivo), 'utf8');
    }
  }
}

if (json) {
  console.log(JSON.stringify(relatorio, null, 2));
} else {
  for (const p of relatorio.packages) {
    const status = p.errors.length ? 'FALHOU' : 'ok';
    console.log(`\n${p.slug}: ${status}  (${p.errors.length} erro, ${p.warnings.length} aviso)`);
    for (const e of p.errors) console.log(`  ${e.code} ${e.where}\n       ${e.message}`);
    for (const w of p.warnings) console.log(`  ${w.code} ${w.file ?? w.path}\n       ${w.message}`);
  }
  console.log(`\ntotal: ${relatorio.errors} erro, ${relatorio.warnings} aviso`);
  if (fix) console.log('--fix aplicado: alias reescritos para canônico');
}

process.exit(relatorio.errors > 0 ? 1 : 0);
