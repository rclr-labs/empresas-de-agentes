---
name: stack-php
description: Convenções, ferramental e armadilhas de PHP moderno — Composer, PSR, runner de teste e gestão de dependência
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - stack
      - php
---

# Stack PHP

Convenção e armadilha de quem implementa em PHP moderno. Não ensina a
linguagem — pressupõe que você já sabe escrever PHP e precisa saber como
este ecossistema espera que o trabalho seja feito.

## Build e teste

Composer é o gerenciador de dependência e o ponto de entrada para
instalar e autoload (`composer install`). PHPUnit é o runner de teste
padrão. Teste único:

```bash
vendor/bin/phpunit --filter nomeDoMetodoDeTeste caminho/ClasseTest.php
```

## Convenção de layout e estilo

PSR-4 para autoload (`namespace` espelha caminho de diretório, declarado
em `composer.json` → `autoload`) e PSR-12 para estilo de código. Projeto
que mistura `require`/`include` manual com autoload PSR-4 é sinal de
código não migrado — siga o padrão predominante no repositório.

## Biblioteca de teste padrão

PHPUnit (`PHPUnit\Framework\TestCase`). Dublê de dependência via mock
nativo do PHPUnit (`createMock`) ou Mockery quando já presente no
`composer.json` — não introduza um segundo framework de mock no mesmo
repositório.

## As três armadilhas mais caras

1. **Comparação frouxa (`==`) em vez de estrita (`===`).** `"0" == false`
   e `0 == "abc"` (antes do PHP 8) são `true` — condição que parece óbvia
   silenciosamente aceita entrada que não devia.
2. **Mutação de array por valor assumida como referência.** PHP copia
   array por valor por padrão; função que recebe array e espera alterar
   o original sem `&` no parâmetro altera só a cópia local.
3. **Autoload PSR-4 desalinhado com namespace real.** Classe move de
   pasta sem atualizar o `namespace`, ou vice-versa — o erro aparece como
   "Class not found" em runtime, não na escrita do código.

## Dependência nova sem trazer a árvore inteira

Declare a dependência com a constraint de versão mais estreita que o
projeto aceita (`composer require pacote:^x.y`, não sem versão) e rode
`composer why-not` ou `composer show -t` para conferir a árvore antes de
aceitar. Dependência de teste vai em `require-dev`, nunca em `require` —
misturar os dois carrega ferramental de teste para produção.
