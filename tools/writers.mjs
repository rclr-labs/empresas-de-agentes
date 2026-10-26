import { join } from 'node:path';
import { toMarkdown } from './serialize.mjs';

// A persona NÃO é emitida além da headline. background e strengths
// custam token em toda chamada do modelo e não mudam comportamento;
// servem o humano, o Studio e o organograma.
function descricao(agent) {
  const meta = agent.frontmatter.metadata ?? {};
  const headline = meta.persona?.headline;
  const title = agent.frontmatter.title ?? agent.frontmatter.name;
  return headline ? `${title}. ${headline}` : title;
}

// disallowedTools nega por NOME DE FERRAMENTA (code.claude.com/docs/en/
// sub-agents: "Tools to deny... Same format as tools") — não por glob de
// comando. O único caso em que isso corresponde de verdade à intenção do
// papel é quando `execute.allow` está vazio e `execute.deny` não: o papel
// não precisa de shell NENHUM (nada em allow justifica conceder Bash — a
// tradução de execute.allow→[Bash] também não dispara), e `execute.deny`
// ainda nomeia o que ele não pode fazer. Negar Bash por nome reforça essa
// intenção em profundidade (`tools:` já é allowlist e não incluiria Bash,
// mas disallowedTools é o reforço explícito que a doc do runtime
// confirma existir). NÃO tenta mapear glob de comando (`"kubectl *"`)
// para nome de ferramenta — isso exigiria glob-level deny, que é o
// mecanismo de `permissions.deny` + hook documentado em
// bindings/claude-code.yml, fora do que esta função escreve.
function disallowedTools(agent) {
  const cap = agent.frontmatter.metadata?.capabilities ?? {};
  const allow = cap.execute?.allow ?? [];
  const deny = cap.execute?.deny ?? [];
  return allow.length === 0 && deny.length > 0 ? ['Bash'] : [];
}

// execute.deny → hook PreToolUse por agente, TAREFA 30. VERIFICADO antes
// de escrever uma linha disto (code.claude.com/docs/en/sub-agents, seção
// "Hooks in subagent frontmatter"): o frontmatter de sub-agente aceita um
// campo `hooks` próprio, escopado a ESSE agente só — "These hooks only
// run while that specific subagent is active and are cleaned up when it
// finishes". É esse escopo por agente que resolve o que tornou a união
// por projeto perigosa (bindings/claude-code.yml, `source`): o hook de
// `desenvolvimento` nunca entra em conflito com o de `revisao`, porque
// cada um vive só no próprio arquivo.
//
// O comando do hook lê `tool_input.command` do JSON em stdin (confirmado
// em code.claude.com/docs/en/hooks) e sai com código 2 — "a PreToolUse
// hook blocks the tool call" — quando o comando casa um dos globs de
// `execute.deny` DESTE agente. Os padrões viajam como argumentos
// posicionais de um `sh -c` interno (`"$@"`), não interpolados direto na
// string do script: interpolar direto abriria injeção de shell se um
// glob um dia carregasse aspas ou `;` — passar por argv com quoting de
// cada padrão fecha essa classe de defeito.
function escapeShellSingleQuote(valor) {
  return `'${String(valor).replace(/'/g, "'\\''")}'`;
}

function denyHookCommand(patterns) {
  const args = patterns.map(escapeShellSingleQuote).join(' ');
  const script =
    'cmd=$(cat | jq -r ".tool_input.command // empty"); ' +
    'for p in "$@"; do case "$cmd" in $p) ' +
    'echo "Blocked: execute.deny nega o padrao: $p" >&2; exit 2;; esac; ' +
    'done; exit 0';
  return `sh -c '${script}' sh ${args}`;
}

function executeDenyHooks(agent) {
  const cap = agent.frontmatter.metadata?.capabilities ?? {};
  const deny = cap.execute?.deny ?? [];
  if (!deny.length) return null;
  return {
    PreToolUse: [
      {
        matcher: 'Bash',
        hooks: [{ type: 'command', command: denyHookCommand(deny) }],
      },
    ],
  };
}

// human_gates[].triggers → permissions.ask, TAREFA 30. Escopo de EMPRESA
// (todo o pacote), não de agente — ao contrário de execute.deny. É a
// escolha certa aqui, não o mesmo risco: um portão humano existe para
// QUALQUER agente do pacote que tente o comando, não para um papel só, e
// `ask` apenas PAUSA para confirmação — não nega como `deny` — então não
// há como a união de gatilhos bloquear o que outro papel tem permissão
// explícita para fazer (a razão pela qual a união de `execute.deny` foi
// rejeitada em bindings/claude-code.yml `source`). Só os portões que
// DECLARAM `triggers` contribuem; um portão sem gatilho de comando
// (contato com cliente, divulgar achado de segurança) não inventa um glob
// — fica em not_emitted (ver applyBinding, chave `approve`).
//
// Converte o glob de shell deste acervo ("terraform apply*") para a
// sintaxe de regra do Claude Code (code.claude.com/docs/en/permissions:
// "Bash(terraform apply:*)") — troca o `*` final por `:*`, a forma que a
// doc usa para "este prefixo, com qualquer coisa depois".
function globParaRegraBash(glob) {
  const prefixo = glob.endsWith('*') ? glob.slice(0, -1).trimEnd() : glob;
  return `Bash(${prefixo}:*)`;
}

