// PURO POR CONTRATO: nenhum import de node:*, nenhum acesso a process.
// Esta é a condição para o Studio importar este módulo no browser.
// Uma implementação de regra, dois consumidores (CLI e Studio).
import { ALIASES, VOCABULARY } from '../capabilities/v1.mjs';

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Reescreve chaves de alias pt-BR para o canônico em inglês, recursivamente.
 * Não muta a entrada. Canônico vence quando as duas chaves coexistem.
 */
export function normalizeAliases(meta, path = '', warnings = []) {
  if (Array.isArray(meta)) {
    return {
      meta: meta.map((item, i) => normalizeAliases(item, `${path}[${i}]`, warnings).meta),
      warnings,
    };
  }
  if (!isPlainObject(meta)) return { meta, warnings };

  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    const canonical = ALIASES[key];
    const childPath = path ? `${path}.${key}` : key;

    if (!canonical) {
      out[key] = normalizeAliases(value, childPath, warnings).meta;
      continue;
    }

    // Duas checagens, não uma. hasOwn(meta, …) pega alias contra canônico;
    // hasOwn(out, …) pega alias contra alias — ALIASES tem dois pares que
    // apontam para a mesma chave (destinatario_do_alerta e alerta_para →
    // alert_to), e sem a segunda checagem o segundo sobrescrevia o primeiro
    // em silêncio, com dois W01 de aparência inofensiva.
    if (Object.hasOwn(meta, canonical) || Object.hasOwn(out, canonical)) {
      warnings.push({
        code: 'W02',
        path: childPath,
        message: `"${key}" colide em "${canonical}", que já foi preenchido; o primeiro valor foi mantido e este alias descartado`,
      });
      continue;
    }

    warnings.push({
      code: 'W01',
      path: childPath,
      message: `alias pt-BR "${key}" em uso; o canônico é "${canonical}". Use --fix para reescrever`,
    });
    out[canonical] = normalizeAliases(value, childPath, warnings).meta;
  }
  return { meta: out, warnings };
}

function erro(code, rule, where, message) {
  return { code, rule, where, message };
}

/**
 * Lista de string, ou vazio. Existe porque o acervo é público e aceita
 * pacote de terceiro: campo com tipo errado tem de REPROVAR o pacote (E19),
 * nunca derrubar o validador — e menos ainda derrubar o navegador, onde a
 * vitrine roda esta mesma função sobre o que o editor digitou. Item que não
 * é string é descartado em silêncio aqui: quem relata o tipo errado é E19,
 * não este helper — este só garante que as outras regras sempre recebem
 * algo seguro para `.includes`/`.some`/`.find`/`.filter`.
 */
