// PURO POR CONTRATO: nenhum import de node:*. O Studio importa este
// módulo para o preview de emissão no browser.

/**
 * Achata o bloco capabilities em chaves endereçáveis pelo binding.
 * Só declara o que o papel realmente tem: network false e lista vazia
 * não geram chave, porque não há capacidade a traduzir.
 */
export function capabilityKeys(cap = {}) {
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
  // memory e context NÃO entram aqui: vivem em metadata.memory e
  // metadata.context, fora de capabilities, e não são ferramenta. Cada
  // escritor decide o que fazer com eles, e o binding declara a perda
  // em unsupported_metadata.
  return chaves;
}

function valorDe(cap, chave) {
  if (chave === 'execute.allow') return cap.execute?.allow ?? [];
  if (chave === 'execute.deny') return cap.execute?.deny ?? [];
  if (chave === 'delegate') return cap.delegate ?? [];
  if (chave === 'budget') return cap.budget ?? null;
  if (chave === 'approve') return cap.approve ?? [];
  if (chave === 'network') return cap.network === false ? false : true;
  if (chave === 'network.allowlist') return Array.isArray(cap.network) ? cap.network : [];
  return chave.split('.')[1];
}

/**
 * Traduz as capacidades de um agente para as ferramentas do runtime do
 * binding. Toda capacidade que o runtime não expressa entra em `lost`
 * com motivo — perda silenciosa de fronteira é pior que fronteira
 * ausente, porque cria a impressão de governança onde não há.
 */
export function applyBinding(agent, binding, pkg) {
  const cap = agent.frontmatter?.metadata?.capabilities ?? {};
  const mapa = binding.map ?? {};
  const unsupported = new Set(binding.unsupported ?? []);

  const tools = [];
  const lost = [];
  const visto = new Set();

  for (const chave of capabilityKeys(cap)) {
    const valor = valorDe(cap, chave);

    if (unsupported.has(chave)) {
      lost.push({
        capability: chave,
        value: valor,
        reason: `o runtime "${binding.runtime}" não expressa esta capacidade (declarado em unsupported)`,
      });
      continue;
    }

    const destino = mapa[chave];
    if (destino === undefined) {
      lost.push({
        capability: chave,
        value: valor,
        reason: `perda não declarada: o binding "${binding.runtime}" não tem mapa nem unsupported para "${chave}". Corrija o binding`,
      });
      continue;
    }

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
  }

  // Permissões brutas, para runtime que as expressa (ex.: opencode).
  const permissions = binding.permissions ? buildPermissions(cap, binding, pkg) : null;

  return { tools, permissions, lost };
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
