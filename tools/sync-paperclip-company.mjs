#!/usr/bin/env node
// Sincroniza um pacote distribuído (build-paperclip-distribution.mjs) com uma
// empresa JÁ EXISTENTE no Paperclip. `company import` em modo seguro não
// aceita `--collision replace`, então atualização de skills/agentes
// existentes passa por aqui, via API:
//   - skills: cria as que faltam, atualiza o SKILL.md das que mudaram;
//   - agentes (casados pelo `name` do AGENTS.md): atualiza o AGENTS.md se
//     mudou e anexa as skills declaradas (modo "add" — nunca remove skill).
//
// Porta generalizada de sdlc-ai-centric/scripts/sync_paperclip_company.py:
// mesma lógica, mas o diretório do pacote é sempre explícito (--package-dir)
// e não há mapa de nome de exibição — o `name` do AGENTS.md do acervo já é
// nome de exibição.
//
// Por padrão só mostra o plano. Use --apply para executar.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? padrao : process.argv[i + 1];
}

const packageDir = arg('package-dir');
const companyId = arg('company-id');
const api = arg('api', 'http://127.0.0.1:3100/api');
const apply = process.argv.includes('--apply');

if (!packageDir || !companyId) {
  console.error('uso: node tools/sync-paperclip-company.mjs --package-dir <dir> --company-id <id> [--api <url>] [--apply]');
  process.exit(2);
}
if (!existsSync(packageDir)) {
  console.error(`pacote não encontrado: ${packageDir} (rode build-paperclip-distribution.mjs antes)`);
  process.exit(2);
}

async function chamar(metodo, caminho, corpo, query) {
  let url = `${api.replace(/\/$/, '')}${caminho}`;
  if (query) url += `?${new URLSearchParams(query)}`;
  let resp;
  try {
    resp = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch (erro) {
    throw new Error(`${metodo} ${caminho} -> não foi possível conectar em ${api}: ${erro.cause?.message ?? erro.message}`);
  }
  const texto = await resp.text();
  if (!resp.ok) throw new Error(`${metodo} ${caminho} -> HTTP ${resp.status}: ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

function splitFrontmatter(texto) {
  const partes = texto.split('---\n');
  const raw = partes[1];
  const corpo = partes.slice(2).join('---\n');
  return [yaml.load(raw), corpo];
}

function normalizar(texto) {
  return `${texto.trim()}\n`;
}

function pastasCom(dir, arquivo) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, arquivo)))
    .map((e) => e.name)
    .sort();
}

async function idsDeAgentes() {
  const dados = await chamar('GET', `/companies/${companyId}/agents`);
  return (Array.isArray(dados) ? dados : dados.agents).map((a) => a.id);
}

async function sincronizarSkills() {
  const existentes = new Map((await chamar('GET', `/companies/${companyId}/skills`)).map((s) => [s.slug, s]));
  const chaves = new Map();
  for (const slug of pastasCom(join(packageDir, 'skills'), 'SKILL.md')) {
    const conteudo = readFileSync(join(packageDir, 'skills', slug, 'SKILL.md'), 'utf8');
    const [meta] = splitFrontmatter(conteudo);
    let skill = existentes.get(slug);
    if (!skill) {
      console.log(`  skill ${slug}: criar`);
      if (!apply) continue;
      skill = await chamar('POST', `/companies/${companyId}/skills`, { name: meta.name, slug, description: meta.description });
    } else {
      chaves.set(slug, skill.key);
      const atual = (await chamar('GET', `/companies/${companyId}/skills/${skill.id}/files`, undefined, { path: 'SKILL.md' })).content;
      if (normalizar(atual) === normalizar(conteudo)) continue;
      if (skill.editable === false) {
        // Skills vindas do `company import` ficam com fonte "catalog"
        // (somente leitura): desanexa, exclui e recria como skill local
        // editável; sincronizarAgentes reanexa depois.
        console.log(`  skill ${slug}: recriar (fonte somente leitura: ${skill.sourceType})`);
        if (!apply) continue;
        for (const agentId of await idsDeAgentes()) {
          const desejadas = (await chamar('GET', `/agents/${agentId}/skills`)).desiredSkills;
          if (desejadas.includes(skill.key)) {
            await chamar('POST', `/agents/${agentId}/skills/sync`, { mode: 'remove', desiredSkills: [skill.key] });
          }
        }
        await chamar('DELETE', `/companies/${companyId}/skills/${skill.id}`);
        skill = await chamar('POST', `/companies/${companyId}/skills`, { name: meta.name, slug, description: meta.description });
        chaves.set(slug, skill.key);
      } else {
        console.log(`  skill ${slug}: atualizar SKILL.md`);
      }
    }
    if (apply) {
      await chamar('PATCH', `/companies/${companyId}/skills/${skill.id}/files`, { path: 'SKILL.md', content: conteudo });
      chaves.set(slug, skill.key);
    }
  }
  return chaves;
}

async function sincronizarAgentes(chaves) {
  const dados = await chamar('GET', `/companies/${companyId}/agents`);
  const porNome = new Map((Array.isArray(dados) ? dados : dados.agents).map((a) => [a.name, a]));
  for (const slug of pastasCom(join(packageDir, 'agents'), 'AGENTS.md')) {
    const conteudo = readFileSync(join(packageDir, 'agents', slug, 'AGENTS.md'), 'utf8');
    const [meta, corpo] = splitFrontmatter(conteudo);
    const agente = porNome.get(meta.name);
    if (!agente) {
      console.log(`  agente ${meta.name}: NÃO encontrado na empresa (importe-o com company import)`);
      continue;
    }
    const atual = await chamar('GET', `/agents/${agente.id}/instructions-bundle/file`, undefined, { path: 'AGENTS.md' });
    if (normalizar(atual.content ?? '') !== normalizar(corpo)) {
      console.log(`  agente ${meta.name}: atualizar AGENTS.md`);
      if (apply) {
        const revisao = atual.revision ?? {};
        await chamar('PUT', `/agents/${agente.id}/instructions-bundle/file`, {
          path: 'AGENTS.md',
          content: corpo,
          baseRevisionId: revisao.id,
          baseHash: atual.contentHash,
        });
      }
    }
    const desejadas = new Set((await chamar('GET', `/agents/${agente.id}/skills`)).desiredSkills);
    const querida = (meta.skills ?? []).map((s) => chaves.get(s) ?? `<${s} após criação>`);
    const faltando = querida.filter((k) => !desejadas.has(k));
    if (faltando.length) {
      console.log(`  agente ${meta.name}: anexar ${faltando.length} skill(s)`);
      if (apply) await chamar('POST', `/agents/${agente.id}/skills/sync`, { mode: 'add', desiredSkills: faltando });
    }
  }
}

console.log(apply ? 'APLICANDO' : 'PLANO (dry-run — use --apply para executar)');
try {
  const chaves = await sincronizarSkills();
  await sincronizarAgentes(chaves);
  console.log('Concluído.');
} catch (erro) {
  console.error(erro.message);
  process.exit(1);
}
