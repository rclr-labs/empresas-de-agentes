---
name: stack-dotnet
description: Convenções, ferramental e armadilhas de .NET e C# — SDK, runner de teste, injeção de dependência e gestão de pacote
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - stack
      - dotnet
---

# Stack .NET

Convenção e armadilha de quem implementa em .NET/C#. Não ensina a
linguagem — pressupõe que você já sabe escrever C# e precisa saber como
este ecossistema espera que o trabalho seja feito.

## Build e teste

`dotnet build` e `dotnet test` operam sobre a solução (`.sln`) ou projeto
(`.csproj`) na raiz. Framework de teste varia (xUnit, NUnit, MSTest) —
confirme pelo `.csproj` de teste antes de escrever um novo. Teste único:

```bash
dotnet test --filter "FullyQualifiedName~Namespace.Classe.Metodo"
```

## Layout de projeto

Um projeto por pasta, nome de pasta espelhando `.csproj`; projeto de
teste em pasta própria com sufixo `.Tests`, referenciando o projeto de
produção via `<ProjectReference>`.

## Injeção de dependência

O host (`Program.cs` em projeto moderno) registra serviço no container
embutido (`AddScoped`, `AddSingleton`, `AddTransient`) — o ciclo de vida
errado é a causa mais comum de estado que "vaza" entre requisições
(singleton guardando dado que devia ser por requisição) ou de objeto
descartado sendo usado depois (scoped resolvido fora do escopo de
requisição).

## As três armadilhas mais caras

1. **`async void` em vez de `async Task`.** Exceção lançada dentro de um
   método `async void` não é capturável pelo chamador — ela derruba o
   processo ou desaparece, dependendo do contexto.
2. **`IDisposable` não descartado.** Conexão, `HttpClient` criado fora de
   `IHttpClientFactory`, ou `DbContext` sem `using`/`await using` vazam
   recurso sob carga, não no teste isolado.
3. **Ciclo de vida de `DbContext`/escopo confundido com singleton.**
   `DbContext` registrado como singleton acumula estado entre requisições
   concorrentes e produz erro intermitente de concorrência que não
   reproduz localmente.

## Dependência nova sem trazer a árvore inteira

Adicione o pacote com versão explícita (`dotnet add package Pacote
--version x.y.z`) e confira a árvore antes de aceitar
(`dotnet list package --include-transitive`). Pacote de teste vai no
`.csproj` de teste, nunca no de produção — misturar os dois publica
ferramental de teste no artefato final.
