// Guarda de sanidade pós-emissão do `--fix`, extraída de validate.mjs
// para ser testável isolada (fix round 3 da Task 6: "guarda sem caso que
// falha não está provada" — ver test/validate-cli.test.mjs).
//
// Este módulo NÃO escreve arquivo nenhum — não importa `writeFileSync`
// nem qualquer outra capacidade de escrita, só `parseMarkdown` (leitura).
// Ele decide SE é seguro gravar; quem grava é o caller (validate.mjs),
// e só grava quando `verificarEmissao` devolve `{ ok: true }`.
import { parseMarkdown } from './schema.mjs';

// Acha o primeiro caminho onde `a` e `b` divergem — serve para NOMEAR o
// campo na mensagem de erro. Não decide por si só se divergem: isso é o
// caller comparando o retorno com `null`.
export function primeiraDiferenca(a, b, caminho = '$') {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null) return caminho;
  if (Array.isArray(a) !== Array.isArray(b)) return caminho;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return caminho;
    for (let i = 0; i < a.length; i += 1) {
      const d = primeiraDiferenca(a[i], b[i], `${caminho}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (typeof a === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = primeiraDiferenca(a[k], b[k], `${caminho}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return caminho;
}

// Recebe o frontmatter de ORIGEM e o texto JÁ EMITIDO (markdown com
// frontmatter) — não precisa que o texto tenha saído do emissor real; um
// teste pode construir um texto divergente à mão. Reparseia com o mesmo
// `yaml.load` + `CORE_SCHEMA` da leitura (via `parseMarkdown`) e compara.
// `{ ok: true }` autoriza o caller a gravar; `{ ok: false, motivo }` nomeia
// o campo que divergiu (ou o erro de parse), para a mensagem do CLI.
export function verificarEmissao(frontmatterOriginal, textoEmitido) {
  let reparsed;
  try {
    reparsed = parseMarkdown(textoEmitido).frontmatter;
  } catch (e) {
    return { ok: false, motivo: `emitiu YAML que nem reparseia (${e.message})` };
  }
  const campo = primeiraDiferenca(frontmatterOriginal, reparsed);
  if (campo) {
    return { ok: false, motivo: `mudaria de sentido na reemissão (campo ${campo} diverge do original)` };
  }
  return { ok: true };
}
