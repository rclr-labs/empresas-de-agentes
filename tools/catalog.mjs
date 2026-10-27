#!/usr/bin/env node
// Camada impura, como schema.mjs: toca disco (acervo e .git) e gera o
// catalog.json que a Fase 2 (vitrine, editor, Worker) vai consumir. Reusa
// loadPackage/listPackages (leitura) e validatePackage/validateAcervo
// (regra, pura, de tools/rules.mjs) — este arquivo não reimplementa
// nenhuma das duas coisas, só decide a FORMA de saída e a política de
// quando falhar a geração.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPackage, listPackages } from './schema.mjs';
import { validatePackage, validateAcervo } from './rules.mjs';

// --- generated_from: sha curto do acervo -----------------------------
//
// Decisão: ler `.git/HEAD` e o ref direto do disco, em vez de invocar o
// binário `git`. `catalog.mjs` é CLI (pode usar node:*, diferente de
// rules.mjs), então chamar `git` seria legítimo — mas seria dependência
// de AMBIENTE (o binário precisa estar instalado e no PATH de quem rodar
// isto, incluindo CI e a Fase 2 gerando o catálogo num Worker/container
// que pode não ter `git`). Ler `.git/HEAD` é só `node:fs`, sem essa
// dependência. `--ref <sha>` continua disponível para o caso em que nem
// isso dá certo — um checkout raso sem `.git`, ou um chamador que já
// conhece o sha e quer evitar a leitura de disco. A Fase 2 vai querer
// saber de qual commit do acervo a vitrine foi gerada (rastreabilidade
// entre o que o editor mostra e o que está publicado); omitir o campo
// por completo jogaria essa pergunta para depois, sem necessidade.
function encontrarGitDir(partindoDe) {
  let atual = resolve(partindoDe);
  for (;;) {
    const candidato = join(atual, '.git');
    if (existsSync(candidato)) return candidato;
    const pai = dirname(atual);
    if (pai === atual) return null;
    atual = pai;
  }
}

function shaCurto(sha) {
  return typeof sha === 'string' && sha.length > 0 ? sha.trim().slice(0, 7) : null;
}

export function gitShortSha(partindoDe) {
  const gitDir = encontrarGitDir(partindoDe);
  if (!gitDir) return null;
  let head;
  try {
    head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
  } catch {
    return null;
  }
  if (!head.startsWith('ref: ')) return shaCurto(head); // HEAD destacado: já é o sha
  const ref = head.slice('ref: '.length).trim();
  try {
    return shaCurto(readFileSync(join(gitDir, ref), 'utf8'));
  } catch {
    // Ref empacotado (depois de `git gc`): não vive em arquivo solto,
    // vive numa linha de `packed-refs`.
    try {
      const packed = readFileSync(join(gitDir, 'packed-refs'), 'utf8');
      const linha = packed.split('\n').find((l) => l.endsWith(` ${ref}`));
      return linha ? shaCurto(linha.split(' ')[0]) : null;
    } catch {
      return null;
    }
  }
}

// --- forma do papel no catálogo ---------------------------------------
//
// `persona` entra por INTEIRO — `background` e `strengths` inclusos (ver
// o comentário em `construirPapel`, abaixo, para o ruling e a razão).
// Todo o RESTO de `metadata` (boundary, capabilities, memory, context, e
// qualquer campo que um AGENTS.md futuro venha a declarar) é copiado por
// INTEIRO para o nível raiz do papel no catálogo — de propósito, por
// cópia dinâmica das chaves que o próprio arquivo declara, não por uma
// lista fixa de campos conhecidos hoje. Enumerar ("boundary vai,
// capabilities vai, mais nada") foi exatamente a classe de furo que esta
// fase caçou o dia inteiro em rules.mjs (E15/E16/E17: lista fixa que fica
// cega para o caso novo); o mesmo risco existe aqui — um `metadata.tools`
// que apareça num AGENTS.md futuro ficaria invisível no catálogo se esta
// função só soubesse os nomes de hoje.
//
// `name` e `title` entram apesar de o esboço do brief não os listar: são
// o nome e o título do PAPEL (distintos de `persona.display_name`, que é
// a máscara humana) e o editor da Fase 2 precisa deles para reescrever o
// frontmatter de `AGENTS.md` — sem eles, o editor teria de inventar esses
// dois campos ao salvar, corrompendo um pacote de terceiro que os
// declarou diferente do slug. Mesma razão para `memory`/`context`: existem
// nos 42 papéis de hoje (conferido por grep antes de escrever isto) e,
// assim como boundary/capabilities, afetam o comportamento do agente.
// Caminho endereçável a partir da raiz do acervo. Usa o nome REAL do
// diretório (`basename(pkg.dir)`), não `pkg.slug`: os dois coincidem nos
// 8 pacotes de hoje, mas `pkg.slug` vem de `company.frontmatter.slug`
// (com fallback para o nome do diretório só quando ausente) — um pacote
// de terceiro que declare um slug diferente do nome da pasta geraria um
// `path` que não endereça nada em disco, exatamente o tipo de divergência
// silenciosa que esta fase existe para fechar, não para introduzir.
function caminhoDoItem(pkg, item) {
  return join(basename(pkg.dir), item.path);
}

