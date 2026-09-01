# RCA000000000026 - Modal automático duplicado de confirmação

## Sintoma

Depois de salvar a presença e a janta no modal aberto pelo botão de confirmação, o primeiro modal fechava e outro modal equivalente permanecia visível com o botão `Depois`.

## Causa raiz

Havia dois pontos de entrada independentes para a mesma ação:

- o modal manual controlado por `selectedMatch`;
- o `GlobalAttendancePrompt`, montado globalmente e atualizado a cada 15 segundos.

O prompt global podia estar aberto por baixo do modal manual. Quando o modal manual fechava após salvar, o prompt anterior era revelado, aparentando a criação de um novo modal.

## Impacto

- O usuário precisava lidar duas vezes com a mesma confirmação.
- O botão `Depois` não fazia sentido após uma gravação concluída.
- O comportamento criava dúvida sobre a persistência da resposta.

## Correção

Remover o prompt automático global e manter somente o modal aberto explicitamente pelo botão de confirmação. Após salvar com sucesso, esse modal atualiza os dados e fecha.

## Prevenção

Uma ação modal deve possuir um único controlador visível por vez. Novos pontos de entrada devem reutilizar o mesmo estado de abertura, em vez de montar instâncias globais independentes.