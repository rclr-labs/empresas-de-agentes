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
// `metadata` entra ANINHADO, na mesma forma que tem no arquivo — ruling
// do coordenador, fix round 3, revertendo a decisão de ACHATAR
// (`boundary`/`capabilities`/`memory`/`context`/`persona` no topo do
// papel) que esta própria tarefa tinha tomado nos rounds 1 e 2.
//
// A razão do round 3: achatar não dava nada de real à vitrine — um hop
// de propriedade a menos (`a.boundary` em vez de `a.metadata.boundary`),
// ergonomia, não correção — e CRIAVA as duas convenções que a prova de
// suficiência da revisão expôs: (1) a ordem de chave de topo do
// frontmatter deixava de vir do dado e passava a depender da uniformidade
// incidental dos 42 arquivos de hoje, e (2) reconstruir o AGENTS.md
// exigia saber, de memória, QUAIS campos achatados voltam para dentro de
// `metadata` — uma lista que não existia em lugar nenhum do catalog.json.
// Com `metadata` aninhado como no disco, as duas desaparecem por
// construção: a ordem INTERNA de `metadata` já é a ordem com que
// `js-yaml` leu o arquivo (preservada por cópia direta, sem reordenar
// nada) e sobrevive a `JSON.stringify`/`JSON.parse` (que preservam ordem
// de inserção); e não há mais "campo achatado" para re-classificar —
// `metadata` é um bloco só, exatamente como no arquivo.
//
// `persona` mora DENTRO de `metadata`, como no disco — não é mais campo
// de topo do papel. `background`/`strengths` continuam dentro dela,
// decisão do fix round 1 (ver CHANGELOG no relatório): a razão de
// incluí-los nunca foi sobre posição no objeto, foi sobre eles entrarem
// ou não — e entram, íntegros, onde a persona de fato mora.
//
// `name`, `title`, `reportsTo`, `skills` continuam de fora de `metadata`
// porque são de fato de FORA de `metadata` no arquivo — são os únicos
// campos de topo do frontmatter real, ao lado do próprio `metadata`.
// Ficam no catálogo pela mesma razão do round 1: o editor da Fase 2
// precisa deles para reescrever o frontmatter sem inventar nada.
//
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
  return {
    slug: agente.slug,
    name: fm.name,
    title: fm.title,
    reportsTo: fm.reportsTo ?? null,
    skills: fm.skills ?? [],
    metadata: fm.metadata ?? {},
    body: agente.body ?? '',
    path: caminhoDoItem(pkg, agente),
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

/**
 * As chaves que o CATÁLOGO acrescenta a uma cópia de frontmatter, por
 * classe de entrada. Exportadas porque são o INVERSO declarado de
 * `construirPacote`/`construirPapel`: quem quiser o frontmatter de volta
 * (o editor da Fase 2, a prova de reconstrução) remove estas e fica com o
 * que o arquivo declarava — sem precisar saber, de memória, quais campos
 * são do arquivo e quais são do catálogo.
 *
 * É a diferença entre uma lista fixa de campos do ARTEFATO (que foi o
 * defeito: `construirPacote` enumerava `name`/`description`/`license` e
 * perdia `goals`, `metadata`, `authors`, `kind`, `requirements`,
 * `schema`, `tags`, `version` e o corpo inteiro) e uma lista fixa de
 * campos do FORMATO, que é finita por construção e guardada por teste:
 * chave nova no catálogo sem entrar aqui deixa a prova de reconstrução
 * vermelha.
 *
 * `slug` NÃO é derivada para estas duas classes: os 8 `COMPANY.md` e os
 * 42 `AGENTS.md` declaram `slug` no frontmatter, e o catálogo só reescreve
 * o valor pelo canônico (`pkg.slug`/`item.slug`, que caem para o nome do
 * diretório quando o arquivo omite) na mesma posição.
 */
export const CHAVES_DERIVADAS = Object.freeze({
  pacote: Object.freeze(['body', 'path', 'agents', 'skills', 'teams', 'tasks', 'projects']),
  agente: Object.freeze(['body', 'path']),
});

// O pacote copia o frontmatter da empresa ESPALHANDO o que o arquivo
// declara — mesmo princípio de `construirGenerico` e de `construirPapel`
// com `metadata` — mais corpo e caminho. Enumerar aqui foi um Critical
// medido em 2026-10-27: contra a união das chaves dos 8 `COMPANY.md`, o
// catálogo descartava de TODO pacote `goals`, `metadata` (e com ele
// `budget` e `capability_vocabulary`), `authors`, `kind`, `requirements`,
// `schema`, `tags`, `version` — e o corpo inteiro, 2,6 a 5,1 KB cada. Dos
// seis campos de pacote que o spec §6 nomeia para o editor (nome,
// descrição, metas, portões, teto, `license`), DOIS não existiam no
// catálogo: metas e teto.
//
// `human_gates` içado no topo foi REMOVIDO junto. Três razões: com o
// frontmatter inteiro espalhado, `metadata.human_gates` chega íntegro e o
// içado passou a ser verdade duplicada (atualizar a cópia esquecida
// recria o defeito); o `?? []` do içado FABRICAVA lista vazia para um
// pacote que não declara portão nenhum, o que é afirmar algo que o
// arquivo não diz; e nenhum consumidor existia (`grep` em `test/`,
// `tools/` e `bindings/`: zero). Os "portões" do spec §6 seguem
// atendidos, em `metadata.human_gates` — o lugar onde o arquivo os
// escreve.
function construirPacote(pkg) {
  return {
    ...(pkg.company.frontmatter ?? {}),
    slug: pkg.slug,
    body: pkg.company.body ?? '',
    path: caminhoDoItem(pkg, pkg.company),
    agents: pkg.agents.map((a) => construirPapel(pkg, a)),
    // `skills` deixou de ser `{slug, description}` enumerado à mão
    // (minor da mesma família, ledger:194) e passou a `construirGenerico`:
    // o frontmatter que o arquivo declara — `name`, `description`,
    // `allowed-tools`, `metadata` — mais corpo e caminho. Isso faz o
    // catálogo crescer (corpo de SKILL.md é da ordem de KB), e é o
    // preço de a vitrine não precisar voltar ao disco para mostrar uma
    // skill.
    skills: (pkg.skills ?? []).map((s) => construirGenerico(pkg, s)),
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
