---
name: stack-python
description: Convenções, ferramental e armadilhas de Python — ambiente virtual, gerenciador de pacote, runner de teste e tipagem gradual
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - stack
      - python
---

# Stack Python

Convenção e armadilha de quem implementa em Python. Não ensina a
linguagem — pressupõe que você já sabe escrever Python e precisa saber
como este ecossistema espera que o trabalho seja feito.

## Ambiente virtual e teste

Nunca instale dependência fora de um ambiente isolado (`venv`, `poetry`
ou `pipenv` — confira qual o repositório usa pelo arquivo presente:
`pyproject.toml`, `Pipfile` ou `requirements.txt`). pytest é o runner de
teste padrão. Teste único:

```bash
pytest caminho/test_arquivo.py::test_nome -v
```

## Gerenciador de pacote

`pip` com `requirements.txt` é o caminho mais simples; `poetry` e
`pipenv` travam versão exata via lockfile próprio. Misturar `pip install`
direto num projeto gerenciado por `poetry` desalinha o lockfile do que
está de fato instalado.

## Tipagem gradual

Python aceita código sem anotação de tipo; `mypy` ou `pyright`, quando
configurados no repositório, verificam só o que foi anotado. Função sem
anotação não está "errada" — está fora da verificação, e isso é uma
escolha explícita do projeto, não um esquecimento seu para corrigir sem
avisar.

## As três armadilhas mais caras

1. **Argumento default mutável.** `def f(lista=[])` compartilha a mesma
   lista entre todas as chamadas que não passam o argumento — mutação
   numa chamada aparece nas próximas, de forma que parece ação à
   distância.
2. **Import circular entre módulos do mesmo pacote.** Funciona quando
   importado numa ordem e falha com `ImportError` parcial quando
   importado em outra — depende de qual módulo é carregado primeiro.
3. **Exceção genérica capturada e descartada (`except Exception:
   pass`).** Esconde erro real atrás de um bloco que "funciona" porque
   nunca propaga nada, nem o que importava ver.

## Dependência nova sem trazer a árvore inteira

Fixe a versão no gerenciador do projeto (`poetry add pacote`, ou entrada
explícita em `requirements.txt` com versão) e confira a árvore antes de
aceitar (`pip show pacote` ou `poetry show --tree`). Dependência só de
teste entra em grupo de dev (`requirements-dev.txt` ou grupo `dev` do
`poetry`), nunca na lista de produção.
