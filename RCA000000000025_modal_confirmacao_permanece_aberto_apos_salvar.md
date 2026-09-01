# RCA000000000025 - Modal de confirmação permanece aberto após salvar

## Sintoma

Ao salvar a própria confirmação pela home ou pela página Partidas, os dados eram persistidos e recarregados, mas o modal continuava aberto. Para alterar a resposta, o usuário esperava abrir novamente a confirmação, escolher outro estado e salvar.

## Causa raiz

O callback `onSaved` dos modais manuais chamava `openMatch`, que recarregava o detalhe em `selectedMatch` e mantinha o modal montado. Somente o prompt automático já limpava seu estado depois do sucesso.

## Impacto

- O fluxo não apresentava encerramento visual após persistir a resposta.
- A resposta atualizada só ficava evidente depois de fechar manualmente o modal.
- O comportamento divergia entre o prompt automático e os acessos manuais.

## Correção

Após uma gravação bem-sucedida, recarregar os dados da tela e limpar `selectedMatch` nos dois acessos manuais. Em caso de erro, manter o modal aberto e exibir a mensagem retornada pela API.

## Prevenção

Callbacks de sucesso de uma mesma ação devem aplicar o mesmo estado final em todos os pontos de entrada do modal.