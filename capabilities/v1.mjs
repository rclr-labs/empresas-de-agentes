// Vocabulário fechado de capacidades. Agnóstico por desenho: nenhum nome
// de fornecedor entra aqui. A tradução para cada runtime vive em bindings/.
// Crescer este vocabulário é mudança de versão (v2), não adição silenciosa.

export const VERSION = 'capabilities/v1';

export const VOCABULARY = Object.freeze({
  read: Object.freeze([
    'repository', 'documentation', 'audit_trail',
    'test_evidence', 'database', 'web',
  ]),
  write: Object.freeze([
    'code', 'documentation', 'test_evidence', 'report', 'pull_request',
  ]),
  memory_scope: Object.freeze(['none', 'session', 'project', 'org']),
  memory_retention: Object.freeze(['none', 'session', 'project', 'org']),
  context_kind: Object.freeze(['repo_file', 'package_doc', 'url', 'path']),
});

// Alias pt-BR → chave canônica. Aceito na leitura, nunca emitido na escrita.
export const ALIASES = Object.freeze({
  fronteira: 'boundary',
  pode: 'can',
  nao_pode: 'cannot',
  capacidades: 'capabilities',
  orcamento: 'budget',
  moeda: 'currency',
  teto_mensal: 'monthly_cap',
  alerta_em: 'alert_at',
  destinatario_do_alerta: 'alert_to',
  alerta_para: 'alert_to',
  portoes_humanos: 'human_gates',
  memoria: 'memory',
  contexto: 'context',
  vocabulario_de_capacidades: 'capability_vocabulary',
});
