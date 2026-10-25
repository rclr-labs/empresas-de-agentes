// PURO POR CONTRATO: nenhum import de node:*. O Studio importa este
// módulo para o preview de emissão no browser.

/**
 * Achata as capacidades de um agente — e os campos de topo que também são
 * fronteira (skills, memory, context) — em chaves endereçáveis pelo
 * binding. Só declara o que o papel realmente tem: network false e lista
 * vazia não geram chave, porque não há capacidade a traduzir.
 *
 * skills, memory e context NÃO vivem em `capabilities` — skills é campo
 * de topo do frontmatter, memory e context vivem em `metadata` ao lado de
 * `capabilities`, não dentro dele. Mas os três são fronteira do mesmo
 * jeito que `read`/`write`/`execute`: um runtime que não os expressa perde
 * governança do mesmo jeito. Ficaram de fora da enumeração até esta
 * versão — e foi exatamente essa lacuna que deixou "skills" sem casa:
 * nenhum binding o tinha em `map` nem em `unsupported`, e nenhum teste de
 * cobertura reclamava, porque a cobertura só enumerava `capabilities`.
 */
export function capabilityKeys(agent = {}) {
  const fm = agent.frontmatter ?? {};
  const meta = fm.metadata ?? {};
  const cap = meta.capabilities ?? {};
  const chaves = [];
  for (const alvo of cap.read ?? []) chaves.push(`read.${alvo}`);
  for (const alvo of cap.write ?? []) chaves.push(`write.${alvo}`);
  if ((cap.execute?.allow ?? []).length) chaves.push('execute.allow');
  if ((cap.execute?.deny ?? []).length) chaves.push('execute.deny');
  // network tem DUAS chaves de propósito. "network" é o alcance (o papel
  // sai para a rede, sim ou não) e traduz para a ferramenta de busca do
  // runtime. "network.allowlist" é a lista de domínio autorizado, e
  // runtime que não a expressa TEM de declarar a perda — senão a emissão
  // troca "só staging.cliente.com.br" por "a internet inteira" em
  // silêncio, que é a perda mais perigosa possível num papel de pentest.
  if (cap.network === true || Array.isArray(cap.network)) chaves.push('network');
  if (Array.isArray(cap.network) && cap.network.length) chaves.push('network.allowlist');
  if ((cap.delegate ?? []).length) chaves.push('delegate');
  if (cap.budget) chaves.push('budget');
  if ((cap.approve ?? []).length) chaves.push('approve');
  if ((fm.skills ?? []).length) chaves.push('skills');
  if (meta.memory) chaves.push('memory');
  if (meta.context) chaves.push('context');
  return chaves;
}

function valorDe(agent, chave) {
  const cap = agent.frontmatter?.metadata?.capabilities ?? {};
  if (chave === 'execute.allow') return cap.execute?.allow ?? [];
  if (chave === 'execute.deny') return cap.execute?.deny ?? [];
  if (chave === 'delegate') return cap.delegate ?? [];
  if (chave === 'budget') return cap.budget ?? null;
  if (chave === 'approve') return cap.approve ?? [];
  if (chave === 'network') return cap.network === false ? false : true;
  if (chave === 'network.allowlist') return Array.isArray(cap.network) ? cap.network : [];
  if (chave === 'skills') return agent.frontmatter?.skills ?? [];
  if (chave === 'memory') return agent.frontmatter?.metadata?.memory ?? null;
  if (chave === 'context') return agent.frontmatter?.metadata?.context ?? null;
  return chave.split('.')[1];
}

/**
 * Cita a fonte de uma célula, quando o binding declara `citations`. Uma
 * citação pode ser string (página ou arquivo lido) ou
 * `{ inferido: true, source: "razão" }` quando não há onde apontar. Célula
 * sem citação não falha aqui — o teste de arquivo é que exige a citação
 * nos quatro bindings publicados; esta função só anexa o que existir.
 */
function reasonFor(binding, chave, base) {
  const cite = binding.citations?.[chave];
  if (!cite) return base;
  if (typeof cite === 'string') return `${base} — fonte: ${cite}`;
  if (cite.inferido) return `${base} — inferido: ${cite.source}`;
  return base;
}

/**
 * allowlist_scope: "fetch-only" significa que a allowlist de rede só
 * governa chamada de busca (webfetch/tool de rede), não shell cru. Um
 * papel com os dois — allowlist E shell liberado por `execute.allow` —
 * tem uma lista decorativa: `curl`/`wget` passam por fora dela. Medido no
 * OpenCode V2 (resource do `shell` é o texto do comando, sem noção de
 * host) e no janus com provider `kind=cli` (as chamadas saem do binário,
 * fora do gateway). allowlist_scope "os" não avisa, porque aí é o sandbox
 * do sistema operacional que intercepta a rede do shell também.
 */
