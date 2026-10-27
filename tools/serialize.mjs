// Sem js-yaml: o Studio precisa deste módulo no browser, offline e sem
// CDN. O emissor próprio (yaml-emit.mjs, puro) cobre o nosso schema e
// preserva o estilo autoral (fluxo vs. bloco, quando citar) — a prova é
// test/yaml-emit.test.mjs, que reemite os 85 arquivos reais do acervo e
// exige byte-a-byte. js-yaml fica só na LEITURA, em tools/schema.mjs.
import { emitYaml } from './yaml-emit.mjs';

export function toMarkdown({ frontmatter, body }) {
  // O corpo é conteúdo de terceiro e NÃO se reformata. Duas armadilhas,
  // as duas medidas: `\s` casa `\r`, então `replace(/\s*$/, '\n')` engolia
  // o CR de um arquivo CRLF; e `startsWith('\n')` é falso para um corpo
  // iniciado em `\r\n`, duplicando a linha em branco. Resultado medido:
  // "\r\n# Titulo\r\nlinha\r\n" saía "\n\r\n# Titulo\r\nlinha\n".
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const fm = emitYaml(frontmatter).trimEnd().split(/\r?\n/).join(eol);
  const corpo = /^\r?\n/.test(body) ? body : `${eol}${body}`;
  // Normaliza só QUEBRA DE LINHA no fim, nunca espaço: espaço no fim da
  // última linha é conteúdo, e apagá-lo é mudar arquivo de terceiro.
  return `---${eol}${fm}${eol}---${eol}${corpo.replace(/(?:\r?\n)*$/, eol)}`;
}
