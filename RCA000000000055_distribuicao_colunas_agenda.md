# RCA000000000055 - Distribuição das colunas da Agenda

> Supersedido em 2026-09-04 pelo RCA 057, que inverteu Jogo e Data e definiu a hierarquia visual vigente.

## Sintoma

Na tabela da Agenda, Data e Jogo apareciam visualmente próximos, enquanto havia espaço excessivo entre o conteúdo de Jogo e a coluna Confirmação.

## Causa raiz

A grade fixa reservava largura excessiva para Jogo: 38% nas telas maiores e 35% no mobile. Ao mesmo tempo, Data recebia somente 22% e 24%, fazendo Jogo começar cedo e Confirmação começar tarde.

## Impacto

A leitura horizontal da linha ficava desequilibrada e dificultava associar rapidamente jogo e estado de confirmação.

## Correção

Ampliar Data, reduzir Jogo e repassar parte do espaço para Confirmação, preservando os 17% de Ações. Após refinamento visual, a distribuição vigente passa a 30%/26%/27%/17% nas telas maiores e 32%/22%/29%/17% no mobile.

## Prevenção

Mudanças na tabela compacta da Agenda devem manter 100% da grade e avaliar em conjunto a posição inicial de Jogo e Confirmação nos breakpoints desktop e mobile.

## Resultado

- Jogo começa 5 pontos percentuais mais à direita nas telas maiores e 4 pontos no mobile em relação ao primeiro ajuste.
- Confirmação fica proporcionalmente mais próxima do conteúdo de Jogo do que Data.
- Ações preserva sua largura e a grade continua totalizando 100%.
- Typecheck, build de produção e diagnósticos do frontend foram concluídos sem erros.
