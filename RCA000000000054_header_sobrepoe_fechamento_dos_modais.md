# RCA000000000054 - Header sobrepõe fechamento dos modais

## Sintoma

Ao abrir um modal, o header global continuava visível acima do overlay e podia impedir o clique no `X` de fechamento.

## Causa raiz

O header sticky da shell usa `z-index: 90`, enquanto o overlay global `.modal` usa `z-index: 10`. Como não havia uma regra de estado para o header durante modais abertos, ele permanecia desenhado e interativo sobre a camada modal.

## Impacto

O usuário podia ficar impedido de fechar um modal pelo controle principal, especialmente quando o topo do card coincidia com a área ocupada pelo header.

## Correção

Ocultar visualmente e desabilitar a interação do header global sempre que a shell contiver um `.modal` aberto. Ao desmontar o modal, o seletor deixa de corresponder e o header retorna automaticamente.

## Prevenção

Toda camada modal deve bloquear a navegação global enquanto estiver aberta. Novos overlays devem reutilizar a classe `.modal` para herdar esse comportamento e preservar o `X` acessível.

## Resultado

- O header fica oculto e sem interação enquanto qualquer modal está montado.
- O `X` permanece livre para clique no topo do modal.
- O fechamento desmonta o modal e restaura o header automaticamente.
- Typecheck, build de produção e diagnósticos do frontend foram concluídos sem erros.
