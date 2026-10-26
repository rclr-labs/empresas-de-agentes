---
name: stack-java
description: Convenções, ferramental e armadilhas de Java e JVM para quem implementa — build, teste, injeção de dependência e gestão de dependência
allowed-tools:
  - Read
  - Grep
  - Glob
metadata:
  paperclip:
    tags:
      - stack
      - java
---

# Stack Java

Convenção e armadilha de quem implementa em Java/JVM. Não ensina a
linguagem — pressupõe que você já sabe escrever Java e precisa saber como
este ecossistema espera que o trabalho seja feito.

## Build e teste

Maven (`mvn test`) ou Gradle (`gradle test`) — identifique qual o
repositório usa pelo arquivo na raiz (`pom.xml` ou `build.gradle`) antes
de rodar qualquer coisa. Teste único:

```bash
mvn test -Dtest=NomeDaClasseTest#metodoDeTeste
gradle test --tests "pacote.NomeDaClasseTest.metodoDeTeste"
```

## Layout de projeto

`src/main/java` para código de produção, `src/test/java` para teste —
pacote espelhado entre os dois. Recurso não-Java (config, SQL) vai em
`src/main/resources` e `src/test/resources`.

## Biblioteca de teste padrão

JUnit 5 (`org.junit.jupiter`) é o padrão atual; Mockito para dublê de
dependência. Projeto legado pode estar em JUnit 4 (`org.junit.Test`) —
confirme pelo import antes de escrever teste novo no estilo errado.

## As três armadilhas mais caras

1. **Injeção de dependência por reflexão esconde ciclo.** Spring e CDI
   resolvem dependência em runtime; um ciclo entre dois beans só aparece
   no boot da aplicação, não na compilação. Erro de "circular reference"
   no startup é esse problema, não um bug no seu código específico.
2. **Exception checked engolida em silêncio.** `catch (Exception e) {}`
   compila e escapa de revisão superficial porque o código "funciona" —
   até a exceção que importava ser vista desaparecer sem rastro.
3. **`equals`/`hashCode` desalinhados quebram coleção.** Sobrescrever um
   sem o outro corrompe `HashMap`/`HashSet` de forma que só aparece sob
   carga, não no teste unitário isolado.

## Dependência nova sem trazer a árvore inteira

Declare a dependência com escopo explícito (`<scope>` no Maven,
`implementation`/`testImplementation` no Gradle) e confira a árvore antes
de aceitar (`mvn dependency:tree` ou `gradle dependencies`). Dependência
de teste declarada no escopo de produção arrasta transitiva inteira para
o artefato final sem necessidade.
