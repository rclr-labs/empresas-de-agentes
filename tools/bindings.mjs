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
 * Traduz as capacidades de um agente para o runtime do binding, em QUATRO
 * estados: `translated` (o runtime honra, e a ferramenta/mecanismo está
 * nomeado), `preserved` (o dado sobrevive no arquivo emitido, mas o
 * runtime não age sobre ele), `lost` (nem sobrevive, nem é honrado — o
 * RUNTIME não tem onde guardar a capacidade) e `not_emitted` (o mecanismo
 * EXISTE no runtime, está nomeado, mas ESTE EMISSOR não o escreve ainda —
 * dívida nossa, não limite de terceiro). Capacidade fora dos quatro é
 * defeito do binding, não silêncio: entra em `lost` com motivo "não
 * declarada".
 *
 * A distinção entre `lost` e `not_emitted` existe para não repetir o erro
 * que a Fase D-bis corrigiu: chamar as duas de "perdida" esconde dívida de
 * engenharia (`not_emitted`) detrás da limitação de um terceiro (`lost`) —
 * e dívida escondida assim é a mais confortável de existir, porque
 * ninguém fatura o terceiro por ela. Toda entrada de `not_emitted` tem de
 * nomear `mechanism` (o mecanismo real que resolveria) e `falta` (o que
 * falta para gerá-lo) — sem isso, "não emitido" é só "perdido" com outro
 * nome.
 *
 * Ordem de resolução: `translates` → `preserves` → `loses` →
 * `not_emitted` → nenhum dos quatro é defeito do binding, reportado como
 * antes.
 *
 * Mantém `map`/`unsupported`/`unsupported_metadata` como alias de leitura
 * de `translates`/`loses`, com motivo textual idêntico ao antigo, para que
 * um binding de terceiro escrito no formato binário anterior continue
 * carregando. Não existe alias antigo para `not_emitted` — é estado novo,
 * sem formato anterior a compatibilizar.
 */
export function applyBinding(agent, binding, pkg) {
  const cap = agent.frontmatter?.metadata?.capabilities ?? {};

  const translates = binding.translates ?? binding.map ?? {};
  const preserves = new Set(binding.preserves ?? []);
  const losesNovo = new Set(binding.loses ?? []);
  const unsupportedAntigo = new Set(binding.unsupported ?? []);
  const unsupportedMetadataAntigo = new Set(binding.unsupported_metadata ?? []);
  const notEmitted = binding.not_emitted ?? {};

  const tools = [];
  const translated = [];
  const preserved = [];
  const lost = [];
  const naoEmitida = [];
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

    if (chave in notEmitted) {
      const info = notEmitted[chave] ?? {};
      naoEmitida.push({
        capability: chave,
        value: valor,
        mechanism: info.mechanism,
        falta: info.falta,
        reason: `mecanismo: ${info.mechanism ?? '(não nomeado — defeito do binding)'} — ` +
          `falta: ${info.falta ?? '(não declarado — defeito do binding)'}`,
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
  const permissions = binding.permissions ? buildPermissions(cap) : null;

  return { tools, permissions, translated, preserved, lost, not_emitted: naoEmitida, warnings };
}

/**
 * OpenCode V2: `permissions` é ARRAY de `{action, resource, effect}`,
 * resolvido última-regra-vence (packages/schema/src/permission.ts,
 * medido em 2026-10-25 — ver bindings/opencode.yml `source`). Construir a
 * lista já em ordem "deny amplo primeiro, allow específico depois" é o
 * que faz a semântica de last-match produzir o resultado pretendido —
 * invertida, a mesma lista nega o que devia permitir e vice-versa. V1
 * usava um dict de glob (`bash`, `task`) resolvido mais-específico-vence;
 * essa função não serve mais ao V1, porque o único binding que a usa
 * (`opencode.yml`) migrou para V2 na tarefa 28.
 */
// Correção de auditoria (fix round 1): a condição original de `edit` só
// checava `write.includes('code')` — um papel que escreve documentação,
// evidência de teste ou relatório, sem escrever código, declarava
// write.documentation/test_evidence/report como `translates` na tabela
// de binding e recebia `edit: deny` na emissão real. A ação `edit` do
// OpenCode V2 cobre "edit/write/patch" em geral (permissions.mdx, §2 da
// pesquisa), não só código — é esse o escopo real que a condição tem de
// testar. pull_request fica de fora de propósito: isso é operação de
// shell (git/gh), não de edição de arquivo, e só é honrada de verdade
// quando o papel também lista o comando correspondente em execute.allow —
// caveat registrado em bindings/opencode.yml, não resolvido aqui.
const ESCRITA_QUE_EDIT_COBRE = ['code', 'documentation', 'test_evidence', 'report'];

function buildPermissions(cap) {
  const regras = [];
  regras.push({ action: 'shell', resource: '*', effect: 'deny' });
  for (const glob of cap.execute?.deny ?? []) regras.push({ action: 'shell', resource: glob, effect: 'deny' });
  for (const glob of cap.execute?.allow ?? []) regras.push({ action: 'shell', resource: glob, effect: 'allow' });
  regras.push({ action: 'subagent', resource: '*', effect: 'deny' });
  for (const slug of cap.delegate ?? []) regras.push({ action: 'subagent', resource: slug, effect: 'allow' });
  // edit: allow quando o papel escreve qualquer um dos alvos de arquivo
  // que a ação `edit` cobre — não só código.
  const escreveArquivo = (cap.write ?? []).some((w) => ESCRITA_QUE_EDIT_COBRE.includes(w));
  regras.push({ action: 'edit', resource: '*', effect: escreveArquivo ? 'allow' : 'deny' });
  // webfetch: allow quando lê a web OU quando a capacidade `network`
  // está declarada (true ou lista de domínio) — correção de auditoria:
  // antes só `read.web` disparava, e um papel com `network: true` mas
  // sem `read.web` (nenhum no acervo hoje, mas a tabela de binding
  // declara `network` como translates incondicionalmente) ficaria com
  // webfetch negado apesar de a capacidade dizer que tem rede.
  //
  // Segunda correção de auditoria, mesma rodada: quando `network` é uma
  // LISTA de domínio (não `true`), o binding declara `network.allowlist`
  // em `translates` — mas até aqui nada restringia `webfetch` a esses
  // domínios especificamente; a regra única `resource:'*'` dava acesso
  // geral, exatamente a perda "internet inteira em vez de só o alvo"
  // que `network.allowlist` existe para impedir. Diferente do Claude
  // Code, `permissions` aqui é escrito DENTRO do frontmatter de CADA
  // agente — não há arquivo compartilhado de projeto, então restringir
  // por domínio não corre o risco de conflito entre papéis que quebrou
  // a Opção A de `execute.deny` no Claude Code.
  const temRede = (cap.read ?? []).includes('web') || cap.network === true || Array.isArray(cap.network);
  const dominios = Array.isArray(cap.network) ? cap.network : [];
  if (dominios.length) {
    regras.push({ action: 'webfetch', resource: '*', effect: 'deny' });
    for (const dominio of dominios) {
      regras.push({ action: 'webfetch', resource: `https://${dominio}/*`, effect: 'allow' });
    }
  } else {
    regras.push({ action: 'webfetch', resource: '*', effect: temRede ? 'allow' : 'deny' });
  }
  return regras;
}
