# RCA000000000069 - Faixa de pré-jogo ausente em partida legada

## Sintoma

Abaixo do container verde do próximo jogo não apareciam o contador `N/20 respostas enviadas` nem o botão `Abrir pré-jogo`, embora a partida estivesse em rascunho e a conta tivesse permissão administrativa.

## Causa raiz

A renderização da faixa exigia simultaneamente `status = DRAFT` e `pregameState` preenchido. Partidas criadas antes da ativação do fluxo da migration 19 preservam `pregame_state = NULL`, portanto a condição desmontava toda a faixa. Apenas alterar a condição visual faria o botão abrir um endpoint que ainda rejeitava a partida como fluxo legado.

## Impacto

ADMIN e COORDENADOR não conseguiam acessar confirmados, suplentes, sorteio, times e reservas em rascunhos legados exibidos como próximo jogo.

## Correção

Exibir a faixa administrativa para qualquer próximo jogo `DRAFT`, independentemente do estado legado. Ao primeiro acesso autorizado ao pré-jogo, inicializar somente aquele rascunho com capacidade de referência 20 e estado `CONFIRMING` ou `COMPLETING`, conforme o fechamento da confirmação. A visualização de atletas continua condicionada ao fluxo já ativado e ao sorteio.

## Prevenção

Entradas de interface que habilitam fluxos novos para registros históricos devem tratar explicitamente valores legados nulos no frontend e na fronteira autoritativa do backend.
