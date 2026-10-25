import yaml from 'js-yaml';

// Opções travadas para diff estável em arquivo versionado. Mudar
// qualquer uma reescreve todo o acervo no próximo --fix.
const DUMP = {
  lineWidth: -1,
  quotingType: '"',
  noRefs: true,
  sortKeys: false,
  schema: yaml.CORE_SCHEMA,
};

export function toMarkdown({ frontmatter, body }) {
  const fm = yaml.dump(frontmatter, DUMP).trimEnd();
  const corpo = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${fm}\n---\n${corpo.replace(/\s*$/, '\n')}`;
}
