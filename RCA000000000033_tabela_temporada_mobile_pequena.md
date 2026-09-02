# RCA000000000033 - Tabela da temporada mobile pequena

## Sintoma

Após eliminar a barra horizontal e conter nomes longos, a tabela da temporada ficou pequena e difícil de enxergar no celular.

## Causa raiz

A regra mobile aplicava `font-size: .66rem` a cabeçalhos, números e nomes, além de usar apenas `5px` de padding vertical. A compactação necessária para a largura foi aplicada também à legibilidade vertical e tipográfica.

## Impacto

- Números e nomes exigiam esforço de leitura.
- Linhas tinham pouca separação visual.
- A tabela cabia na tela, mas perdeu ergonomia.

## Correção

Preservar as larguras fixas e a contenção horizontal, aumentando separadamente cabeçalhos, valores, nomes e altura das linhas.

## Prevenção

Compactação horizontal não deve reduzir tipografia e altura de toque abaixo do necessário para leitura confortável.