---
name: evidencia-replayavel
description: Coletar e registrar evidência de teste de modo que o mesmo achado reproduza com o mesmo veredito, por outra pessoa, depois
allowed-tools:
  - Read
  - Bash
metadata:
  paperclip:
    tags:
      - qa
      - evidencia
---

# Evidência replayável

Achado que não reproduz não é achado. Esta skill define o mínimo que
precisa ser guardado para que ele reproduza.

## A regra

**Outra pessoa, outra máquina, uma semana depois, chega ao mesmo
resultado** — sem falar com quem encontrou.

## O que guardar

| Item | Por quê |
|---|---|
| Comando exato executado | "rodei a checagem" não reproduz |
| Entrada concreta | Incluindo o dado que disparou o caso |
| Saída bruta da ferramenta | Antes de qualquer interpretação do modelo |
| Estado relevante do ambiente | Versão, configuração, hora |
| O que foi observado | Separado do que foi concluído |

## A separação que importa

Guarde **observação** e **conclusão** em campos distintos. A ferramenta
observa; o modelo conclui. Quando as duas se misturam no registro, ninguém
consegue mais auditar se a conclusão decorre da observação — e é
exatamente isso que o cliente questiona primeiro.

## Antipadrão

Captura de tela como evidência principal. Mostra que algo aconteceu, não
permite reproduzir, e não diz qual era o estado. Serve de anexo
ilustrativo, nunca de evidência.

## Teste desta skill

Pegue um achado seu de ontem e tente reproduzi-lo **lendo apenas o
registro**. Se precisou da sua memória, o registro está incompleto.
