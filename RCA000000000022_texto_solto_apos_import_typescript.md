# RCA000000000022 - Texto solto após import TypeScript

## Sintoma

O editor apresentou dezenas de erros de compilação em `frontend/src/App.tsx`, começando por `Unexpected keyword or identifier` na linha do import de tipos.

## Causa raiz

Uma transcrição em linguagem natural foi anexada após o ponto e vírgula do import de `./types`. O TypeScript tentou interpretar as palavras como código e gerou diagnósticos em cascata.

## Impacto

- O frontend deixou de compilar.
- Os erros posteriores no arquivo não representavam defeitos independentes.
- A implementação da nova regra de convite ficou temporariamente bloqueada.

## Origem

Inserção textual acidental dentro do arquivo fonte aberto no editor.

## Correção

Remover somente o conteúdo posterior ao ponto e vírgula, preservando o import original.

## Prevenção

Executar `tsc --noEmit` antes e depois de alterações e manter ditados, prompts ou anotações fora dos arquivos de código.