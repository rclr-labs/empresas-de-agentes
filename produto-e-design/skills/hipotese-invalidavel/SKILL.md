---
name: hipotese-invalidavel
description: Escrever hipótese de produto com critério explícito de invalidação, e encerrar a investigação quando o critério é atingido
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - produto
      - descoberta
---

# Hipótese invalidável

Uma hipótese só é hipótese quando existe um resultado que a derrubaria.
Sem isso, é opinião com formato de hipótese — qualquer coisa que aconteça
depois "confirma" ela.

## As quatro partes

Sem as quatro, não é hipótese completa:

1. **Quem** — o segmento de usuário ou cliente a que ela se aplica
2. **O que acreditamos** — a relação causal que estamos apostando que existe
3. **O que esperamos observar** — a métrica e o patamar que, se aparecer,
   sustenta a crença
4. **O que nos faria abandonar** — o resultado concreto que, se aparecer no
   lugar do esperado, encerra a hipótese como falsa

## Exemplo ruim e exemplo bom

> Ruim: "Achamos que os usuários vão gostar do novo fluxo de checkout."
>
> Nenhum resultado invalida isso. Reação positiva confirma; reação neutra
> também cabe ("gostaram, só não comentaram"); reação negativa pode ser
> lida como "ainda não se acostumaram". A frase sobrevive a qualquer dado.

> Bom: "Achamos que reduzir o checkout de 4 para 2 passos aumenta a
> conversão de carrinho abandonado em usuários que já compraram antes. Se,
> depois de duas semanas com 20% do tráfego no novo fluxo, a conversão não
> subir pelo menos 3 pontos, abandonamos esta hipótese e investigamos outra
> causa para o abandono."
>
> (Exemplo sintético — número e produto fictícios, só para mostrar a
> forma.)

A segunda frase nomeia o experimento, o prazo, o patamar e o que acontece
se o patamar não aparecer. A primeira não nomeia nada disso.

## A regra

Hipótese que nenhum resultado invalida não é hipótese — é torcida com
formato de análise. Se, ao escrever a quarta parte, você não conseguir
imaginar um resultado real que a derrubaria, a hipótese ainda não está
pronta para ser testada.

## Como encerrar sem fingir conclusão

Quando o critério é atingido — confirmado ou derrubado — encerre e registre
os dois casos:

- **Confirmado:** o resultado observado bateu o patamar esperado. Registre
  o número real, não só "deu certo".
- **Derrubado:** o resultado do critério de abandono apareceu. Registre
  isso como aprendizado, não como fracasso — é exatamente o que a hipótese
  foi desenhada para permitir descobrir.

Encerrar sem nenhum dos dois — "ainda estamos vendo", indefinidamente — é
fingir conclusão. Investigação que não termina é o gasto mais invisível
deste pacote.
