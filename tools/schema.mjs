// Camada impura: toca disco e YAML. Toda regra de validação vive em
// rules.mjs, que é puro. Esta separação é o que permite ao Studio
// reutilizar as regras no browser.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
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

// Toda falha de leitura ou parse carrega o caminho relativo do arquivo —
// é o único frame que conhece esse caminho. Sem isso, quem recebe o erro
// (loadCollection, ou o catch de borda no CLI) só sabe "algo falhou",
// nunca o quê.
function loadFile(dir, relPath, warnings) {
  let text;
  try {
    text = readFileSync(join(dir, relPath), 'utf8');
  } catch (e) {
    throw new Error(`${relPath}: não foi possível ler o arquivo (${e.code ?? e.message})`);
  }
  let parsed;
  try {
    parsed = parseMarkdown(text);
  } catch (e) {
    throw new Error(`${relPath}: ${e.message}`);
  }
  const { frontmatter, body } = parsed;
  if (frontmatter.metadata) {
    const r = normalizeAliases(frontmatter.metadata);
    frontmatter.metadata = r.meta;
    for (const w of r.warnings) warnings.push({ ...w, file: relPath });
  }
  return { path: relPath, frontmatter, body };
}

// Falha em UM item da coleção (ex.: um AGENTS.md com YAML malformado) não
// pode abortar o pacote inteiro — os outros agentes do mesmo pacote
// continuam válidos e merecem ser reportados como tal. O item quebrado
// sai da coleção e entra em `problems`, nomeado pelo caminho e pela causa;
// a função que chama loadPackage decide o que fazer com isso (reportar
// como erro E12, por exemplo) — esta camada só coleta.
function loadCollection(dir, sub, filename, warnings, problems) {
  const base = join(dir, sub);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((name) => statSync(join(base, name)).isDirectory())
    .filter((name) => existsSync(join(base, name, filename)))
    .sort()
    .map((name) => {
      const relPath = join(sub, name, filename);
      try {
        const file = loadFile(dir, relPath, warnings);
        return { ...file, slug: file.frontmatter.slug ?? name };
      } catch (e) {
        problems.push({ code: 'E12', rule: 'arquivo-malformado', where: relPath, message: e.message });
        return null;
      }
    })
    .filter((item) => item !== null);
}

export function loadPackage(dir) {
  const warnings = [];
  const problems = [];
  // COMPANY.md é a âncora do pacote (slug, license, human_gates); se ele
  // não carrega, não há pacote coerente para validar — a falha sobe para
  // quem chamou loadPackage, já com o nome do arquivo embutido por loadFile.
  const company = loadFile(dir, 'COMPANY.md', warnings);
  const projects = loadCollection(dir, 'projects', 'PROJECT.md', warnings, problems);
  // `projects/<slug>/tasks/<slug>/TASK.md` é ANINHADO, duas pastas abaixo —
  // loadCollection só varre `<sub>/<nome>/<arquivo>`, logo essas tarefas
  // precisam de uma segunda passada.
  for (const proj of projects) {
    proj.tasks = loadCollection(dir, join('projects', proj.slug, 'tasks'), 'TASK.md', warnings, problems);
  }
  return {
    slug: company.frontmatter.slug ?? basename(dir),
    dir,
    company,
    agents: loadCollection(dir, 'agents', 'AGENTS.md', warnings, problems),
    skills: loadCollection(dir, 'skills', 'SKILL.md', warnings, problems),
    teams: loadCollection(dir, 'teams', 'TEAM.md', warnings, problems),
    tasks: loadCollection(dir, 'tasks', 'TASK.md', warnings, problems),
    projects,
    warnings,
    problems,
  };
}

export function listPackages(root) {
  return readdirSync(root)
    .filter((name) => !name.startsWith('.') && !name.startsWith('_'))
    .filter((name) => existsSync(join(root, name, 'COMPANY.md')))
    .sort();
}

