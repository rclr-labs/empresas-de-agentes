---
name: Revisão semanal de exposição
description: Ritual de operação — achados abertos por consequência, escopo vencido em uso e gasto por papel contra o teto
assignee: lideranca-de-seguranca
recurring: true
---

# Revisão semanal de exposição

O ritual que mantém a avaliação de segurança honesta depois que o escopo
foi assinado. Achado sem dono e escopo vencido ainda em uso são os dois
jeitos mais caros de este pacote parecer saudável sem estar.

## Toda semana, nesta ordem

1. **Achados abertos, por consequência e há quanto tempo.** Um achado de
   alta consequência aberto há semanas não é prioridade baixa — é
   exposição real que ninguém está corrigindo, e o tempo parado é o que
   mede isso, não a quantidade de achados na lista.
2. **Achados com dono nomeado contra achados órfãos.** Achado sem dono não
   vai ser corrigido por ninguém sentir vontade — vai ser corrigido porque
   alguém foi nomeado responsável, com prazo. Achado órfão é achado que o
   relatório registrou e a organização esqueceu.
3. **Escopos vencidos ainda sendo usados.** Uma avaliação rodando contra um
   escopo cuja janela já terminou não é descuido administrativo — é
   **incidente**, porque é exatamente a situação que o gate
   `escopo-autorizado-por-escrito` existe para impedir. Trate como
   incidente, não como observação de rodapé.
4. **Gasto por papel contra o teto.** `pentest-aplicacao` carrega o maior
   teto do pacote porque testar aplicação real é o trabalho mais caro —
   confira se o gasto real confirma essa premissa ou se outro papel está
   consumindo mais do que o esperado, o que normalmente sinaliza escopo
   maior do que o modelado.
5. **O número que mais engana.** Quantidade de achado caindo pode
   significar sistema mais seguro, ou pode significar que o escopo
   encolheu — menos alvo autorizado produz menos achado possível, sem
   nenhuma melhoria real por trás. Leia a contagem de achados sempre ao
   lado do tamanho do escopo coberto na mesma janela, nunca isolada.
