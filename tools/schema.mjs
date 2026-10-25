// Camada impura: toca disco e YAML. Toda regra de validação vive em
// rules.mjs, que é puro. Esta separação é o que permite ao Studio
// reutilizar as regras no browser.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import yaml from 'js-yaml';
import { normalizeAliases } from './rules.mjs';

const DELIM = /^---\r?\n/;

export function parseMarkdown(text) {
  if (!DELIM.test(text)) {
    throw new Error('arquivo sem frontmatter YAML: esperado "---" na primeira linha');
  }
  const rest = text.replace(DELIM, '');
  const end = rest.search(/^---\r?$/m);
  if (end === -1) {
    throw new Error('frontmatter YAML não fechado: falta o "---" de fechamento');
  }
  // CORE_SCHEMA por decisão de segurança: o acervo é público e aceita
  // pacote de terceiro. Só escalar, mapa e sequência; nenhuma tag
  // customizada é construída. Ver Global Constraints do plano.
  const frontmatter = yaml.load(rest.slice(0, end), { schema: yaml.CORE_SCHEMA }) ?? {};
  const body = rest.slice(end).replace(/^---\r?\n?/, '');
  return { frontmatter, body };
}

function loadFile(dir, relPath, warnings) {
  const text = readFileSync(join(dir, relPath), 'utf8');
  const { frontmatter, body } = parseMarkdown(text);
  if (frontmatter.metadata) {
    const r = normalizeAliases(frontmatter.metadata);
    frontmatter.metadata = r.meta;
    for (const w of r.warnings) warnings.push({ ...w, file: relPath });
  }
  return { path: relPath, frontmatter, body };
}

function loadCollection(dir, sub, filename, warnings) {
  const base = join(dir, sub);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((name) => statSync(join(base, name)).isDirectory())
    .filter((name) => existsSync(join(base, name, filename)))
    .sort()
    .map((name) => {
      const file = loadFile(dir, join(sub, name, filename), warnings);
      return { ...file, slug: file.frontmatter.slug ?? name };
    });
}

export function loadPackage(dir) {
  const warnings = [];
  const company = loadFile(dir, 'COMPANY.md', warnings);
  return {
    slug: company.frontmatter.slug ?? basename(dir),
    dir,
    company,
    agents: loadCollection(dir, 'agents', 'AGENTS.md', warnings),
    skills: loadCollection(dir, 'skills', 'SKILL.md', warnings),
    teams: loadCollection(dir, 'teams', 'TEAM.md', warnings),
    tasks: loadCollection(dir, 'tasks', 'TASK.md', warnings),
    warnings,
  };
}

export function listPackages(root) {
  return readdirSync(root)
    .filter((name) => !name.startsWith('.') && !name.startsWith('_'))
    .filter((name) => existsSync(join(root, name, 'COMPANY.md')))
    .sort();
}

export { relative };
