# RCA000000000027 - Janta não atualiza na home após confirmação

## Sintoma

Depois de salvar a confirmação com presença e janta, a quantidade de presença era atualizada na página inicial, mas o indicador de janta permanecia sem refletir a resposta recém-gravada.

## Causa raiz

O modal descartava o registro retornado pelo `PUT /matches/:id/attendance/me` e dependia exclusivamente de uma segunda carga completa de partidas para atualizar os indicadores da home. Assim, o estado visual da janta não era atualizado diretamente a partir do dado confirmado pelo backend.

## Impacto

- A confirmação de janta parecia não ter sido salva.
- O usuário não recebia retorno visual imediato da quantidade de pessoas na janta.
- Alterações de janta dependiam da atualização posterior da listagem.

## Correção

Propagar a resposta persistida pelo `PUT` até o estado da aplicação e recalcular imediatamente `attendanceDinnerPeople`, substituindo a contribuição anterior do usuário pela nova. Manter a recarga completa como reconciliação com o backend.

## Prevenção

Fluxos de gravação que retornam a entidade persistida devem usar essa resposta para atualizar o estado visível, sem depender somente de uma segunda consulta.

## Correção posterior

A aplicação inicial do delta após a recarga causava dupla contagem. Essa ordem foi supersedida pelo RCA 028: o estado local é atualizado primeiro e a listagem do backend faz a reconciliação final.