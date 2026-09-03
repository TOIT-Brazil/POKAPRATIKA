# RCA000000000056 - Trocas automáticas sem controle operacional

## Sintoma

A súmula calculava e aplicava a rotação pelo relógio, mas não mostrava ao operador quais números deveriam sair e entrar nem oferecia um botão para confirmar a execução da troca em quadra.

## Causa raiz

O plano matemático de rotação estava conectado somente a um efeito reativo do cronômetro. Não existia uma superfície operacional para apresentar o próximo passo e efetivá-lo conscientemente.

## Impacto

A coordenação não conseguia antecipar a troca, orientar os atletas por número ou confirmar que a substituição física aconteceu antes de atualizar titulares e banco na súmula.

## Correção

Preservar o plano de janelas que distribui igualmente o tempo dos jogadores de linha, apresentar a próxima troca de cada time com horário, números e nomes de saída/entrada e substituir a aplicação silenciosa por um botão liberado quando o horário previsto chegar.

## Prevenção

Automações que representam uma ação física em quadra devem separar cálculo automático de confirmação operacional, sempre exibindo participantes, momento previsto, estado e resultado registrado.

## Resultado

- A próxima troca de cada time aparece abaixo do campo com horário previsto.
- Cada par informa explicitamente `Sai #N nome` e `Entra #N nome`.
- O botão permanece bloqueado até o horário calculado e executa todos os pares do passo quando acionado.
- Titulares e banco são atualizados, o resultado entra no log e o autosave persiste `startsOnBench`.
- Ao reabrir a súmula, os passos concluídos são inferidos pela composição persistida e a sequência continua da próxima troca.
- Uma troca manual continua pausando o automático do respectivo time.
- No mobile, os controles dos times são empilhados para preservar leitura e toque.
- Typecheck, build de produção, diagnósticos e `git diff --check` foram concluídos sem erros.