function construirPapel(pkg, agente) {
  const fm = agente.frontmatter ?? {};
  const meta = fm.metadata ?? {};
  // `persona` entra por INTEIRO, `background`/`strengths` incluídos.
  //
  // Ruling do coordenador, fix round 1 — revertendo a decisão anterior
  // DELE MESMO, contra ele: a razão original para excluir os dois era
  // "custam token em toda chamada e não mudam comportamento". Essa razão
  // é verdadeira sobre o ARTEFATO EMITIDO (o que o runtime lê a cada
  // invocação) e falsa sobre `catalog.json`, que é dado para a vitrine e
  // nunca entra em prompt — confundir os dois consumidores foi o erro.
  // Medido: os dois campos somam 24 KB nos 42 papéis (10,3% do catálogo
  // de 234 KB) contra os 1.513 chars médios de `body` POR PAPEL — que já
  // entra e é 2,5× maior. Excluir por tamanho enquanto se inclui o maior
  // de todos não se sustentava. E sem eles, o editor da Fase 2 não podia
  // reconstruir o papel inteiro: salvar uma edição apagaria a persona
  // completa (incluindo a CICATRIZ do `background`, a linha que faz o
  // papel ser confiável) e reclassificaria o pacote de 0 aviso para W03
  // em todo papel editado — consequência que a Task 7 original nomeou
  // sem resolver, porque era decisão de produto, não de ferramental.
  const persona = { ...(meta.persona ?? {}) };

  const papel = {
    slug: agente.slug,
    name: fm.name,
    title: fm.title,
    reportsTo: fm.reportsTo ?? null,
    skills: fm.skills ?? [],
    persona,
    body: agente.body ?? '',
    path: caminhoDoItem(pkg, agente),
  };
  for (const [chave, valor] of Object.entries(meta)) {
    if (chave === 'persona') continue;
    papel[chave] = valor;
  }
  return papel;
}

function construirSkill(pkg, skill) {
  return {
    slug: skill.slug,
    description: skill.frontmatter?.description,
  };
}

// `teams`/`tasks`/`projects` (e `projects[].tasks`, aninhado) não têm
// forma declarada no brief — mas `loadPackage` os carrega como coleção de
// primeira classe, e três dos oito pacotes do acervo real têm conteúdo
// neles (`fabrica-de-testes` e `software-house` têm `teams` e `projects`;
// seis dos oito têm `tasks`). Omiti-los do catálogo seria o MESMO furo que
// o commit `76fef37` já documentou uma vez — "projects/ era invisível ao
// ferramental inteiro" — só que agora na camada do CATÁLOGO, não do
// carregador: o papel que `loadPackage` não vê fica invisível ao
// validador; a coleção que `construirPacote` não pede fica invisível à
// vitrine, mesmo depois de `loadPackage` tê-la carregado certinho.
//
// Sem shape própria declarada por ninguém, a decisão aqui é copiar o
// frontmatter por INTEIRO (mesmo princípio de `construirPapel`: copiar as
// chaves que o arquivo de fato declara, não uma lista fixa inventada
// agora) mais corpo e caminho — nunca zero.
function construirGenerico(pkg, item) {
  return {
    ...(item.frontmatter ?? {}),
    slug: item.slug,
    body: item.body ?? '',
    path: caminhoDoItem(pkg, item),
  };
}

function construirPacote(pkg) {
  const fm = pkg.company.frontmatter ?? {};
  return {
    slug: pkg.slug,
    name: fm.name,
    description: fm.description,
    license: fm.license,
    agents: pkg.agents.map((a) => construirPapel(pkg, a)),
    human_gates: fm.metadata?.human_gates ?? [],
    skills: pkg.skills.map((s) => construirSkill(pkg, s)),
    teams: (pkg.teams ?? []).map((t) => construirGenerico(pkg, t)),
    tasks: (pkg.tasks ?? []).map((t) => construirGenerico(pkg, t)),
    projects: (pkg.projects ?? []).map((proj) => ({
      ...construirGenerico(pkg, proj),
      tasks: (proj.tasks ?? []).map((t) => construirGenerico(pkg, t)),
    })),
  };
}

