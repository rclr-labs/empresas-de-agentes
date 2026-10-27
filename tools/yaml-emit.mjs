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
// As OUTRAS grafias que o core schema do YAML 1.2 também resolve para
// número — e que `NUMERICA` (decimal) não alcança. Medido reparseando com
// `yaml.load`: `0x1f` volta 31, `0o17` volta 15, `0b101` volta 5, `.inf`
// volta Infinity e `.nan` volta NaN. É string virando NÚMERO em
// silêncio, a mesma classe de perda do `\r`: nenhum parser reclama, o
// dado só muda de tipo. Nenhum dos 85 arquivos do acervo casa estas
// grafias (medido antes de escrever isto), então a paridade byte-a-byte
// não muda.
const NUMERICA_NAO_DECIMAL = /^[-+]?(0x[0-9a-fA-F]+|0o[0-7]+|0b[01]+)$|^[-+]?\.(inf|nan)$/i;
const DATA = /^\d{4}-\d{2}-\d{2}/;
// "#" só é início de comentário em YAML quando precedido de espaço (ou é
// o primeiro caractere, já coberto pela classe de abertura) — por isso
// o teste é `\s#`, não `#\s`: "C#" dentro de uma frase, sem espaço
// ANTES do #, é seguro sem aspas, e o acervo confirma isso em
// `stack-dotnet/SKILL.md` ("...C# — SDK..." não citado).
//
// `:` no FIM da string entra junto com `: ` (dois-pontos + espaço), por
// isso `:(\s|$)` e não `: `: medido com `yaml.load`, o escalar plano
// `k: a:` estoura em "bad indentation of a mapping entry" — o parser lê o
// `:` final como abertura de mapa aninhado, igual ao que faz com `a: b`.
// Era o único indicador de YAML da tabela adversarial que ainda produzia
// documento inválido depois do fix dos caracteres de controle.
const PERIGOSO = /^[\s>|*&!%@`#?,[\]{}'"-]|:(\s|$)|\s#|\s$|^$/;

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

// Caractere de CONTROLE força aspas mesmo sem nenhum outro gatilho, e tem
// de sair ESCAPADO dentro delas. Três comportamentos distintos, os três
// medidos reparseando com `yaml.load`:
//
//   - `\n` ou `\r` cru num escalar PLANO é YAML estruturalmente inválido
//     ("a multiline key may not be an implicit key");
//   - `\n` ou `\r` cru num escalar JÁ CITADO por outro motivo sofre *line
//     folding* do YAML citado: `"a\rb"` relê como "a b" e `"a\r\nb"` como
//     "a \nb" — perda SILENCIOSA de dado;
//   - os demais controles (TAB, VT, FF, NUL, ESC, BEL, BS, DEL) fazem
//     `js-yaml` recusar o documento inteiro ("the stream contains
//     non-printable characters", "null byte is not allowed in input").
//
// A guarda cobriu só `\n` de 2026-10-27 até a revisão ampla do mesmo dia,
// e `\r` passava cru LOGO ABAIXO dela — a quinta camada da mesma família
// (o fix do `\n` fechou a quarta). Por isso o critério aqui não é um
// caractere, é a CLASSE inteira (todo ponto de código abaixo de 0x20,
// mais DEL), e a tabela adversarial de ida-e-volta em
// test/yaml-emit.test.mjs é o que a mantém fechada.
//
// Nenhum dos 85 arquivos do acervo tem controle em valor de frontmatter;
// isto é necessário para o editor da vitrine (Fase 2), que gera
// frontmatter a partir de formulário e de texto colado — e lá NÃO há
// parser para reclamar, então o que não for escapado aqui corrompe em
// silêncio.
const ehControle = (c) => {
  const n = c.codePointAt(0);
  return n < 0x20 || n === 0x7f;
};
const temControle = (s) => [...s].some(ehControle);

// Escapes nomeados que o YAML de aspas duplas define. O resto da classe
// sai como `\xNN`, a forma hexadecimal que a mesma gramática aceita —
// conferida com `yaml.load` na tabela adversarial, não suposta.
const ESCAPE_NOMEADO = { '\n': '\\n', '\r': '\\r', '\t': '\\t' };

// Escapa para dentro de aspas duplas numa passada SÓ, caractere a
// caractere. Antes eram `.replace` encadeados, e a ordem entre eles era
// uma armadilha documentada: escapar `\n` (newline real → sequência
// "\n") ANTES de escapar backslash fazia o escape de backslash
// re-processar o backslash que o passo anterior acabou de inserir,
// dobrando-o — `"a\nb"` religava como backslash + "n" literal. Uma
// passada só elimina a armadilha por CONSTRUÇÃO, em vez de depender de
// manter a ordem certa a cada escape novo: foi justamente um escape novo
// (`\r`) entrando na cadeia errada que produziu a quinta camada deste
// defeito.
function citar(s) {
  let saida = '';
  for (const c of s) {
    if (c === '\\') saida += '\\\\';
    else if (c === '"') saida += '\\"';
    else if (ehControle(c)) {
      saida += ESCAPE_NOMEADO[c] ?? `\\x${c.codePointAt(0).toString(16).padStart(2, '0')}`;
    } else saida += c;
  }
  return `"${saida}"`;
}

function escalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (temControle(s) || RESERVADAS.test(s) || NUMERICA.test(s)
    || NUMERICA_NAO_DECIMAL.test(s) || DATA.test(s)
    || PERIGOSO.test(s) || SIMBOLO_AUTORAL.test(s)) {
    return citar(s);
  }
  return s;
}

function escalarEmFluxo(v) {
  if (typeof v === 'string' && v.includes('.') && !temControle(v) && !RESERVADAS.test(v)
    && !NUMERICA.test(v) && !NUMERICA_NAO_DECIMAL.test(v) && !DATA.test(v)
    && !PERIGOSO.test(v) && !SIMBOLO_AUTORAL.test(v)) {
    return citar(v);
  }
  return escalar(v);
}

// Chave de mapa tem perigo que valor não tem, e perigo que valor também
// tem (caractere de controle) — por isso é variante de escalar(), não a
// mesma função.
//
// NÃO reaplica RESERVADAS/NUMERICA/DATA: uma chave YAML `true` ou `42`
// sem aspas resolve para o escalar booleano/numérico correspondente,
// mas ao entrar num objeto JS a propriedade é coagida de volta para a
// MESMA string ("true", "42") — não há perda, então citar por isso seria
// aspas cosméticas, não corretivas. O que É corretivo, medido ao vivo
// pela revisão: "a #b" (espaço+hash no meio é comentário — o par some
// inteiro, silencioso), "key " (espaço final — perdido na releitura,
// silencioso), "a: b" e "a:" (dois-pontos abrindo mapa — chave YAML
// inválida, estoura no reparse), "" (chave vazia — YAML inválido), e
// caractere de controle (mesma razão do valor).
//
// LIMITE CONHECIDO, nomeado e deliberadamente NÃO corrigido nesta onda:
// o argumento da coerção acima vale para a grafia CANÔNICA (`true`,
// `42`, `-42`, `0`) e NÃO vale para grafia não canônica do mesmo valor.
// Medido com `yaml.load`, como CHAVE: `~` volta "null", `Null` volta
// "null", `True` volta "true", `0x1f` volta "31", `0o17` volta "15",
// `.inf` volta "Infinity", `.nan` volta "NaN", `1e3` volta "1000", `+42`
// volta "42" e `00` volta "0" — a chave muda de grafia na releitura, em
// silêncio. Fechar isso é uma POLÍTICA de citação de chave (quais
// grafias citar, e se citar `true`/`42` junto por simetria), não um
// caractere a escapar; nenhuma chave do acervo nem do schema tem essa
// forma. Declarado em SCHEMA.md como limite do emissor.
function chaveEmYaml(chave) {
  const s = String(chave);
  if (temControle(s) || PERIGOSO.test(s)) {
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