function checkAllowlistScope(agent, binding, warnings) {
  if (binding.allowlist_scope !== 'fetch-only') return;
  const cap = agent.frontmatter?.metadata?.capabilities ?? {};
  const allowlist = Array.isArray(cap.network) ? cap.network : [];
  const shellAllow = cap.execute?.allow ?? [];
  if (allowlist.length && shellAllow.length) {
    warnings.push({
      message: `allowlist de rede é nula para este papel: allowlist_scope é "fetch-only" ` +
        `e o papel também tem shell cru liberado (${shellAllow.join(', ')}) — um comando como ` +
        `curl sai por fora da allowlist, que vale só para a chamada de busca da ferramenta`,
    });
  }
}

/**
 * Traduz as capacidades de um agente para o runtime do binding, em três
 * estados: `translated` (o runtime honra, e a ferramenta/mecanismo está
 * nomeado), `preserved` (o dado sobrevive no arquivo emitido, mas o
 * runtime não age sobre ele) e `lost` (nem sobrevive, nem é honrado).
 * Capacidade fora dos três é defeito do binding, não silêncio: entra em
 * `lost` com motivo "não declarada".
 *
 * Mantém `map`/`unsupported`/`unsupported_metadata` como alias de leitura
 * de `translates`/`loses`, com motivo textual idêntico ao antigo, para que
 * um binding de terceiro escrito no formato binário anterior continue
 * carregando.
 */
export function applyBinding(agent, binding, pkg) {
  const cap = agent.frontmatter?.metadata?.capabilities ?? {};

  const translates = binding.translates ?? binding.map ?? {};
  const preserves = new Set(binding.preserves ?? []);
  const losesNovo = new Set(binding.loses ?? []);
  const unsupportedAntigo = new Set(binding.unsupported ?? []);
  const unsupportedMetadataAntigo = new Set(binding.unsupported_metadata ?? []);

  const tools = [];
  const translated = [];
  const preserved = [];
  const lost = [];
  const warnings = [];
  const visto = new Set();

  for (const chave of capabilityKeys(agent)) {
    const valor = valorDe(agent, chave);

    if (chave in translates) {
      translated.push(chave);
      const destino = translates[chave];
      const alvos = typeof destino === 'string' ? [destino] : destino;
      for (const alvo of alvos) {
        if (chave === 'delegate' && alvo.includes('{slug}')) {
          for (const slug of valor) {
            const ferramenta = alvo.replace('{slug}', slug);
            if (!visto.has(ferramenta)) { visto.add(ferramenta); tools.push(ferramenta); }
          }
          continue;
        }
        if (!visto.has(alvo)) { visto.add(alvo); tools.push(alvo); }
      }
      continue;
    }

    if (preserves.has(chave)) {
      preserved.push({
        capability: chave,
        value: valor,
        reason: reasonFor(binding, chave,
          `o dado sobrevive no arquivo emitido, mas o runtime "${binding.runtime}" não age ` +
          `sobre esta capacidade`),
      });
      continue;
    }

    if (unsupportedAntigo.has(chave) || unsupportedMetadataAntigo.has(chave)) {
      lost.push({
        capability: chave,
        value: valor,
        reason: `o runtime "${binding.runtime}" não expressa esta capacidade (declarado em unsupported)`,
      });
      continue;
    }

    if (losesNovo.has(chave)) {
      lost.push({
        capability: chave,
        value: valor,
        reason: reasonFor(binding, chave,
          `o runtime "${binding.runtime}" não expressa esta capacidade (declarado em loses)`),
      });
      continue;
    }

    lost.push({
      capability: chave,
      value: valor,
      reason: `perda não declarada: o binding "${binding.runtime}" não declara "${chave}" em ` +
        `translates, preserves nem loses. Corrija o binding`,
    });
  }

  checkAllowlistScope(agent, binding, warnings);

  // Permissões brutas, para runtime que as expressa (ex.: opencode).
  const permissions = binding.permissions ? buildPermissions(cap, binding, pkg) : null;

  return { tools, permissions, translated, preserved, lost, warnings };
}

function buildPermissions(cap, binding, pkg) {
  const p = structuredClone(binding.permissions.defaults ?? {});
  // bash: deny por padrão, allow explícito. O acervo é deny-by-default
  // por postura; o binding não inverte isso.
  p.bash = { '*': 'deny' };
  for (const glob of cap.execute?.deny ?? []) p.bash[glob] = 'deny';
  for (const glob of cap.execute?.allow ?? []) p.bash[glob] = 'allow';
  // task: só os slugs em delegate recebem allow.
  p.task = { '*': 'deny' };
  for (const slug of cap.delegate ?? []) p.task[slug] = 'allow';
  // edit: allow só quando o papel escreve código.
  p.edit = (cap.write ?? []).includes('code') ? 'allow' : 'deny';
  // webfetch: allow só quando lê a web.
  p.webfetch = (cap.read ?? []).includes('web') ? 'allow' : 'deny';
  return p;
}
