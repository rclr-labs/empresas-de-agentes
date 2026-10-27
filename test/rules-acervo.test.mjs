import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAcervo } from '../tools/rules.mjs';

function papel(slug, display_name, icon) {
  return { path: `${slug}/AGENTS.md`, slug, body: '', frontmatter: {
    metadata: { persona: { display_name, icon } } } };
}

test('A01: ícone repetido entre pacotes é erro', () => {
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Caio Moraes', '💡')] },
  ]).errors;
  assert.equal(erros.length, 1);
  assert.equal(erros[0].code, 'A01');
  assert.match(erros[0].message, /💡/);
  assert.match(erros[0].message, /um\/a/);
  assert.match(erros[0].message, /dois\/b/);
});

test('A01: sobrenome repetido entre pacotes é erro', () => {
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Caio Vieira', '⚙️')] },
  ]).errors;
  assert.equal(erros.length, 1);
  assert.match(erros[0].message, /Vieira/);
});

test('A01: display_name repetido entre pacotes é erro', () => {
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Ana Vieira', '⚙️')] },
  ]).errors;
  // "Ana Vieira" repetido dispara display_name E sobrenome — dois A01, não
  // um só mascarando o outro.
  assert.equal(erros.length, 2);
  assert.ok(erros.every((e) => e.code === 'A01'));
});

test('A01: acervo sem colisão passa', () => {
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Caio Moraes', '⚙️')] },
  ]).errors, []);
});

// Furo 3 — a cicatriz de 2026-10-24: dois papéis sem ícone colidiam porque
// undefined === undefined, e o teste acusava REPETIÇÃO onde havia
// AUSÊNCIA. Ausência é W03 (regra por pacote), nunca A01.
test('A01: persona ausente não gera colisão de undefined', () => {
  const sem = { path: 'c/AGENTS.md', slug: 'c', body: '', frontmatter: { metadata: {} } };
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [sem] }, { slug: 'dois', agents: [sem] },
  ]).errors, []);
});

// Furo 3, variante: persona existe mas o CAMPO individual (ícone) está
// ausente — mesmo risco de undefined === undefined, por um caminho
// diferente do teste acima (ali a persona inteira falta; aqui só o campo).
test('A01: ícone ausente (persona presente, campo faltando) não colide', () => {
  const semIcone = (slug, nome) => papel(slug, nome, undefined);
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [semIcone('a', 'Ana Vieira')] },
    { slug: 'dois', agents: [semIcone('b', 'Caio Moraes')] },
  ]).errors, []);
});

// Furo 4 — colisão DENTRO do mesmo pacote também tem de ser pega; a
// unicidade é do acervo inteiro, não "entre pacotes distintos" como a
// primeira leitura do nome sugeriria.
test('A01: ícone repetido no MESMO pacote é erro', () => {
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡'), papel('b', 'Caio Moraes', '💡')] },
  ]).errors;
  assert.equal(erros.length, 1);
  assert.match(erros[0].message, /um\/a/);
  assert.match(erros[0].message, /um\/b/);
});

// Furo 1 — lista vazia não pode devolver "zero colisão" com cara de
// aprovação: zero pacotes não é um acervo limpo, é carregamento
// incompleto. A função recusa (lança) em vez de certificar em silêncio.
test('A01: lista vazia é recusada, não aprovada em silêncio', () => {
  assert.throws(() => validateAcervo([]), /vazia/);
});

// Furo 2 — chamada com um pacote só é aceita e verifica exatamente o que
// foi passado (aqui, nada — não há com o que colidir dentro de um agente
// só), sem fingir ter visto o resto do acervo.
test('A01: um pacote só, sem colisão interna, passa', () => {
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
  ]).errors, []);
});

