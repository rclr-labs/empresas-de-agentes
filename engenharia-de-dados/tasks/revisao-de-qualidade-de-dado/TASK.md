---
name: Revisão de qualidade de dado
description: Ritual de dado — checagens que falharam e quantas foram silenciadas, tabela sem dono, métrica com mais de uma definição em uso, frescor fora da janela
assignee: lideranca-de-dados
recurring: true
---

# Revisão de qualidade de dado

O ritual que mantém o organograma honesto depois que o contrato de dado e
a definição de cada métrica já estão publicados. Checagem passando e
incidente de dado continuando a chegar é o jeito mais caro de este
pacote parecer saudável sem estar.

## Toda revisão, nesta ordem

1. **Checagens que falharam, e quantas foram silenciadas.** Checagem
   falhando é o mecanismo funcionando; checagem silenciada depois de
   falhar é o mecanismo sendo desligado sem ninguém decidir isso de
   propósito — conte as duas separadamente, nunca só o total de
   checagens ativas.
2. **Tabelas sem dono declarado.** Tabela sem dono é contrato não
   escrito — alguém vai descobrir o contrato quebrando, e "alguém" nunca
   é quem tem o contexto para corrigir rápido.
3. **Métricas com mais de uma definição em uso.** Cada uma encontrada é
   uma cópia da duplicação original: dois relatórios discordando do
   mesmo número por estarem respondendo perguntas diferentes sem
   declarar isso. Resolver é unificar a definição e publicar de novo —
   nunca deixar as duas convivendo "porque os dois times já se
   acostumaram".
4. **Frescor fora da janela declarada.** Fonte que atrasou além do
   combinado no contrato é defeito a investigar agora, não um atraso que
   se resolve só sendo monitorado.
5. **O número que mais engana.** Checagens passando pode significar
   qualidade real ou pode significar checagem frouxa — leia a proporção
   de checagens verdes sempre ao lado de incidente de dado reportado por
   consumidor. Se os incidentes continuam chegando com a suíte verde, a
   suíte está testando o que é fácil, não o que o consumidor realmente
   precisa que seja verdade.