function listaDeTexto(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

// Descreve o tipo recebido numa forma legível para a mensagem de E19.
// Caso especial para array: "veio lista" já diz que a lista existe, mas
// tem item do tipo errado dentro — distinto de "veio number" (o campo
// inteiro é do tipo errado).
function tipoRecebido(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'lista com item que não é texto';
  return typeof v;
}

const isListaDeTextoValida = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * E19 — tipo de campo validado ANTES de qualquer regra usar o valor.
 * Medido em 2026-10-27: pacote de terceiro com `execute.allow` número,
 * string ou lista com item não-string derrubava o validador inteiro com
 * TypeError (`padrao.match`, `allow.find`, "not iterable") em vez de
 * reprovar o pacote — e, no caso de `write` como string, nem derrubava:
 * produzia uma dúzia de E02 espúrios, um por caractere, porque `for...of`
 * itera string. A vitrine roda esta mesma função no navegador sobre o que
 * o editor está digitando; tipo errado é o caso ESPERADO ali, não exceção,
 * e falhar aberto significa tela branca com stack em vez de mensagem.
 * Um E19 por CAMINHO de campo, nunca um por item — "`execute.allow` tem
 * item que não é texto" é um defeito, não N.
 */
function verificarTiposDeCapacidade(cap, where, erros) {
  for (const campo of ['read', 'write', 'delegate', 'approve']) {
    const v = cap[campo];
    if (v === undefined) continue;
    if (!isListaDeTextoValida(v)) {
      erros.push(erro('E19', 'tipo-de-campo-invalido', where,
        `capabilities.${campo} deveria ser uma lista de texto; veio ${tipoRecebido(v)}. Corrija para uma lista de strings, ex.: ["repository"]`));
    }
  }

  // `network` tem TRÊS formas válidas, não duas: `false` (sem rede),
  // `true` (rede sem allowlist de domínio — ver `temRede` abaixo, que já
  // resolve essa forma) e lista de texto (allowlist de domínio). Medido no
  // acervo real: `operacao-de-conhecimento/agents/pesquisa` usa
  // `network: true` com `curl -s*` em execute.allow, e passa E15 hoje
  // porque `temRede` já conta `true` como alcance declarado. Outlawar essa
  // forma aqui reprovaria um papel real que nunca foi malformado.
  const net = cap.network;
  if (net !== undefined && net !== false && net !== true && !isListaDeTextoValida(net)) {
    erros.push(erro('E19', 'tipo-de-campo-invalido', where,
      `capabilities.network deveria ser "true", "false" ou uma lista de texto; veio ${tipoRecebido(net)}. Declare os domínios como lista de strings, ou "true"/"false" quando não há allowlist específica`));
  }

  if (cap.budget !== undefined && cap.budget !== null && !isPlainObject(cap.budget)) {
    erros.push(erro('E19', 'tipo-de-campo-invalido', where,
      `capabilities.budget deveria ser um objeto; veio ${tipoRecebido(cap.budget)}. Declare budget como objeto, ex.: { limit: 100, alert_to: "slug" }`));
  }

  if (cap.execute !== undefined) {
    if (!isPlainObject(cap.execute)) {
      erros.push(erro('E19', 'tipo-de-campo-invalido', where,
        `capabilities.execute deveria ser um objeto com "allow"/"deny"; veio ${tipoRecebido(cap.execute)}. Declare execute como objeto, ex.: { allow: ["git push*"], deny: ["sudo *"] }`));
    } else {
      for (const campo of ['allow', 'deny']) {
        const v = cap.execute[campo];
        if (v === undefined) continue;
        if (!isListaDeTextoValida(v)) {
          erros.push(erro('E19', 'tipo-de-campo-invalido', where,
            `capabilities.execute.${campo} deveria ser uma lista de texto; veio ${tipoRecebido(v)}. Corrija para uma lista de strings, ex.: ["git push*"]`));
        }
      }
    }
  }
}

/**
 * Comandos que alcançam a rede, derivados do que o acervo de fato usa.
 * EXPORTADO de propósito: a vitrine valida no browser com esta mesma lista,
 * e cópia de lista é como a guarda de alcance ficou cega para `npm audit`
 * e `semgrep` até 2026-10-26. Uma lista, dois consumidores.
 *
 * `nmap`/`nuclei`/`ffuf` entraram em 2026-10-27, fix-round 1 da Task 1.
 * `k6`/`artillery` entraram no fix-round 2, pela mesma classe de lacuna.
 *
 * O critério de pertencimento aqui é **o alvo vem como ARGUMENTO da
 * própria invocação** — um host ou domínio que quem chama escolhe na hora,
 * forma de `curl`/`nmap`/`nuclei`/`ffuf`/`k6`/`artillery` — ou é consulta
 * que só existe contra registry ao vivo, fora do controle do chamador
 * (`npm audit`). Ferramenta cujo alvo é configurado por ARQUIVO ou
 * CREDENCIAL (`.npmrc`, `pip.conf`, `~/.docker/config.json`, remote do
 * git, kubeconfig) não entra aqui — ver `COMANDOS_LOCAIS` e a
 * classificação completa no relatório da Task 1.
 */
export const COMANDOS_DE_REDE = Object.freeze([
  /^curl\s/i, /^wget\s/i, /^http\s/i, /^nmap\s/i, /^nuclei\s/i, /^ffuf\s/i,
  /^k6\b/i, /^artillery\b/i,
  /^npm audit\b/i, /^semgrep(?!\s+--config=\.\/)/i,
]);

/**
 * Comandos deliberadamente FORA de `COMANDOS_DE_REDE` — o lado "local" da
 * mesma classificação. Existe para que `test/acervo.test.mjs` possa exigir,
 * por derivação, que todo comando que já aparece em algum `execute.allow`
 * do acervo esteja classificado num dos dois lados, nunca ausente dos
 * dois: ausente dos dois é exatamente como a lacuna de nmap/nuclei/ffuf
 * (fix-round 1) e, antes dela, de k6/artillery embrulhados em `npx`
 * (fix-round 2) ficaram invisíveis — de novo, enumerar sem derivar.
 * Comando novo que não bater aqui nem em COMANDOS_DE_REDE falha o teste de
 * derivação, nomeado, pedindo classificação explícita.
 *
 * O critério de pertencimento aqui é o espelho do de `COMANDOS_DE_REDE`:
 * **o alvo é configurado por ARQUIVO ou CREDENCIAL**, nunca passado como
 * domínio na própria invocação. `git`/`gh` ficam aqui mesmo `git push`/
 * `gh pr create` alcançando rede: o alvo é o remote/API do GitHub já
 * configurado (`.git/config`, token do `gh`), não um domínio que
 * `capabilities.network` declara — essa contradição específica (push/PR
 * sem `write` incluir `pull_request`) é o ângulo da E16 (próxima tarefa),
 * não de E15. `kubectl`/`helm`/`terraform` ficam aqui pela mesma razão:
 * falam com cluster/provider via kubeconfig/credencial de provider
 * pré-configurada, nunca um host passado na linha de comando. `mysql`/
 * `psql` ficam aqui porque o alvo é conexão de banco já configurada,
 * governada por `capabilities.read/write` de `database`, não por
 * `network`. `npm`/`pip`/`yarn`/`pnpm`/`composer`/`mvn`/`gradle`/`dotnet`/
 * `docker` ficam aqui porque o registry/repositório que alcançam é
 * configurado em arquivo (`.npmrc`, `pip.conf`, `~/.m2/settings.xml`,
 * `~/.docker/config.json`), nunca argumento da chamada — mesmo raciocínio
 * do precedente já existente de `npm audit`/`npm` bare.
 *
 * Os nomes abaixo que seguem um RUNNER (`npx cypress`, `npx playwright`,
 * `npx axe`, `npx @stoplight/spectral-cli`) são o comando REAL depois que
 * `descascarRunner` remove o prefixo — nunca o runner em si. `npx`/
 * `pnpm dlx`/`yarn dlx`/`bunx`/`pipx run`/`uvx`/`dotnet run --` não
 * aparecem aqui como entrada própria: classificar pelo runner, e não pelo
 * que ele executa, foi exatamente a lacuna do fix-round 2 (`npx artillery`
 * saía classificado como local via `/^npx\s/i`, sem nunca testar
 * `artillery`).
 */
export const COMANDOS_LOCAIS = Object.freeze([
  /^rg\s/i, /^grep\s/i,
  /^git\s/i, /^gh\s/i,
  /^kubectl\s/i, /^helm\s/i, /^terraform\s/i, /^docker\s/i,
  /^mysql\b/i, /^psql\b/i,
  /^npm\s/i, /^pip\s/i, /^yarn\s/i, /^pnpm\s/i, /^composer\s/i,
  /^mvn\s/i, /^gradle\s/i, /^dotnet\s/i, /^python\s/i,
  /^dbt\s/i, /^great_expectations\s/i,
  /^semgrep\s+--config=\.\//i,
  // Comando real por trás de um runner (ver comentário acima) — não o
  // runner, que fica só em RUNNERS.
  /^axe\b/i, /^cypress\b/i, /^playwright\b/i, /^@stoplight\/spectral-cli\b/i,
  // `npx` bare SÓ para o caso degenerado de `descascarRunner` (`npx *`,
  // sem sub-comando nomeado): seis papéis do acervo usam esse wildcard
  // puro para "qualquer ferramenta do ecossistema npm", pelo mesmo
  // precedente que já trata `npm *` bare como local. Nunca bate quando
  // existe um comando real depois do runner — esse caso vai para o nome
  // do comando, nunca para esta entrada.
  /^npx\b/i,
]);

/**
 * Prefixos de runner conhecidos. Um runner não é um comando — é um
 * carregador de outro comando — e por isso nunca entra em
 * COMANDOS_DE_REDE/COMANDOS_LOCAIS diretamente: classificar `npx` sozinho
 * foi exatamente como `npx artillery*` saiu "local" sem o E15 nunca olhar
 * para `artillery`. `descascarRunner` usa esta lista para expor o comando
 * real, que é então classificado pelas duas listas de sempre — nunca por
 * um caminho paralelo.
 */
export const RUNNERS = Object.freeze([
  /^npx\s+/i,
  /^pnpm\s+dlx\s+/i,
  /^yarn\s+dlx\s+/i,
  /^bunx\s+/i,
  /^pipx\s+run\s+/i,
  /^uvx\s+/i,
  /^dotnet\s+run\s+--\s+/i,
]);

/**
 * Remove um prefixo de runner conhecido de `padrao`, expondo o comando
 * real que ele carrega. Sem runner reconhecido, devolve `padrao` como veio
 * — é por isso que todo chamador pode testar `descascarRunner(padrao)`
 * direto contra COMANDOS_DE_REDE/COMANDOS_LOCAIS sem ramificar em "tem
 * runner ou não".
 *
 * Caso degenerado: `npx *` (visto em seis papéis do acervo) não nomeia
 * sub-comando nenhum — é wildcard puro. Não há "comando real" para
 * classificar aí; a classificação cai no nome do PRÓPRIO runner (`npx`),
 * que entra em COMANDOS_LOCAIS só para este caso, documentado onde a
 * lista declara essa entrada. Isso não reabre a lacuna do fix-round 2: lá
 * o defeito era um comando de rede REAL (`artillery`) escondido atrás do
 * runner; aqui não existe comando real nenhum para esconder.
 */
export function descascarRunner(padrao) {
  for (const runner of RUNNERS) {
    const m = padrao.match(runner);
    if (m) {
      const resto = padrao.slice(m[0].length);
      if (/^[\s*]*$/.test(resto)) return m[0].trim();
      return resto;
    }
  }
  return padrao;
}

/**
 * Casa `texto` contra `padrao` com a semântica de glob de shell que
 * `tools/writers.mjs` usa de fato no hook emitido (`case "$cmd" in $p)` —
 * só `*` (zero ou mais caracteres quaisquer), case-sensitive, âncora nas
 * duas pontas. `?` e `[...]` não aparecem em padrão nenhum do acervo hoje
 * (conferido antes de escrever isto); se um dia aparecerem, este helper os
 * trata como literais, não como glob — ficam fora de escopo, não incorretos
 * por omissão silenciosa.
 *
 * Existe porque E17 (achado de 2026-10-27, revisão da própria Task 3) media
 * cobertura de `deny` por CONTENÇÃO DE TOKEN — "o padrão começa com o
 * cliente e contém a palavra" — e isso aceitava
 * `"psql nunca rode DROP em producao"` como se bloqueasse alguma coisa. É a
 * mesma classe de defeito que esta fase inteira caça (presença de token
 * tratada como garantia de efeito), agora dentro da guarda que deveria
 * pegá-la. Cobertura real é: existe padrão que, como GLOB, casaria um
 * comando destrutivo de verdade — não que contém a palavra em algum lugar.
 */
export function globCasa(padrao, texto) {
  const escapado = padrao
    .split('*')
    .map((parte) => parte.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escapado}$`).test(texto);
}

// Clientes de SQL cujo `deny` precisa do trio DROP/TRUNCATE/DELETE nas duas
// grafias — ver E17 em `validateGovernance`.
const CLIENTES_SQL = Object.freeze(['psql', 'mysql', 'mariadb', 'sqlite3']);
const VERBOS_DESTRUTIVOS = Object.freeze(['DROP', 'TRUNCATE', 'DELETE']);

/**
 * Comando destrutivo representativo, derivado do próprio padrão de `allow`
 * que casou o cliente — não de uma flag fixa escolhida por esta função.
 * Fix-round 2 desta tarefa (achado do revisor, 2026-10-27): a versão
 * anterior cravava `-c` para TODO cliente, inclusive `mysql`, cuja forma
 * real e idiomática no acervo é `-e`. Isso fazia um `deny` ancorado em `-e`
 * (a forma correta para `allow: ["mysql -e*"]`) parecer incompleto, e um
 * `deny` ancorado em `-c` (que esse `allow` nunca invoca) parecer
 * cobertura — errado nas duas direções, e a segunda é exatamente a classe
 * que esta regra existe para pegar, agora escondida dentro do mecanismo
 * feito para detectá-la.
 *
 * Um mapa de flag por cliente (`psql` → `-c`, `mysql` → `-e`, ...) seria
 * enumeração — a sexta desta fase — e cega de novo no primeiro papel que
 * usar `psql --command*` ou `mariadb --execute*`. A fonte de verdade sobre
 * a forma da invocação é o próprio `allow`: ele já diz como aquele papel
 * chama o cliente. Esta função substitui o ÚLTIMO `*` do padrão pela
 * sentença destrutiva — o ponto onde o próprio papel já declarou que
 * varia:
 *   "mysql -e*"      + "DROP TABLE x" → "mysql -e DROP TABLE x"
 *   "psql --command*"+ "DROP TABLE x" → "psql --command DROP TABLE x"
 *   "psql*"          + "DROP TABLE x" → "psql DROP TABLE x"
 * Texto depois do último `*` (se houver) é preservado como sufixo literal
 * — generaliza para `*` no MEIO do padrão, não só no fim; o acervo de hoje
 * só usa `*` no fim para cliente SQL (confirmado por grep), mas a função
 * não assume isso.
 *
 * Padrão SEM NENHUM `*`: devolve `null`. Decisão declarada, não escalada —
 * um padrão totalmente literal (ex. `"psql -c 'select 1'"`) só pode
 * invocar exatamente aquela string; não há wildcard nenhum onde injetar
 * uma sentença destrutiva, e fabricar uma assumiria uma forma que o
 * `allow` não declarou. Essa entrada específica fica fora da exigência de
 * `deny` — se o mesmo cliente tiver OUTRA entrada em `allow` com `*`, essa
 * outra continua exigindo o trio normalmente.
 */
function comandoRepresentativo(padraoAllow, sentenca) {
  const i = padraoAllow.lastIndexOf('*');
  if (i === -1) return null;
  const prefixo = padraoAllow.slice(0, i);
  const sufixo = padraoAllow.slice(i + 1);
  const espaco = prefixo.length > 0 && !/\s$/.test(prefixo) ? ' ' : '';
  return `${prefixo}${espaco}${sentenca}${sufixo}`;
}

function temRede(cap) {
  return cap.network === true || (Array.isArray(cap.network) && cap.network.length > 0);
}

/**
 * Todo arquivo carregado do pacote, numa lista só. Existe para que uma
 * regra que precisa varrer "o pacote inteiro" (hoje, E09) não tenha de
 * enumerar as coleções à mão — foi exatamente assim que o E09 ficou cego
 * para projects/ depois de já ter sido corrigido uma vez por ficar cego
 * para COMPANY.md. Vive aqui, não em schema.mjs: é puro (só reformata um
 * objeto que já existe em memória, nenhum acesso a disco), e rules.mjs não
 * pode importar de schema.mjs sem herdar `node:fs` — o contrato de pureza
 * deste módulo não permite essa dependência na direção contrária.
 */
export function allFiles(pkg) {
  return [
    pkg.company,
    ...pkg.agents, ...pkg.skills, ...pkg.teams, ...pkg.tasks,
    ...(pkg.projects ?? []),
    ...(pkg.projects ?? []).flatMap((p) => p.tasks ?? []),
  ];
}

// Deriva id de portão a partir da prosa. A dobra de diacrítico (NFD +
// remoção das marcas combinantes) NÃO é cosmética: sem ela,
// "deploy em produção" vira "deploy-em-produ-o", e o autor que escrever o
// slug natural "deploy-em-producao" em capabilities.approve recebe um E04
// falso — a regra acusa portão inexistente para um portão que existe.
// Foi medido: dois dos quatro portões de software-house mangavam.
function slugificarPortao(texto) {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Retorna { gates, erros }, não só a lista: um gate sem "id" resolvível
// não pode simplesmente entrar no Set de ids como `undefined` — medido:
// isso produzia, a jusante, um E04 que acusa "portão não existe" quando o
// problema real é a declaração malformada do próprio portão. Aqui o
// defeito é nomeado (E13) e o gate malformado é descartado do Set, em vez
// de poluí-lo.
function gatesDo(pkg) {
  const raw = pkg.company.frontmatter?.metadata?.human_gates;
  const erros = [];
  if (raw == null) return { gates: [], erros };
  if (!Array.isArray(raw)) {
    erros.push(erro('E13', 'portao-malformado', 'COMPANY.md',
      `metadata.human_gates deveria ser uma lista; veio ${typeof raw}`));
    return { gates: [], erros };
  }
  const gates = [];
  raw.forEach((g, i) => {
    // Alias de formato: lista de string crua vira {id} com slug derivado.
    if (typeof g === 'string') {
      gates.push({ id: slugificarPortao(g), description: g });
      return;
    }
    if (isPlainObject(g) && typeof g.id === 'string' && g.id.length > 0) {
      gates.push(g);
      return;
    }
    erros.push(erro('E13', 'portao-malformado', 'COMPANY.md',
      `metadata.human_gates[${i}] não é string nem objeto com "id" válido: ${JSON.stringify(g)}`));
  });
  return { gates, erros };
}

function enumDe(verbo) {
  if (verbo === 'read') return VOCABULARY.read;
  if (verbo === 'write') return VOCABULARY.write;
  return null;
}

export function validateStructure(pkg) {
  const slugs = new Set(pkg.agents.map((a) => a.slug));
  const { gates, erros: gateErros } = gatesDo(pkg);
  const erros = [...gateErros];
  const gateIds = new Set(gates.map((g) => g.id));

  // E01 — license
  if (!pkg.company.frontmatter?.license) {
    erros.push(erro('E01', 'license-ausente', 'COMPANY.md',
      'pacote sem "license" declarado. Convenção nº 1 do acervo: pacote sem licença não entra'));
  }

  for (const agente of pkg.agents) {
    const where = agente.path;
    const meta = agente.frontmatter?.metadata ?? {};
    const cap = meta.capabilities ?? {};

    // E19 — tipo de campo, ANTES de qualquer regra usar o valor. Precisa
    // vir primeiro no laço: é o que garante que E02 adiante já opera sobre
    // `listaDeTexto`, nunca sobre o dado cru.
    verificarTiposDeCapacidade(cap, where, erros);

    // E02 — vocabulário fechado
    for (const verbo of ['read', 'write']) {
      const permitidos = enumDe(verbo);
      for (const valor of listaDeTexto(cap[verbo])) {
        if (!permitidos.includes(valor)) {
          erros.push(erro('E02', 'vocabulario-desconhecido', where,
            `capabilities.${verbo} contém "${valor}", fora do vocabulário. Permitidos: ${permitidos.join(', ')}`));
        }
      }
    }
    if (meta.memory?.scope && !VOCABULARY.memory_scope.includes(meta.memory.scope)) {
      erros.push(erro('E02', 'vocabulario-desconhecido', where,
        `memory.scope "${meta.memory.scope}" fora do vocabulário. Permitidos: ${VOCABULARY.memory_scope.join(', ')}`));
    }
    if (meta.memory?.retention && !VOCABULARY.memory_retention.includes(meta.memory.retention)) {
      erros.push(erro('E02', 'vocabulario-desconhecido', where,
        `memory.retention "${meta.memory.retention}" fora do vocabulário`));
    }
    for (const src of meta.context?.sources ?? []) {
      if (src.kind && !VOCABULARY.context_kind.includes(src.kind)) {
        erros.push(erro('E02', 'vocabulario-desconhecido', where,
          `context.sources[].kind "${src.kind}" fora do vocabulário`));
      }
    }

    // E03 — delegação para papel existente
    for (const alvo of listaDeTexto(cap.delegate)) {
      if (!slugs.has(alvo)) {
        erros.push(erro('E03', 'delegacao-orfa', where,
          `delega para "${alvo}", que não é papel deste pacote. Papéis: ${[...slugs].join(', ')}`));
      }
    }

    // E04 — approve referencia gate existente
    for (const gate of listaDeTexto(cap.approve)) {
      if (!gateIds.has(gate)) {
        erros.push(erro('E04', 'portao-inexistente', where,
          `aprova "${gate}", que não está em metadata.human_gates da empresa. Portões: ${[...gateIds].join(', ') || 'nenhum'}`));
      }
    }

    // E05 — reportsTo resolvível
    const chefe = agente.frontmatter?.reportsTo;
    if (chefe != null && !slugs.has(chefe)) {
      erros.push(erro('E05', 'hierarquia-rota', where,
        `reportsTo "${chefe}" não é papel deste pacote`));
    }
  }

  // E05 — ciclo de delegação. Deduplicado por conjunto de nós: sem isso,
  // um ciclo a→b→c→a era reportado três vezes, uma por nó de partida, e
  // quem lê a lista de erros vê três defeitos onde há um.
  const chefeDe = new Map(pkg.agents.map((a) => [a.slug, a.frontmatter?.reportsTo ?? null]));
  const ciclosVistos = new Set();
  for (const inicio of chefeDe.keys()) {
    const visto = [];
    let atual = inicio;
    while (atual != null && chefeDe.has(atual)) {
      if (visto.includes(atual)) {
        const ciclo = [...visto.slice(visto.indexOf(atual)), atual];
        const chave = [...new Set(ciclo)].sort().join('|');
        if (!ciclosVistos.has(chave)) {
          ciclosVistos.add(chave);
          erros.push(erro('E05', 'ciclo-de-delegacao', `agents/${inicio}/AGENTS.md`,
            `ciclo de delegação: ${ciclo.join(' → ')}`));
        }
        break;
      }
      visto.push(atual);
      atual = chefeDe.get(atual);
    }
  }

  return erros;
}

// Padrões de segredo literal. Nome de variável de ambiente é permitido —
// o que não pode é o valor.
const SEGREDOS = [
  { re: /\bsk-[A-Za-z0-9_-]{20,}/, nome: 'chave de API no formato sk-*' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}/, nome: 'token do GitHub' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, nome: 'access key da AWS' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, nome: 'chave privada' },
  { re: /\/(Users|home)\/[a-z][a-z0-9_.-]*\//i, nome: 'caminho absoluto de máquina' },
];

// Verbo de prosa → padrão de comando que o contradiz. Deliberadamente
// grosseiro: só acusa contradição óbvia, para não virar linter de estilo.
const CONTRADICOES = [
  { prosa: /\bdeploy\b/i, comandos: [/^kubectl\s+apply/i, /^helm\s+upgrade/i, /^terraform\s+apply/i, /^gcloud\s+run\s+deploy/i] },
  { prosa: /\bmerge\b/i, comandos: [/^git\s+merge/i, /^gh\s+pr\s+merge/i] },
  { prosa: /\bpush\b/i, comandos: [/^git\s+push/i] },
  { prosa: /\bescrever c[óo]digo\b/i, comandos: [/^(npm|yarn|pnpm)\s+run\s+build/i] },
];

function orcamentoDe(agente, pkg) {
  return agente.frontmatter?.metadata?.capabilities?.budget
      ?? pkg.company.frontmatter?.metadata?.budget
      ?? null;
}

function escreveOuExecuta(cap) {
  const escreve = listaDeTexto(cap.write).length > 0;
  const executa = listaDeTexto(cap.execute?.allow).length > 0;
  return escreve || executa;
}

export function validateGovernance(pkg) {
  const erros = [];
  const slugs = new Set(pkg.agents.map((a) => a.slug));

  for (const agente of pkg.agents) {
    const where = agente.path;
    const meta = agente.frontmatter?.metadata ?? {};
    const cap = meta.capabilities ?? {};

    // E06 — fronteira obrigatória
    if (!meta.boundary || (!meta.boundary.can && !meta.boundary.cannot)) {
      erros.push(erro('E06', 'fronteira-ausente', where,
        'papel sem metadata.boundary. Papel sem fronteira declarada é papel que pode tudo, e isso não é padrão aceitável'));
    }

    // E07 — quem escreve ou executa precisa de teto
    if (escreveOuExecuta(cap) && !orcamentoDe(agente, pkg)) {
      erros.push(erro('E07', 'orcamento-ausente', where,
        'papel escreve ou executa comando e não tem orçamento, próprio nem herdado da empresa. Agente sem teto é risco financeiro'));
    }

    // E08 — teto precisa de destinatário resolvível
    const orc = cap.budget;
    if (orc) {
      if (!orc.alert_to) {
        erros.push(erro('E08', 'alerta-sem-destinatario', where,
          'orçamento com teto e sem alert_to. Teto sem quem-é-avisado é teto que ninguém aplica'));
      } else if (!slugs.has(orc.alert_to)) {
        erros.push(erro('E08', 'alerta-sem-destinatario', where,
          `alert_to "${orc.alert_to}" não é papel deste pacote`));
      }
    }

    // E10 — divergência prosa × capacidade
    const naoPode = listaDeTexto(meta.boundary?.cannot).join(' | ');
    for (const { prosa, comandos } of CONTRADICOES) {
      if (!prosa.test(naoPode)) continue;
      for (const permitido of listaDeTexto(cap.execute?.allow)) {
        if (comandos.some((c) => c.test(permitido))) {
          erros.push(erro('E10', 'prosa-contradiz-capacidade', where,
            `boundary.cannot nega "${naoPode}" mas execute.allow permite "${permitido}". A prosa e a capacidade descrevem a mesma fronteira e discordam`));
        }
      }
    }

    // E11 — quem implementa não aprova
    if (listaDeTexto(cap.write).includes('code') && listaDeTexto(cap.approve).length > 0) {
      erros.push(erro('E11', 'segregacao-violada', where,
        'o mesmo papel escreve código e assina portão humano. Segregação de função: quem implementa não aprova, e quem aprova não implementa'));
    }

    // E14 — approve tem de concordar com signer.
    // `approve` significa "este papel PODE ASSINAR este portão". Se o
    // signer do portão é outra pessoa ou outro papel, a declaração é
    // falsa: o papel não assina nada.
    // Esta regra nasceu de uma guarda em TESTE que era estreita demais —
    // ela filtrava por /gasto|teto|orcamento/, escrita a partir do caso
    // encontrado e não do princípio, e por isso deixou passar um gerente
    // de teste aprovando "tocar produção", "carga acima do acordado" e
    // "divulgar achado de segurança", todos assinados por pessoa nomeada,
    // num pacote cujo próprio COMPANY.md diz "nenhum é decisão de agente".
    // Guarda escrita a partir da instância protege a instância; regra
    // escrita a partir do princípio protege a classe.
    for (const gateId of listaDeTexto(cap.approve)) {
      const portao = gatesDo(pkg).gates.find((g) => g.id === gateId);
      if (!portao) continue; // ausência é E04, não duplica aqui
      if (portao.signer !== agente.slug) {
        erros.push(erro('E14', 'approve-discorda-do-signer', where,
          `aprova "${gateId}", mas o signer desse portão é "${portao.signer}". approve significa "pode assinar": se quem assina é outra pessoa ou outro papel, este papel não aprova nada — remova o portão de approve, ou declare este papel como signer`));
      }
    }

    // E15 — alcance declarado. Capacidade que nega a rede que o comando usa
    // é fronteira que não existe: o operador lê "sem rede" e o processo sai.
    const allow = listaDeTexto(cap.execute?.allow);
    const cmdRede = allow.find((g) => COMANDOS_DE_REDE.some((re) => re.test(descascarRunner(g))));
    if (!temRede(cap)) {
      if (listaDeTexto(cap.read).includes('web')) {
        erros.push(erro('E15', 'alcance-nao-declarado', where,
          'lê "web" mas network é falso. Declare os domínios em capabilities.network, ou remova "web" de read'));
      }
      if (cmdRede) {
        erros.push(erro('E15', 'alcance-nao-declarado', where,
          `tem "${cmdRede}" em execute.allow mas network é falso — a capacidade nega a mesma rede que o comando usa. Declare o domínio, ou remova o comando`));
      }
    }

    // E16 — o par push/PR, nas DUAS direções. A direção que faltava é a que
    // deixou passar um papel com `gh pr create*` em allow e `write` sem
    // `pull_request`: a metade legível por humano concedia o que a metade
    // legível por máquina negava.
    //
    // A detecção passa por `descascarRunner` (fix round 1 desta regra,
    // 2026-10-27): sem isso, `npx gh pr create*` escaparia da checagem —
    // o padrão cru não casa `/^gh pr create/` — e, ao mesmo tempo, o teste
    // de derivação de test/acervo.test.mjs classificaria esse mesmo padrão
    // como "local" (gh já está em COMANDOS_LOCAIS depois de descascar o
    // runner), deixando as duas regras cegas para o mesmo papel ao mesmo
    // tempo. É a forma exata da lacuna de `npx artillery*` que a Task 1
    // consertou em dois rounds — aqui, aplicar o descascador já construído
    // é no-op para todo padrão de hoje (`git push*` entra e sai igual) e
    // fecha essa inconsistência antes dela existir.
    const write = listaDeTexto(cap.write);
    const temPush = allow.some((g) => /^(git push|gh pr create)/.test(descascarRunner(g)));
    if (write.includes('pull_request') && !temPush) {
      erros.push(erro('E16', 'par-pull-request', where,
        'declara write: [pull_request] e não tem "git push*" nem "gh pr create*" em execute.allow — capacidade inalcançável'));
    }
    if (temPush && !write.includes('pull_request')) {
      erros.push(erro('E16', 'par-pull-request', where,
        'tem "git push*" ou "gh pr create*" em execute.allow e write não inclui pull_request — acrescente pull_request a write, ou remova o comando'));
    }
    // Terceira perna, mesma família: quem pode dar `git push` tem de negar
    // `--force` explicitamente em execute.deny. "Pode push" sem "nega
    // force" é a mesma classe de defeito que as duas pernas acima —
    // concessão sem o limite que a torna aceitável — por isso entra em
    // E16 como a mesma regra (`par-pull-request`), não um código novo.
    //
    // Ancorada em `temPushGit` (só `/^git push/` sobre o padrão
    // descascado), não no `temPush` largo das duas pernas acima: achado da
    // revisão da Task 2 (2026-10-27) — `temPush` inclui `gh pr create*`,
    // que não aceita `--force`, então um papel com só `gh pr create*` em
    // allow e sem `git push*` seria mandado negar uma flag que o comando
    // nem tem. Inerte no acervo de hoje (os 5 papéis com `gh pr create`
    // também têm `git push*` e o deny de force), mas a regra como estava
    // era mais conservadora que o invariante que ela restaura.
    const temPushGit = allow.some((g) => /^git push/.test(descascarRunner(g)));
    if (temPushGit && !listaDeTexto(cap.execute?.deny).some((g) => /force/i.test(g))) {
      erros.push(erro('E16', 'par-pull-request', where,
        'tem "git push*" em execute.allow e execute.deny não nega "--force" — acrescente um padrão como "git push --force*" a deny'));
    }

    // E17 — deny de SQL completo. Duas lições de 2026-10-26: `mysql -e*`
    // ficou permitido com zero deny de mysql, e `psql*DROP*` não bloqueava
    // `psql -c "drop table users"` — o deny protegia a grafia que ninguém
    // usa. O deny é defesa em profundidade; a fronteira real é o portão
    // humano. Mas defesa que cobre só metade da grafia é pior que nenhuma,
    // porque parece cobertura.
    //
    // A detecção do cliente atravessa `descascarRunner`, como E15 e E16:
    // hoje nenhum papel do acervo roda SQL via runner, mas `npx prisma db
    // execute*` e análogos existem no mundo, e classificar pelo padrão cru
    // em vez do comando real foi exatamente a lacuna que a Task 1 fechou em
    // dois rounds para COMANDOS_DE_REDE/LOCAIS. Aplicar o mesmo descascador
    // aqui é no-op para todo padrão de hoje.
    //
    // `deny` usa `listaDeTexto`, não `cap.execute?.deny ?? []`: o dado cru
    // pode ter item não-string (E19 já cobre o relato; aqui só não se pode
    // quebrar `.some` sobre ele).
    //
    // A cobertura por grafia é medida por EFEITO, via `globCasa` contra um
    // `comandoRepresentativo` — não por conter o token em algum lugar do
    // padrão. Fix-round 1 desta tarefa (achado do coordenador, 2026-10-27):
    // a versão anterior checava `d.toLowerCase().startsWith(cliente) &&
    // d.includes(grafia)`, e isso aceitava
    // `"psql nunca rode DROP em producao"` como cobertura — a string
    // começa com "psql", contém "DROP", e não é glob nenhum: não casaria
    // comando algum no hook real (`case "$cmd" in $p)` de
    // `tools/writers.mjs`). Era a mesma classe de defeito que esta fase
    // inteira caça — presença de token tratada como garantia de efeito —
    // agora dentro da própria guarda que deveria pegá-la. Medir por efeito
    // também é o que deixa um `deny: ["psql*"]` sozinho (mais largo que o
    // pedido, mas cobertura real) passar limpo — a versão por token o
    // reprovaria.
    //
    // Fix-round 2 (achado do revisor, 2026-10-27): o representativo é
    // construído a partir de CADA ENTRADA de `allow` que casa o cliente
    // (depois de descascar runner), não do nome do cliente sozinho — ver
    // `comandoRepresentativo` para a razão (cravar uma flag fixa, mesmo
    // que plausível como `-c`, teria feito `mysql -e*` exigir cobertura na
    // flag errada). Um cliente com duas entradas de forma diferente em
    // `allow` (ex. `"psql -c*"` e `"psql --command*"`) tem cada entrada
    // verificada separadamente — `deny` tem de cobrir a forma que CADA
    // entrada de fato invoca, não só uma delas.
    //
    // O verbo — DROP vs drop — é comparado na caixa exata em que aparece na
    // sentença: é isso que mantém a distinção de grafia que esta regra
    // existe para forçar (ver E17 em `SCHEMA.md`).
    const deny = listaDeTexto(cap.execute?.deny);
    for (const cliente of CLIENTES_SQL) {
      const entradas = allow
        .map((g) => descascarRunner(g))
        .filter((g) => g.toLowerCase().startsWith(cliente));
      if (entradas.length === 0) continue;
      const faltando = new Set();
      for (const entrada of entradas) {
        for (const verbo of VERBOS_DESTRUTIVOS) {
          for (const grafia of [verbo, verbo.toLowerCase()]) {
            const tabela = grafia === verbo ? 'TABLE' : 'table';
            const representativo = comandoRepresentativo(entrada, `${grafia} ${tabela} x`);
            // Entrada sem nenhum `*`: não há onde injetar a sentença — ver
            // decisão declarada em `comandoRepresentativo`. Essa entrada
            // específica não gera exigência de deny.
            if (representativo === null) continue;
            const coberto = deny.some((d) => globCasa(d, representativo));
            if (!coberto) faltando.add(`${cliente}*${grafia}*`);
          }
        }
      }
      if (faltando.size) {
        erros.push(erro('E17', 'deny-de-sql-incompleto', where,
          `permite "${cliente}" em execute.allow e o deny não cobre ${[...faltando].join(', ')} — SQL não é sensível a caixa, logo o trio DROP/TRUNCATE/DELETE precisa das duas grafias, como glob que de fato casa a forma que o allow invoca`));
      }
    }
  }

  // E09 — segredo e caminho absoluto, em TODO arquivo do pacote.
  // Fora do laço de agentes de propósito: varrer só os agentes deixava
  // passar segredo em COMPANY.md, que é exatamente o arquivo onde
  // requirements.secrets vive e onde caminho de organização aparece.
  // Foi medido: um sk-ant-* no corpo do COMPANY.md e um caminho absoluto
  // num SKILL.md produziam ZERO erros.
  for (const arquivo of allFiles(pkg)) {
    const texto = `${JSON.stringify(arquivo.frontmatter ?? {})}\n${arquivo.body ?? ''}`;
    for (const { re, nome } of SEGREDOS) {
      if (re.test(texto)) {
        erros.push(erro('E09', 'segredo-literal', arquivo.path,
          `${nome} encontrado. Valor de segredo e caminho de máquina nunca são dados canônicos de pacote; declare apenas o nome da variável`));
      }
    }
  }

  return erros;
}

