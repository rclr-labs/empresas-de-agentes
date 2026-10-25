---
name: Pacote Mínimo
description: Fixture de teste
slug: pacote-minimo
schema: agentcompanies/v1
kind: company
version: 1.0.0
license: MIT
metadata:
  capability_vocabulary: capabilities/v1
  budget:
    currency: BRL
    monthly_cap: 100.00
    alert_at: 0.7
    alert_to: gerente
  human_gates:
    - id: deploy-producao
      description: deploy em produção
      signer: pessoa nomeada no kickoff
---

# Pacote Mínimo

Corpo do pacote.
