# RCA000000000021 - Texto solto quebra cálculo de aproveitamento

## Sintoma

O frontend apresentava erros de compilação em cascata no cálculo do destaque de Aproveitamento, incluindo `',' expected`, nomes inexistentes e propriedades ausentes em `topEfficiency`.

## Causa raiz

Uma frase em linguagem natural foi inserida acidentalmente entre o fechamento do `.map(...)` e a chamada `.sort(...)` do cálculo de `topEfficiency`. Como o texto não estava delimitado como código ou comentário, o parser TypeScript perdeu a estrutura do encadeamento e passou a interpretar suas palavras como identificadores e argumentos.

## Impacto

- O arquivo `frontend/src/App.tsx` deixou de compilar.
- O destaque de Aproveitamento e todo o frontend ficaram impedidos de gerar um novo build.
- Os demais erros exibidos eram consequências da mesma quebra sintática.

## Origem

Edição textual acidental dentro de uma expressão TypeScript válida.

## Correção

Remover exclusivamente a frase solta e restabelecer a ligação direta entre o fechamento do `.map(...)` e a chamada `.sort(...)`.

## Prevenção

Executar `tsc --noEmit` após edições em `App.tsx` e manter instruções ou anotações fora de expressões executáveis.