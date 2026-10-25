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

export const writers = {
  'claude-code': (agent, applied) => ({
    path: `${agent.slug}.md`,
    content: toMarkdown({
      frontmatter: {
        name: agent.slug,
        description: descricao(agent),
        tools: applied.tools.join(', '),
      },
      body: agent.body,
    }),
  }),

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
