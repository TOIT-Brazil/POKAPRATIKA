# RCA000000000057 - Hierarquia de Data e Jogo na Agenda

> Supersedido em 2026-09-04 pelo RCA 058. A referência visual pertencia à tela Temporada, e a Agenda foi restaurada.

## Sintoma

A Agenda exibia Data antes de Jogo e tratava a data como texto compacto comum, sem a hierarquia visual solicitada para dia, mês, dia da semana e horário.

## Causa raiz

A tabela nasceu com ordem técnica `Data, Jogo, Confirmação, Ações` e reutilizava `matchDateLabel`, que concatena data e intervalo de horário em duas linhas sem partes semânticas próprias.

## Impacto

O nome do jogo não era a primeira informação da linha e a data tinha pouca ênfase, dificultando a leitura rápida da programação.

## Correção

Inverter as duas primeiras colunas para `Jogo, Data`, preservar seus filtros e criar uma composição exclusiva da Agenda. O nome do jogo usa o mesmo tamanho do dia e a data é empilhada em quatro linhas: dia, mês abreviado, dia da semana e horário, em caixa alta e negrito. Jogo permanece alinhado à esquerda e Data à direita.

## Prevenção

Mudanças de ordem em tabelas devem mover conjuntamente cabeçalho, filtro, célula e percentuais. Datas com hierarquia própria devem usar partes formatadas, sem manipulação textual improvisada.

## Resultado

- A ordem vigente é `Jogo, Data, Confirmação, Ações`.
- Jogo e seu filtro ficam alinhados à esquerda.
- Data e seu filtro ficam alinhados à direita.
- O nome do jogo usa o mesmo tamanho e peso visual do dia.
- A data apresenta quatro linhas independentes: dia grande, mês abreviado, dia da semana e horário, em caixa alta e negrito.
- Typecheck, build de produção e diagnósticos do frontend foram concluídos sem erros.
