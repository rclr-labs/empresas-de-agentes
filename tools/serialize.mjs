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
  // O corpo é conteúdo de terceiro e NÃO se reformata. Duas armadilhas,
  // as duas medidas: `\s` casa `\r`, então `replace(/\s*$/, '\n')` engolia
  // o CR de um arquivo CRLF; e `startsWith('\n')` é falso para um corpo
  // iniciado em `\r\n`, duplicando a linha em branco. Resultado medido:
  // "\r\n# Titulo\r\nlinha\r\n" saía "\n\r\n# Titulo\r\nlinha\n".
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const fm = yaml.dump(frontmatter, DUMP).trimEnd().split(/\r?\n/).join(eol);
  const corpo = /^\r?\n/.test(body) ? body : `${eol}${body}`;
  // Normaliza só QUEBRA DE LINHA no fim, nunca espaço: espaço no fim da
  // última linha é conteúdo, e apagá-lo é mudar arquivo de terceiro.
  return `---${eol}${fm}${eol}---${eol}${corpo.replace(/(?:\r?\n)*$/, eol)}`;
}
