// PURO POR CONTRATO: nenhum import, nenhum `node:*`, nenhum `process`,
// nenhuma dependência. O Studio importa este módulo direto no browser,
// offline e sem CDN — é a única razão de ele existir separado de
// serialize.mjs (que é a camada impura, com fs e path).
//
// Emite o subconjunto de YAML que o nosso schema usa — escalar, string,
// array e mapa aninhado — e faz isso PRESERVANDO o estilo que o acervo
// já tem escrito à mão (fluxo vs. bloco, quando citar), não um estilo
// canônico novo. Não é um emissor de YAML completo e não pretende ser;
// o teste de paridade byte-a-byte contra os 85 arquivos reais do acervo
// é o que define exatamente o que ele tem de cobrir — ver
// test/yaml-emit.test.mjs.

// Strings que o YAML releria como outro tipo, ou que abrem com caractere
// de sintaxe, precisam de aspas — regra padrão de qualquer emissor YAML.
const RESERVADAS = /^(true|false|null|yes|no|on|off|~)$/i;
const NUMERICA = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const DATA = /^\d{4}-\d{2}-\d{2}/;
// "#" só é início de comentário em YAML quando precedido de espaço (ou é
// o primeiro caractere, já coberto pela classe de abertura) — por isso
// o teste é `\s#`, não `#\s`: "C#" dentro de uma frase, sem espaço
// ANTES do #, é seguro sem aspas, e o acervo confirma isso em
// `stack-dotnet/SKILL.md` ("...C# — SDK..." não citado).
const PERIGOSO = /^[\s>|*&!%@`#?,[\]{}'"-]|: |\s#|\s$|^$/;

// Convenção AUTORAL do acervo, medida nos 85 arquivos (não exigida pela
// gramática YAML): todo valor com "?", "*" ou emoji/símbolo em QUALQUER
// posição sai citado — ex.: um signature_question termina em "?", um
// padrão de comando sai como "kubectl apply*", um icon de persona é
// "🔎". A gramática YAML exigiria aspas só se esses caracteres abrissem
// a string; o acervo é mais rígido que isso por escolha editorial, e
// preservar essa escolha é o que torna a ida-e-volta byte-a-byte.
const SIMBOLO_AUTORAL = /[?*]|\p{Extended_Pictographic}/u;

// Mesma convenção, só dentro de sequência em fluxo: todo hostname/domínio
// (contém ".") que o acervo escreve numa lista `[a, b]` sai citado — ex.
// `network: ["api-staging.exemplo.com.br"]`. Medido nas 6 ocorrências de
// `network` em fluxo do acervo: sem excecao. Fora de fluxo (bloco), o
// mesmo domínio sai sem aspas (`ref: ../../COMPANY.md`), por isso o
// ponto só pesa dentro de `[...]`.

// Escapa para dentro de aspas duplas, nesta ORDEM exata: backslash
// primeiro, newline depois, aspas por último. Inverter os dois primeiros
// quebra: escapar "\n" (newline real → sequência "\n") ANTES de escapar
// backslash faz o escape de backslash re-processar o backslash que o
// passo anterior acabou de inserir, dobrando-o ("\n" viraria "\\n", que
// religa como backslash+"n" literal, não newline). Medido reparseando os
// dois caminhos com `yaml.load`: só backslash→newline→aspas fecha
// `"a\nb"` de volta em "a\nb" (com newline real).
function citar(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`;
}

// Newline literal força aspas mesmo sem nenhum outro gatilho: um escalar
// plano com "\n" dentro é YAML estruturalmente inválido ("a multiline key
// may not be an implicit key"), e um escalar já citado por OUTRO motivo
// que contenha newline cru sofre line folding do YAML citado — o
// newline vira espaço na releitura, perda silenciosa de dado. Nenhum dos
// 85 arquivos do acervo tem newline em valor de frontmatter; isto é
// necessário para o editor da vitrine (Fase 2), que gera frontmatter a
// partir de formulário.
const TEM_NEWLINE = /\n/;

function escalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (TEM_NEWLINE.test(s) || RESERVADAS.test(s) || NUMERICA.test(s) || DATA.test(s)
    || PERIGOSO.test(s) || SIMBOLO_AUTORAL.test(s)) {
    return citar(s);
  }
  return s;
}

function escalarEmFluxo(v) {
  if (typeof v === 'string' && v.includes('.') && !TEM_NEWLINE.test(v) && !RESERVADAS.test(v)
    && !NUMERICA.test(v) && !DATA.test(v) && !PERIGOSO.test(v) && !SIMBOLO_AUTORAL.test(v)) {
    return citar(v);
  }
  return escalar(v);
}