export function buildAskRules(pkg) {
  const gates = pkg.company?.frontmatter?.metadata?.human_gates ?? [];
  const regras = [];
  const vistas = new Set();
  for (const gate of gates) {
    for (const glob of gate?.triggers ?? []) {
      const regra = globParaRegraBash(glob);
      if (!vistas.has(regra)) { vistas.add(regra); regras.push(regra); }
    }
  }
  return regras;
}

export const writers = {
  'claude-code': (agent, applied) => {
    const meta = agent.frontmatter.metadata ?? {};
    const skills = agent.frontmatter.skills ?? [];
    const memoryScope = meta.memory?.scope;
    const negadas = disallowedTools(agent);
    const hooks = executeDenyHooks(agent);
    // budget.max_turns: proxy de TURNO, nunca de GASTO — `budget`
    // continua perdido de verdade (bindings/claude-code.yml `loses`); o
    // campo novo, opcional, só emite quando o papel declara um número
    // explícito, e o nome do campo já avisa o operador do que é.
    const maxTurns = meta.capabilities?.budget?.max_turns;
    const frontmatter = {
      name: agent.slug,
      description: descricao(agent),
      tools: applied.tools.join(', '),
    };
    // Campos opcionais só aparecem quando o papel de fato os declara —
    // emitir `skills: []` ou `memory:` vazio para todo agente poluiria a
    // saída sem acrescentar fronteira nenhuma.
    if (skills.length) frontmatter.skills = skills.join(', ');
    if (memoryScope) frontmatter.memory = memoryScope;
    if (negadas.length) frontmatter.disallowedTools = negadas.join(', ');
    if (maxTurns != null) frontmatter.maxTurns = maxTurns;
    if (hooks) frontmatter.hooks = hooks;
    return {
      path: `${agent.slug}.md`,
      content: toMarkdown({ frontmatter, body: agent.body }),
    };
  },

  // V2 (medido em 2026-10-25): `permissions` é array de
  // `{action, resource, effect}`, não o dict `permission` de V1 — e
  // `temperature` é campo legado que a doc do runtime pede para não usar
  // em config V2 nova ("Do not use legacy top-level fields such as
  // temperature... in new V2 agent configuration", agents.mdx linha 344).
  opencode: (agent, applied) => ({
    path: `${agent.slug}.md`,
    content: toMarkdown({
      frontmatter: {
        description: descricao(agent),
        mode: 'subagent',
        permissions: applied.permissions,
      },
      body: agent.body,
    }),
  }),

  // identity NÃO tem escritor: emitir o pacote para o Paperclip é cópia
  // byte a byte do que já está em disco (o acervo JÁ é agentcompanies/v1).
  // Passar por toMarkdown reescreveria a formatação sem necessidade e
  // deixaria de ser identidade. Tratado direto em emit.mjs.
  portable: null, // por pacote, não por agente — ver portableManifest
};

/** O portable emite um único manifesto por pacote. */
export function portableManifest(pkg) {
  const meta = pkg.company.frontmatter.metadata ?? {};
  return {
    path: 'agent-manifest.json',
    content: `${JSON.stringify({
      schema: 'agentcompanies/v1',
      emitted_by: `portable binding do acervo empresas-de-agentes`,
      package: pkg.slug,
      name: pkg.company.frontmatter.name,
      license: pkg.company.frontmatter.license,
      capability_vocabulary: meta.capability_vocabulary ?? 'capabilities/v1',
      budget: meta.budget ?? null,
      human_gates: meta.human_gates ?? [],
      agents: pkg.agents.map((a) => ({
        slug: a.slug,
        name: a.frontmatter.name,
        title: a.frontmatter.title,
        reports_to: a.frontmatter.reportsTo ?? null,
        skills: a.frontmatter.skills ?? [],
        persona: a.frontmatter.metadata?.persona ?? null,
        boundary: a.frontmatter.metadata?.boundary ?? null,
        capabilities: a.frontmatter.metadata?.capabilities ?? {},
        memory: a.frontmatter.metadata?.memory ?? null,
        context: a.frontmatter.metadata?.context ?? null,
        prompt: a.body.trim(),
      })),
      // portable é o alvo "zero perda" por desenho — um manifesto que se
      // declara completo e larga projects/ no chão repete, uma camada
      // acima, o mesmo defeito que fez a identidade perder a pasta
      // inteira em silêncio. Cada projeto viaja com as próprias tarefas
      // aninhadas, que não são `pkg.tasks` (aquelas são tarefas soltas do
      // pacote; estas pertencem a um projeto específico).
      projects: (pkg.projects ?? []).map((p) => ({
        slug: p.slug,
        name: p.frontmatter.name,
        description: p.frontmatter.description ?? null,
        owner: p.frontmatter.owner ?? null,
        tags: p.frontmatter.tags ?? [],
        body: p.body.trim(),
        tasks: (p.tasks ?? []).map((t) => ({
          slug: t.slug,
          name: t.frontmatter.name,
          body: t.body.trim(),
        })),
      })),
    }, null, 2)}\n`,
  };
}

export { join };
