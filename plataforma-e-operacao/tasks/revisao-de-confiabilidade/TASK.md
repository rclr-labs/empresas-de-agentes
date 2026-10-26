---
name: Revisão semanal de confiabilidade
description: Ritual de operação — orçamento de erro por serviço, mudanças aplicadas com e sem reversão testada, alertas sem ação e postmortems com ação vencida
assignee: lideranca-de-plataforma
recurring: true
---

# Revisão semanal de confiabilidade

O ritual que mantém a plataforma honesta depois que a política de mudança
e os SLOs já estão definidos. Orçamento de erro esgotado sem ninguém
congelar mudança e postmortem com ação vencida são os dois jeitos mais
caros de este pacote parecer saudável sem estar.

## Toda semana, nesta ordem

1. **Orçamento de erro consumido, por serviço.** Um serviço perto de
   esgotar o orçamento é sinal para considerar congelar mudança não
   essencial antes do próximo incidente, não depois dele.
2. **Mudanças aplicadas, e quantas tiveram reversão testada.** Mudança
   aplicada sem reversão testada é risco aceito sem nomear quem aceitou —
   conte as duas, nunca só o total de mudanças.
3. **Alertas que dispararam sem ação possível.** Cada um é defeito do
   alerta a corrigir, não ruído operacional a tolerar — alerta que não
   ensina ninguém a agir ensina a ignorar o próximo.
4. **Postmortems com ação vencida.** Ação sem data cumprida é intenção
   registrada, não correção feita — trate ação vencida como pendência
   aberta, não como item encerrado pelo postmortem ter sido escrito.
5. **O número que mais engana.** Quantidade de deploy subindo com
   reversão não testada é risco acumulando, não velocidade — leia a
   contagem de deploy sempre ao lado da proporção com caminho de volta
   testado, nunca isolada.