export function validateWarnings(pkg) {
  const avisos = [...(pkg.warnings ?? [])];
  for (const agente of pkg.agents) {
    const meta = agente.frontmatter?.metadata ?? {};
    if (!meta.persona?.display_name) {
      avisos.push({ code: 'W03', path: agente.path,
        message: 'papel sem metadata.persona.display_name; o Studio vai mostrar o slug' });
    }
    if (!(agente.frontmatter?.skills ?? []).length) {
      avisos.push({ code: 'W04', path: agente.path,
        message: 'papel sem skills declaradas' });
    }

    // W05 — a ressalva de escopo. Aviso, não erro: o que falta é PROSA, e
    // regra não julga prosa. Medido em 2026-10-25: a mesma allowlist é
    // fronteira de SO no Claude Code e decoração no OpenCode V2 e no janus
    // com provider kind=cli, onde o shell escapa.
    const cap = meta.capabilities ?? {};
    if (Array.isArray(cap.network) && cap.network.length > 0
        && listaDeTexto(cap.execute?.allow).some((g) => COMANDOS_DE_REDE.some((re) => re.test(descascarRunner(g))))
        && !/allowlist_scope/.test(agente.body ?? '')) {
      avisos.push({ code: 'W05', path: agente.path,
        message: 'declara allowlist de domínio e comando capaz de rede, e o corpo não traz a ressalva de allowlist_scope: no Claude Code a allowlist é fronteira de SO, no OpenCode V2 e no janus kind=cli é fetch-only e o comando escapa' });
    }
  }
  return avisos;
}

/** Ponto de entrada único — usado pelo CLI e pelo Studio. */
export function validatePackage(pkg) {
  return {
    errors: [...validateStructure(pkg), ...validateGovernance(pkg)],
    warnings: validateWarnings(pkg),
  };
}