// Chave de mapa tem perigo que valor não tem, e perigo que valor também
// tem (newline) — por isso é variante de escalar(), não a mesma função.
// NÃO reaplica RESERVADAS/NUMERICA/DATA: uma chave YAML "true" ou "42"
// sem aspas resolve para o escalar booleano/numérico correspondente,
// mas ao entrar num objeto JS a propriedade é coagida de volta para a
// MESMA string ("true", "42") — não há perda, então citar por isso seria
// aspas cosméticas, não corretivas. O que É corretivo, medido ao vivo
// pela revisão: "a #b" (espaço+hash no meio é comentário — o par some
// inteiro, silencioso), "key " (espaço final — perdido na releitura,
// silencioso), "a: b" (dois-pontos+espaço — chave YAML inválida, estoura
// no reparse), "" (chave vazia — YAML inválido), e newline (mesma razão
// do valor).
function chaveEmYaml(chave) {
  const s = String(chave);
  if (TEM_NEWLINE.test(s) || PERIGOSO.test(s)) {
    return citar(s);
  }
  return s;
}

const ehMapa = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const vazio = (v) => (Array.isArray(v) && v.length === 0) || (ehMapa(v) && Object.keys(v).length === 0);

// Chaves que o acervo escreve à mão em fluxo — medido nos 85 arquivos:
// são exatamente estas oito, sempre que a lista não é vazia e só tem
// escalar. Todo outro campo de array do schema (tags, goals, secrets,
// authors, boundary.can/cannot, persona.background/strengths,
// context.sources/excludes, skills, …) vai em bloco, sempre. Esta é
// a razão de existir deste conjunto: sem preservar a escolha, corrigir
// UM alias com --fix reescreveria as 42 listas de capabilities do
// acervo — ver nota em serialize.mjs.
const CHAVES_EM_FLUXO = new Set(['read', 'write', 'allow', 'deny', 'delegate', 'approve', 'writes', 'network']);

function arrayEscalarEmFluxo(valor) {
  return Array.isArray(valor) && valor.every((item) => !ehMapa(item) && !Array.isArray(item));
}

// `monthly_cap` é o único campo numérico do schema com convenção de 2
// casas decimais (ex.: 500.00) — medido nas 13 ocorrências do acervo.
// Um `number` do JS não guarda ".00": `String(500)` é "500", não
// "500.00", e isso quebraria a ida-e-volta de todo orçamento do acervo.
// `alert_at`, o outro campo numérico do schema, já é fração (0.7) e
// bate com `String()` sem ajuste — por isso o caso não generaliza além
// deste único nome de campo.
function escalarDeChave(chave, v) {
  if (chave === 'monthly_cap' && typeof v === 'number') return v.toFixed(2);
  return escalar(v);
}

export function emitYaml(valor, indent = 0) {
  const pad = '  '.repeat(indent);
  const linhas = [];

  if (Array.isArray(valor)) {
    for (const item of valor) {
      if (vazio(item)) {
        linhas.push(`${pad}- ${Array.isArray(item) ? '[]' : '{}'}`);
      } else if (ehMapa(item) || Array.isArray(item)) {
        // Computa o filho SEM indentação (indent 0) e reindenta à mão,
        // linha a linha — chamar emitYaml(item, indent + 1) e só
        // trimStart() a primeira linha deixa as linhas 2+ já indentadas
        // pela chamada recursiva, e o join reindenta por cima,
        // dobrando o espaçamento. Medido num mapa de dois campos
        // (context.sources) a três níveis de profundidade.
        const [primeira, ...resto] = emitYaml(item, 0).trimEnd().split('\n');
        linhas.push(`${pad}- ${primeira}`, ...resto.map((l) => `${pad}  ${l}`));
      } else {
        linhas.push(`${pad}- ${escalar(item)}`);
      }
    }
    return `${linhas.join('\n')}\n`;
  }

  if (ehMapa(valor)) {
    for (const [chave, v] of Object.entries(valor)) {
      const chaveEmitida = chaveEmYaml(chave);
      if (vazio(v)) {
        linhas.push(`${pad}${chaveEmitida}: ${Array.isArray(v) ? '[]' : '{}'}`);
      } else if (Array.isArray(v) && CHAVES_EM_FLUXO.has(chave) && arrayEscalarEmFluxo(v)) {
        linhas.push(`${pad}${chaveEmitida}: [${v.map((item) => escalarEmFluxo(item)).join(', ')}]`);
      } else if (Array.isArray(v) || ehMapa(v)) {
        linhas.push(`${pad}${chaveEmitida}:`);
        linhas.push(emitYaml(v, indent + 1).trimEnd());
      } else {
        linhas.push(`${pad}${chaveEmitida}: ${escalarDeChave(chave, v)}`);
      }
    }
    return `${linhas.join('\n')}\n`;
  }

  return `${pad}${escalar(valor)}\n`;
}
