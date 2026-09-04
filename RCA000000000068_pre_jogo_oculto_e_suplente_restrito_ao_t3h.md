# RCA000000000068 - Pré-jogo oculto e suplente restrito ao T-3h

## Sintoma

ADMIN e COORDENADOR viam apenas o estado resumido do próximo jogo, sem acesso à lista nominal de confirmados, ao sorteio ou à inclusão de suplentes. Além disso, a API rejeitava suplentes antes do fechamento da confirmação e depois do sorteio.

## Causa raiz

O modal administrativo de pré-jogo havia sido temporariamente removido da árvore de renderização, embora seu componente e seus endpoints permanecessem implementados. A interface condicionava o formulário de suplente exclusivamente ao estado `COMPLETING`, e o endpoint exigia horário posterior a `confirmation_close_at` e estado diferente de `DRAWN`.

## Impacto

A coordenação não conseguia conferir quem respondeu, preparar suplentes antecipadamente nem adicionar uma nova reserva após o sorteio. O fluxo operacional preservado no sistema ficou inacessível pela interface.

## Correção

Restaurar no card do próximo jogo o contador `X de 20 responderam` e o botão `Ver confirmados` somente para ADMIN/COORDENADOR. O botão abre o modal existente com lista nominal, inclusão de suplente e sorteio. Permitir suplentes durante todo o estado `DRAFT`: antes do sorteio entram como elegíveis e podem exceder 20 para formar reservas; depois do sorteio entram no fim da fila de reservas sem alterar os times. Manter o sorteio condicionado ao fechamento da confirmação e ao mínimo de 20 participantes.

## Prevenção

Mudanças de disponibilidade operacional devem alinhar o gatilho visual e as validações autoritativas do endpoint. Controles preservados, mas desmontados, precisam de registro explícito de decisão e critério de reativação.