// --- carga + decisão sobre erro × aviso --------------------------------
//
// `raiz` pode ser a raiz do ACERVO (contém vários pacotes, cada um numa
// subpasta com COMPANY.md) ou um PACOTE ÚNICO (COMPANY.md diretamente
// dentro de `raiz`) — o mesmo contrato de `loadPackage`/`listPackages`
// já distingue os dois casos pela presença de COMPANY.md, então
// `buildCatalog` só precisa perguntar a mesma coisa que `listPackages`
// pergunta. Isso permite `buildCatalog(<um pacote>)` para quem só quer
// pré-visualizar um pacote em edição (o caso da Fase 2: o editor valida o
// pacote que está sendo editado, não o acervo inteiro) sem precisar de
// uma função separada.
function carregarPacotes(raiz) {
  const pacoteUnico = existsSync(join(raiz, 'COMPANY.md'));
  return {
    pacoteUnico,
    pkgs: pacoteUnico
      ? [loadPackage(raiz)]
      : listPackages(raiz).map((nome) => loadPackage(join(raiz, nome))),
  };
}

function formatarErros(erros) {
  return erros.map((e) => `${e.code} ${e.where}: ${e.message}`).join(' | ');
}

/**
 * Gera o catálogo. Puro quanto à DECISÃO de forma (o que entra e o que
 * não entra), impuro na leitura (usa schema.mjs, que toca disco).
 *
 * A geração FALHA (lança) se `validatePackage` acusar erro em qualquer
 * pacote, ou se `validateAcervo` acusar colisão de identidade — catálogo
 * gerado de acervo inválido é vitrine mentindo com confiança.
 *
 * AVISO (W01-W05) NÃO falha a geração — decisão declarada, não omissão:
 * todo aviso hoje documentado em rules.mjs (`validateWarnings`) é sobre
 * persona incompleta ou allowlist sem ressalva de prosa — "o papel
 * continua válido... só o card da vitrine fica pobre" (comentário de W03
 * em rules.mjs). Bloquear a geração por aviso faria o catálogo nunca
 * existir para um pacote de terceiro que não preencheu a persona por
 * completo, quando o próprio desenho do acervo (W03 existir como aviso,
 * não erro) já decidiu que isso é degradação aceitável, não motivo de
 * reprovação. Erro é "este papel pode tudo" ou "esta identidade colide";
 * aviso é "este card não tem ícone" — categorias diferentes, portões
 * diferentes.
 */
export function buildCatalog(raiz, opts = {}) {
  const { pacoteUnico, pkgs } = carregarPacotes(raiz);

  for (const pkg of pkgs) {
    const { errors } = validatePackage(pkg);
    const todosErros = [...(pkg.problems ?? []), ...errors];
    if (todosErros.length > 0) {
      throw new Error(
        `erro de validação em "${pkg.slug}" — catálogo não gerado de acervo inválido: ${formatarErros(todosErros)}`);
    }
  }

  // A01 (unicidade de identidade) só se aplica ao modo acervo-inteiro —
  // o mesmo motivo documentado em validateAcervo/tools/validate.mjs: um
  // pacote único não tem o resto do acervo para colidir contra, e chamar
  // validateAcervo sobre lista de um só daria um veredito de unicidade
  // que ninguém pediu.
  if (!pacoteUnico) {
    const { errors: acervoErros } = validateAcervo(pkgs);
    if (acervoErros.length > 0) {
      throw new Error(
        `erro de validação de acervo — identidade de persona colide, catálogo não gerado: ${formatarErros(acervoErros)}`);
    }
  }

  return {
    schema: 'catalog/v1',
    generated_from: opts.ref ?? gitShortSha(raiz) ?? null,
    packages: pkgs.map(construirPacote),
  };
}

// --- CLI ----------------------------------------------------------------
const estaRodandoComoCLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (estaRodandoComoCLI) {
  const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const argv = process.argv.slice(2);

  function argumentoDe(flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  }

  // Posicional: tudo que não é `--flag` nem o VALOR de um `--flag` que
  // toma argumento (`--out`, `--ref`).
  const valoresDeFlag = new Set(['--out', '--ref'].map(argumentoDe).filter(Boolean));
  const alvo = argv.find((a) => !a.startsWith('--') && !valoresDeFlag.has(a));
  const out = argumentoDe('--out');
  const ref = argumentoDe('--ref');

  try {
    const catalogo = buildCatalog(alvo ? resolve(alvo) : RAIZ, { ref });
    const texto = JSON.stringify(catalogo, null, 2);
    if (out) {
      writeFileSync(resolve(out), texto, 'utf8');
      const totalAgentes = catalogo.packages.reduce((n, p) => n + p.agents.length, 0);
      console.error(`catálogo escrito em ${resolve(out)}: ${catalogo.packages.length} pacotes, ${totalAgentes} agentes, generated_from=${catalogo.generated_from ?? '(desconhecido)'}`);
    } else {
      console.log(texto);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
