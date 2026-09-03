# RCA000000000055 - Distribuição das colunas da Agenda

## Sintoma

Na tabela da Agenda, Data e Jogo apareciam visualmente próximos, enquanto havia espaço excessivo entre o conteúdo de Jogo e a coluna Confirmação.

## Causa raiz

A grade fixa reservava largura excessiva para Jogo: 38% nas telas maiores e 35% no mobile. Ao mesmo tempo, Data recebia somente 22% e 24%, fazendo Jogo começar cedo e Confirmação começar tarde.

## Impacto

A leitura horizontal da linha ficava desequilibrada e dificultava associar rapidamente jogo e estado de confirmação.

## Correção

Ampliar moderadamente Data, reduzir Jogo e repassar o espaço para Confirmação, preservando os 17% de Ações. A distribuição passa a 25%/31%/27%/17% nas telas maiores e 28%/27%/28%/17% no mobile.

## Prevenção

Mudanças na tabela compacta da Agenda devem manter 100% da grade e avaliar em conjunto a posição inicial de Jogo e Confirmação nos breakpoints desktop e mobile.

## Resultado

- Jogo começa mais distante de Data.
- Confirmação começa mais próxima de Jogo.
- Ações preserva sua largura e a grade continua totalizando 100%.
- Typecheck, build de produção e diagnósticos do frontend foram concluídos sem erros.
