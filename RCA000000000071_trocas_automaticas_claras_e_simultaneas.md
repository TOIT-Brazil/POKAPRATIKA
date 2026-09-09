# RCA000000000071 - Trocas automáticas claras e simultâneas

## Sintoma

O painel de trocas automáticas da súmula usava superfícies claras e mostrava simultaneamente a próxima etapa dos dois times. Quando uma etapa continha mais de um par, todas as substituições eram exibidas e executadas juntas.

## Causa raiz

A interface preservou cores fixas do tema claro e tratava cada horário do plano de rodízio como uma única unidade concluída. O estado registrava apenas o segundo executado, sem distinguir os pares previstos no mesmo horário.

## Impacto

O painel divergia do tema oficial e apresentava mais de uma ação física por vez, dificultando a orientação e a confirmação operacional em quadra.

## Correção

Aplicar o tema escuro ao painel e transformar os passos dos dois times em uma fila global ordenada por horário, par e time. Exibir e executar somente a primeira substituição pendente, registrar cada execução no log da súmula e revelar a seguinte após a atualização da escalação.

## Prevenção

Automações operacionais com múltiplas ações físicas devem controlar conclusão na menor unidade confirmável e apresentar somente a ação imediatamente executável.

## Resultado

- O painel usa as superfícies e os contrastes do tema escuro oficial.
- Somente um par `Sai → Entra` fica aparente por vez.
- Ao executar, titulares e banco são atualizados e a próxima substituição pendente aparece.
- Cada substituição é registrada individualmente no log da súmula.
- A composição persistida permite inferir pares já executados ao reabrir o jogo.
- Uma troca manual continua pausando a fila automática somente do respectivo time.
