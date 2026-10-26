---
name: stack-node
description: Convenções, ferramental e armadilhas de Node e TypeScript — gerenciador de pacote, runner de teste, ESM contra CommonJS e gestão de dependência
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - stack
      - node
---

# Stack Node

Convenção e armadilha de quem implementa em Node/TypeScript. Não ensina a
linguagem — pressupõe que você já sabe escrever JS/TS e precisa saber como
este ecossistema espera que o trabalho seja feito.

## Gerenciador de pacote e teste

Confira o lockfile presente (`package-lock.json`, `yarn.lock` ou
`pnpm-lock.yaml`) antes de instalar qualquer coisa — misturar gerenciador
duplica a árvore de dependência. Runner de teste varia por repositório
(`node --test`, Vitest, Jest) — confirme pelo `package.json`. Teste único:

```bash
node --test caminho/arquivo.test.mjs
npx vitest run caminho/arquivo.test.ts -t "nome do teste"
npx jest caminho/arquivo.test.js -t "nome do teste"
```

## Layout de projeto

`src/` para código, espelhado em `test/` ou arquivo `*.test.*` ao lado do
código — o repositório já decidiu qual convenção segue; adote a que
estiver em uso, não a que você prefere.

## ESM contra CommonJS

`"type": "module"` no `package.json` decide se `.js` é ESM (`import`) ou
CommonJS (`require`). Extensão `.mjs`/`.cjs` sobrepõe essa decisão
arquivo a arquivo. Misturar os dois sem saber qual está em vigor produz
`SyntaxError: Cannot use import statement` ou `require() of ES Module`.

## As três armadilhas mais caras

1. **`node_modules` com versão duplicada da mesma dependência.** Duas
   dependências pedindo versões incompatíveis de uma terceira instalam
   as duas, em pastas diferentes — bug de "funciona aqui, não lá" que só
   aparece olhando `npm ls <pacote>`.
2. **Promise sem `await` nem `.catch` engole erro.** A exceção nunca
   chega ao `try/catch` que parecia cobri-la; o processo às vezes nem
   derruba, só perde o efeito esperado em silêncio.
3. **Import circular entre dois módulos ESM.** Resolve em runtime de
   forma inconsistente — o valor importado pode chegar `undefined`
   dependendo da ordem de carregamento, não do conteúdo do módulo.

## Dependência nova sem trazer a árvore inteira

Instale com o gerenciador do lockfile já em uso e confira o que entrou
(`npm ls <pacote>` ou `pnpm why <pacote>`) antes de seguir. Prefira
dependência com poucas transitivas quando duas bibliotecas resolvem o
mesmo problema — o custo de árvore pesada aparece no tempo de instalação
e no tamanho do bundle, não na revisão de código.
