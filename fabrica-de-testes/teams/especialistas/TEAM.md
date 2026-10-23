---
name: Especialistas
description: Subárvore de especialistas por tipo de teste, sob o gerente de teste
slug: especialistas
schema: agentcompanies/v1
kind: team
manager: ../../agents/polaris/AGENTS.md
includes:
  - ../../agents/acessibilidade/AGENTS.md
  - ../../agents/contrato-api/AGENTS.md
  - ../../agents/privacidade/AGENTS.md
  - ../../agents/integridade-de-dados/AGENTS.md
  - ../../agents/exploratorio/AGENTS.md
  - ../../skills/evidencia-replayavel/SKILL.md
tags:
  - team
  - qa
---

# Time de Especialistas

Um especialista por tipo de risco, cada um com a sua ferramenta
determinística, todos sob o gerente de teste.

## Por que por tipo, e não por produto

Especialista por produto acumula contexto e perde ferramenta: vira
generalista que conhece o sistema e testa tudo mal. Especialista por tipo
mantém a ferramenta afiada e troca de produto sem perder competência — e
é a divisão que permite acrescentar um tipo novo sem reorganizar o time.

## Acrescentando um tipo

O catálogo aqui é um recorte, não um limite. Tipos que valem um
especialista próprio quando o risco aparece: segurança de aplicação,
compatibilidade entre navegadores, desempenho sob carga, segurança de IA
(injeção de prompt, vazamento por contexto) e conformidade setorial.

A regra para criar um especialista novo é uma: **existe ferramenta
determinística que descobre e executa?** Se não existe, você não tem um
especialista — tem um modelo opinando, e isso já é o `exploratorio`.
