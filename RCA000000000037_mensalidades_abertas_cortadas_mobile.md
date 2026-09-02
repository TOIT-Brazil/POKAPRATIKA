# RCA000000000037 - Mensalidades abertas cortadas no mobile

## Sintoma

Ao expandir um atleta na Gestão financeira, a subtabela `Mensalidades abertas do atleta` cortava informações necessárias no mobile e exigia deslocamento horizontal.

## Causa raiz

A subtabela mantinha oito colunas, incluindo `Pendente` e `Observação`, e preservava largura mínima de 820px no breakpoint mobile. A regra de tabela fixa aplicada à visão financeira não incluía explicitamente `.payments-subtable`.

## Impacto

As colunas finais, especialmente `Status` e `Ação`, ficavam afastadas ou fora da largura útil da tela, prejudicando a baixa operacional da mensalidade.

## Correção

Remover as colunas `Pendente` e `Observação` da subtabela aberta e incluir a subtabela no layout fixo responsivo, distribuindo as seis colunas restantes dentro de 100% da largura disponível.

## Prevenção

Toda redução de colunas em tabelas responsivas deve atualizar em conjunto o cabeçalho, as células, o `table-layout` e as larguras por coluna.