// Fix round 1 (coordenador): fechar o furo 2 sem guarda — declarando o que
// foi verificado em vez de recusar ou inferir. `verificados` é a lista de
// slugs que de fato entraram na comparação, para que quem chama com um
// recorte (ex.: a vitrine validando o pacote em edição) possa dizer
// "unicidade verificada em 1 pacote" em vez de deixar essa cobertura
// parcial silenciosa atrás de um `{ errors: [] }` que parece completo.
test('A01: verificados nomeia os pacotes que de fato entraram na checagem', () => {
  const { verificados } = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Caio Moraes', '⚙️')] },
  ]);
  assert.deepEqual(verificados, ['um', 'dois']);
});

test('A01: verificados com um pacote só nomeia só esse um — não finge ver o resto', () => {
  const { verificados } = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
  ]);
  assert.deepEqual(verificados, ['um']);
});

// --- O comparador era cego a caixa, a acento e a espaço (T5 deferido,
// medido na revisão ampla de 2026-10-27).
//
// `'Ana Vieira'` vs `'ana vieira'` dava ZERO erro de A01, e o
// `/^[A-Za-z][A-Za-z ]*$/` de E18 aceita minúscula — logo nenhuma regra
// pegava a colisão. O eixo do ESPAÇO NO FIM nem havia sido medido:
// `'Ana Vieira '` não colidia com nenhuma das duas formas, e E18 também
// o permite. Identidade de persona é o que a vitrine usa para distinguir
// um papel de outro; duas identidades que só diferem em caixa ou espaço
// são a MESMA identidade para quem lê o card.
const EIXOS = {
  caixa: 'ana vieira',
  'espaço no fim': 'Ana Vieira ',
  'espaço no início': ' Ana Vieira',
  'espaço duplo': 'Ana  Vieira',
  acento: 'Ana Viéira',
  'caixa + espaço': 'ana  vieira ',
};

test('A01: os eixos de caixa, acento e espaço colidem com a grafia canônica', () => {
  for (const [eixo, grafia] of Object.entries(EIXOS)) {
    const erros = validateAcervo([
      { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
      { slug: 'dois', agents: [papel('b', grafia, '⚙️')] },
    ]).errors;
    // Dois A01: nome e sobrenome, como na colisão literal — nenhum dos
    // dois mascarando o outro.
    assert.equal(erros.length, 2,
      `eixo "${eixo}" (${JSON.stringify(grafia)}) deu ${erros.length} A01, esperado 2`);
    assert.ok(erros.every((e) => e.code === 'A01'));
    // A mensagem tem de mostrar a grafia do OUTRO papel — sem isso,
    // "nome repetido" numa colisão que só a normalização vê é
    // inacionável: as duas linhas parecem diferentes no arquivo.
    assert.match(erros[0].message, /lá escrito/);
  }
});

test('A01: sobrenome colide mesmo com espaço no fim do nome — era o eixo que escapava inteiro', () => {
  // `'Ana Vieira '.split(' ').at(-1)` é `''`, descartado como ausência:
  // antes da correção, este par passava limpo no eixo do sobrenome.
  const erros = validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira ', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Caio Vieira', '⚙️')] },
  ]).errors;
  assert.equal(erros.length, 1);
  assert.match(erros[0].message, /sobrenome/);
});

test('A01: ícone segue comparado VERBATIM — emoji não dobra caixa nem decompõe acento', () => {
  // Dois ícones distintos que só uma normalização aplicada a emoji
  // poderia confundir. Normalizar ícone não tem sentido, e
  // `.toLowerCase()` não é identidade em toda sequência Unicode.
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '🅰️')] },
    { slug: 'dois', agents: [papel('b', 'Caio Moraes', '🇦')] },
  ]).errors, []);
});

test('A01: nomes de fato diferentes seguem sem colisão com a normalização ligada', () => {
  // Contraponto positivo: a normalização não pode transformar o
  // comparador num acusador de tudo.
  assert.deepEqual(validateAcervo([
    { slug: 'um', agents: [papel('a', 'Ana Vieira', '💡')] },
    { slug: 'dois', agents: [papel('b', 'Ana Moraes', '⚙️')] },
    { slug: 'tres', agents: [papel('c', 'Caio Vieiralves', '🧪')] },
  ]).errors, []);
});
