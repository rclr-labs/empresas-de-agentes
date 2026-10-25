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

function gatesDo(pkg) {
  const raw = pkg.company.frontmatter?.metadata?.human_gates ?? [];
  // Alias de formato: lista de string crua vira {id} com slug derivado.
  return raw.map((g) =>
    typeof g === 'string'
      ? { id: g.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), description: g }
      : g,
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

  // E05 — ciclo de delegação
  const chefeDe = new Map(pkg.agents.map((a) => [a.slug, a.frontmatter?.reportsTo ?? null]));
  for (const inicio of chefeDe.keys()) {
    const visto = [];
    let atual = inicio;
    while (atual != null && chefeDe.has(atual)) {
      if (visto.includes(atual)) {
        erros.push(erro('E05', 'ciclo-de-delegacao', `agents/${inicio}/AGENTS.md`,
          `ciclo de delegação: ${[...visto.slice(visto.indexOf(atual)), atual].join(' → ')}`));
        break;
      }
      visto.push(atual);
      atual = chefeDe.get(atual);
    }
  }

  return erros;
}
