---
name: escopo-autorizado
description: Verificar e respeitar o escopo autorizado por escrito antes de qualquer verificação, e parar no limite nomeado
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - seguranca
      - escopo
---

# Escopo autorizado

Nada neste pacote executa sem autorização escrita. Escopo verbal não é
escopo — é intenção, e intenção não protege ninguém quando algo sai do
combinado.

## As cinco partes de um escopo válido

Sem as cinco, o escopo não está pronto para execução:

1. **Alvo** — o sistema, domínio ou repositório exato autorizado, nomeado
   sem ambiguidade
2. **Janela** — a data e hora de início e fim em que a avaliação pode
   acontecer
3. **Limite técnico** — o que está dentro (ex.: teste de injeção, revisão
   de dependência) e o que está explicitamente fora (ex.: engenharia
   social, negação de serviço)
4. **Contato de emergência** — a pessoa e o canal para avisar se algo der
   errado durante a execução
5. **Assinante** — pessoa nomeada no contrato, do lado do cliente, nunca do
   lado de quem executa

## A regra

Escopo verbal não é escopo. "O cliente disse por telefone que pode" não
substitui a assinatura — não porque a palavra do cliente valha menos, mas
porque memória de uma ligação não sobrevive a uma disputa, e a assinatura
existe exatamente para o momento em que alguém pergunta "quem autorizou
isso, e o que exatamente".

## Quando o caminho continua além do limite

Uma verificação que revela um caminho claramente maior do que o alvo
autorizado não é motivo para seguir "só para confirmar". É motivo para
**registrar o caminho e parar**, e levar a descoberta para quem pode pedir
ampliação de escopo. Seguir sozinho transforma avaliação contratada em
acesso não autorizado, mesmo com a melhor intenção do mundo.

## Por que isso protege as duas partes

A autorização protege quem executa (prova que o trabalho foi contratado e
dentro de que limite) e protege quem contrata (prova que nada além do
combinado foi tocado). Operar sem ela não é zelo nem agilidade — é
exposição legal para as duas partes, e a mais barata de evitar: basta não
começar antes da assinatura existir.
