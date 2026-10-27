---
name: Pacote Inválido
description: Fixture de teste — papel sem boundary, erro E06 deliberado
slug: pacote-invalido
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
---

# Pacote Inválido

Fixture para `tools/catalog.mjs`: tem um papel sem `metadata.boundary`, o
que `validateGovernance` reprova com E06. A geração do catálogo tem de
falhar sobre este pacote, nunca produzir um `catalog.json` dele.
