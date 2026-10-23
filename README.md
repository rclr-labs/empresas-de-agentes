# Empresas de Agentes

Organogramas de agentes de IA prontos para operar, no formato aberto
`agentcompanies/v1`. Cada pacote traz papéis, hierarquia de delegação,
fronteira de permissão por papel, política de orçamento e portões de
aprovação — as quatro decisões que determinam se uma instalação de
plataforma multi-agente vira operação ou vira ferramenta parada.

Mantido pela **Best Code**.

## Por que isso existe

Instalar uma plataforma de gestão de agentes é simples. Operar não. Quatro
decisões precisam estar tomadas antes do primeiro agente produzir algo
aproveitável, e nenhuma delas é técnica:

| Decisão | Pergunta que ela responde |
|---|---|
| Organograma e fronteira de permissão | Quem delega para quem, e o que cada papel pode tocar |
| Política de orçamento | Quanto cada agente pode gastar antes de parar, e quem é avisado |
| Portões de aprovação | O que não acontece sem assinatura humana |
| Ritual de operação | Quem lê a trilha de auditoria, com que cadência, e o que faz com ela |

Tomadas por omissão, viram incidente: agente que gasta sem teto, trabalho
duplicado entre agentes e — o mais caro — resultado entregue como pronto que
ninguém verificou.

Cada pacote aqui é um ponto de partida com essas quatro decisões já
explicitadas, para você **discordar delas com conhecimento** em vez de
começar de uma folha em branco.

## Pacotes

| Pacote | O que é |
|---|---|
| [`software-house/`](software-house/) | Casa de software: coordenação, tech lead, desenvolvimento, revisão e portão de qualidade |
| [`fabrica-de-testes/`](fabrica-de-testes/) | Fábrica de testes governada: gerente de teste, especialistas por tipo, evidência verificável e veredito de release |

## Como usar

Os pacotes são markdown com frontmatter YAML. Não exigem registro central,
não exigem instalação e funcionam direto de uma pasta local ou de um repo
do GitHub.

```sh
git clone https://github.com/rclr-labs/empresas-de-agentes
# depois importe a pasta do pacote na sua plataforma
```

## Portabilidade

O formato `agentcompanies/v1` é **vendor-neutral por desenho** — a
especificação declara que é "intended to be usable by any agent-company
runtime". Em termos práticos: estes pacotes não te prendem a uma
plataforma.

- **Paperclip** — plataforma open source (MIT) que implementa o formato.
- **janus** — engine de orquestração multi-provider da Best Code.

Um organograma escrito aqui vale nos dois.

## Convenções deste acervo

Além do que a especificação exige, todo pacote daqui cumpre:

1. **`license` declarado** em todo pacote. Ferramenta compatível é obrigada
   a avisar quando falta (§17 da spec), e pacote sem licença não entra.
2. **Nenhum segredo, nenhum caminho absoluto.** `requirements.secrets`
   declara apenas *nomes* de variável. Valor de segredo e caminho de máquina
   nunca são dados canônicos de pacote.
3. **Fronteira de permissão explícita por papel.** Papel sem fronteira
   declarada é papel que pode tudo, e isso não é padrão aceitável.
4. **Portão humano nomeado.** Toda ação irreversível — deploy, gasto acima
   do teto, contato com cliente — diz de quem é a assinatura.
5. **Orçamento com teto e destinatário de alerta.** Teto sem quem-é-avisado
   é teto que ninguém aplica.

## Licença

MIT — veja [LICENSE](LICENSE). Os pacotes descrevem organização e processo;
adapte-os ao seu contexto sem pedir permissão.
