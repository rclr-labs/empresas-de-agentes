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

    // E02 — vocabulário fechado
    for (const verbo of ['read', 'write']) {
      const permitidos = enumDe(verbo);
      for (const valor of cap[verbo] ?? []) {
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
    for (const alvo of cap.delegate ?? []) {
      if (!slugs.has(alvo)) {
        erros.push(erro('E03', 'delegacao-orfa', where,
          `delega para "${alvo}", que não é papel deste pacote. Papéis: ${[...slugs].join(', ')}`));
      }
    }

    // E04 — approve referencia gate existente
    for (const gate of cap.approve ?? []) {
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
  const escreve = (cap.write ?? []).length > 0;
  const executa = (cap.execute?.allow ?? []).length > 0;
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
    const naoPode = (meta.boundary?.cannot ?? []).join(' | ');
    for (const { prosa, comandos } of CONTRADICOES) {
      if (!prosa.test(naoPode)) continue;
      for (const permitido of cap.execute?.allow ?? []) {
        if (comandos.some((c) => c.test(permitido))) {
          erros.push(erro('E10', 'prosa-contradiz-capacidade', where,
            `boundary.cannot nega "${naoPode}" mas execute.allow permite "${permitido}". A prosa e a capacidade descrevem a mesma fronteira e discordam`));
        }
      }
    }

    // E11 — quem implementa não aprova
    if ((cap.write ?? []).includes('code') && (cap.approve ?? []).length > 0) {
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
    for (const gateId of cap.approve ?? []) {
      const portao = gatesDo(pkg).gates.find((g) => g.id === gateId);
      if (!portao) continue; // ausência é E04, não duplica aqui
      if (portao.signer !== agente.slug) {
        erros.push(erro('E14', 'approve-discorda-do-signer', where,
          `aprova "${gateId}", mas o signer desse portão é "${portao.signer}". approve significa "pode assinar": se quem assina é outra pessoa ou outro papel, este papel não aprova nada — remova o portão de approve, ou declare este papel como signer`));
      }
    }

    // E15 — alcance declarado. Capacidade que nega a rede que o comando usa
    // é fronteira que não existe: o operador lê "sem rede" e o processo sai.
    const allow = cap.execute?.allow ?? [];
    const cmdRede = allow.find((g) => COMANDOS_DE_REDE.some((re) => re.test(descascarRunner(g))));
    if (!temRede(cap)) {
      if ((cap.read ?? []).includes('web')) {
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
    const write = cap.write ?? [];
    const temPush = allow.some((g) => /^(git push|gh pr create)/.test(g));
    if (write.includes('pull_request') && !temPush) {
      erros.push(erro('E16', 'par-pull-request', where,
        'declara write: [pull_request] e não tem "git push*" nem "gh pr create*" em execute.allow — capacidade inalcançável'));
    }
    if (temPush && !write.includes('pull_request')) {
      erros.push(erro('E16', 'par-pull-request', where,
        'tem "git push*" ou "gh pr create*" em execute.allow e write não inclui pull_request — acrescente pull_request a write, ou remova o comando'));
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
        && (cap.execute?.allow ?? []).some((g) => COMANDOS_DE_REDE.some((re) => re.test(descascarRunner(g))))
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
