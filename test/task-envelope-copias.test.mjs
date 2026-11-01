import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// A skill task-envelope não tem fonte única no schema hoje — cada pacote
// tem sua própria cópia física (ver issue #6, "skill cross-package no
// agentcompanies/v1"). Enquanto essa lacuna não fecha, este teste é a
// rede de segurança: garante que as 8 cópias continuam byte a byte
// idênticas, pegando divergência silenciosa antes que alguém edite uma
// cópia e as outras 7 fiquem desatualizadas sem aviso.

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const PACOTES = [
  'software-house',
  'documentacao-e-suporte',
  'engenharia-de-dados',
  'fabrica-de-testes',
  'operacao-de-conhecimento',
  'plataforma-e-operacao',
  'produto-e-design',
  'seguranca-ofensiva',
];

test('task-envelope: as 8 cópias do SKILL.md são idênticas byte a byte', () => {
  const conteudos = PACOTES.map((pacote) => ({
    pacote,
    texto: readFileSync(join(RAIZ, pacote, 'skills/task-envelope/SKILL.md'), 'utf8'),
  }));
  const [referencia, ...resto] = conteudos;
  for (const { pacote, texto } of resto) {
    assert.equal(texto, referencia.texto,
      `${pacote}/skills/task-envelope/SKILL.md diverge de ${referencia.pacote}/skills/task-envelope/SKILL.md`);
  }
});
