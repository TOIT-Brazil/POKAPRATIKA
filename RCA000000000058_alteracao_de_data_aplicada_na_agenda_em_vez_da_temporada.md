# RCA000000000058 - Alteração de data aplicada na Agenda em vez da Temporada

## Sintoma

Solicitações de composição visual referentes ao card do próximo jogo na tela Temporada foram aplicadas por engano à tabela da Agenda.

## Causa raiz

A expressão “na agenda” foi interpretada como a view administrativa Agenda, mas a referência visual enviada corresponde ao `.next-match-date-badge` exibido na home da Temporada. A implementação avançou sem validar o componente visual da imagem.

## Impacto

A tabela da Agenda teve ordem, larguras e tipografia alteradas indevidamente, enquanto o card correto da Temporada permaneceu sem a composição solicitada.

## Correção

Restaurar a Agenda ao layout anterior à sequência de pedidos e aplicar a hierarquia somente no card do próximo jogo da Temporada: nome do jogo primeiro, dia em seguida e mês, dia da semana e horário empilhados.

## Prevenção

Antes de alterar uma superfície citada informalmente, confirmar o componente pelo texto, classe e referência visual. Quando houver imagem, usá-la como âncora primária para identificar a view proprietária.

## Resultado

- A Agenda voltou à ordem `Data, Jogo, Confirmação, Ações`, à célula compacta original e aos percentuais anteriores à sequência equivocada.
- O card do próximo jogo na Temporada passou a exibir visualmente `NOME DO JOGO | 09 | SET / QUA / 20:00`.
- Nome e dia usam o mesmo tamanho, caixa alta e peso forte; mês, dia da semana e horário ficam empilhados.
- Typecheck, build de produção e diagnósticos do frontend foram concluídos sem erros.
