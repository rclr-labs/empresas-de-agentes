---
name: suite-que-nao-falha-sozinha
description: Escrever e manter suíte de teste ponta a ponta que falha só quando o produto quebrou, tratando intermitência como defeito da suíte
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - teste
      - automacao
---

# Suíte que não falha sozinha

Uma suíte e2e só vale o que custa enquanto o vermelho significa "o produto
quebrou". No momento em que o vermelho passa a significar "rode de novo",
a suíte parou de ser lida — e deixou de proteger qualquer coisa.

## O que é teste intermitente

Teste que falha e, rodado de novo sem nenhuma mudança no produto, passa. A
causa nunca é "a sorte virou" — é sempre um dos dois: a suíte depende de
tempo (corrida entre a asserção e o estado real) ou de estado que ela não
controla (dado compartilhado, ordem de execução, sessão de outro teste).

## Por que ele é mais caro que teste ausente

Teste ausente é lacuna conhecida — ninguém confia na cobertura que não
existe. Teste intermitente é lacuna disfarçada de cobertura: a suíte parece
verde na média, a equipe aprende a rodar de novo em vez de investigar, e o
dia em que o vermelho é de verdade passa raspando por reteste manual. A
suíte que falha sozinha treina a própria equipe a ignorá-la.

## Espera por condição, não por tempo

```text
errado:  sleep(2000); clicar(botao)
certo:   esperar(botao, { visivel: true }); clicar(botao)
```

`sleep` fixo falha quando o ambiente está lento (a condição ainda não
aconteceu) e esconde defeito quando está rápido (passa antes da condição
ter sido exercitada de verdade). Espera por condição aguarda o estado
real, não um palpite de duração.

## Seletor estável

Seletor por papel (`role`) ou por atributo dedicado a teste sobrevive a
retoque visual. Seletor por classe de CSS ou por posição no DOM quebra
toda vez que alguém muda o estilo — e quebra por um motivo que não tem
nada a ver com o comportamento que o teste deveria proteger.

## Independência entre testes

Cada teste cria o próprio dado e não depende da ordem de execução nem do
que outro teste deixou no ambiente. Teste que só passa depois de outro já
ter rodado é suíte com dependência oculta — rodar em paralelo, ou rodar só
aquele teste isolado, revela a dependência quebrando.

## Quarentena com registro e prazo

Teste identificado como intermitente sai da suíte principal no mesmo dia
em que falhar pela segunda vez sem mudança no produto. A quarentena carrega
três coisas, sempre: a justificativa do porquê ele é intermitente, a data
em que entrou, e o prazo para investigar — quarentena sem prazo é
exclusão permanente disfarçada de temporária.

## O teto de tamanho da suíte

E2e é o gate de deploy, não a camada de cobertura. Cada cenário a mais é
tempo de pipeline que **todo** deploy paga, mesmo o que não tocou aquele
fluxo — a suíte cresce sem fim se o critério for "poderia cobrir mais" em
vez de "esse é o caminho que, se quebrar, para o deploy". A suíte curta de
propósito é a que continua sendo lida; a suíte que cobre tudo é a que
ninguém espera terminar de rodar.
