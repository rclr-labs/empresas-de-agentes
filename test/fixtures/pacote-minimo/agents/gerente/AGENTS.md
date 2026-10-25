---
name: Gerente
title: Gerente
slug: gerente
reportsTo: null
skills: []
metadata:
  persona:
    display_name: Fixture Silva
    icon: "🧪"
    pronouns: ela/dela
    headline: Persona de fixture
    background:
      - Existe para o teste ter o que carregar
    strengths: [parsing]
    signature_question: "Isso carregou?"
  boundary:
    can: [ler o repositório]
    cannot: [fazer deploy]
  capabilities:
    read: [repository]
    write: []
    execute: { allow: [], deny: [] }
    network: false
    delegate: []
    approve: [deploy-producao]
  memory: { scope: project, retention: project, writes: [] }
  context: { sources: [], excludes: [] }
---

# Gerente

Corpo do agente.
