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

function gatesDo(pkg) {
  const raw = pkg.company.frontmatter?.metadata?.human_gates ?? [];
  // Alias de formato: lista de string crua vira {id} com slug derivado.
  return raw.map((g) =>
    typeof g === 'string' ? { id: slugificarPortao(g), description: g } : g,
  );
}

function enumDe(verbo) {
  if (verbo === 'read') return VOCABULARY.read;
  if (verbo === 'write') return VOCABULARY.write;
  return null;
}

export function validateStructure(pkg) {
  const erros = [];
  const slugs = new Set(pkg.agents.map((a) => a.slug));
  const gateIds = new Set(gatesDo(pkg).map((g) => g.id));

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
  }

  // E09 — segredo e caminho absoluto, em TODO arquivo do pacote.
  // Fora do laço de agentes de propósito: varrer só os agentes deixava
  // passar segredo em COMPANY.md, que é exatamente o arquivo onde
  // requirements.secrets vive e onde caminho de organização aparece.
  // Foi medido: um sk-ant-* no corpo do COMPANY.md e um caminho absoluto
  // num SKILL.md produziam ZERO erros.
  for (const arquivo of [pkg.company, ...pkg.agents, ...pkg.skills, ...pkg.teams, ...pkg.tasks]) {
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
