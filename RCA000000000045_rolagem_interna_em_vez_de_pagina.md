# RCA000000000045 - Rolagem interna aplicada em vez da rolagem da página

## Sintoma

Após a padronização inicial, o conteúdo das views ficou limitado ao espaço restante de `100dvh` e passou a rolar dentro de um container próprio. Tabelas, como a de Usuários, não cresciam naturalmente para exibir todas as pessoas na extensão da página.

## Causa raiz

O requisito de manter o header visível foi interpretado como uma shell fixa com área interna rolável. O comportamento esperado era diferente: uma única barra vertical no documento/página, conteúdo com altura natural e apenas o header global de menu e logo em posição sticky.

## Impacto

O usuário encontrava uma área rolável interna em vez da barra principal da página. Tabelas e listas permaneciam contidas por limites de altura históricos, contrariando a navegação vertical esperada.

## Correção

Permitir que a shell e cada página cresçam conforme o conteúdo, devolver a rolagem vertical ao documento e manter o header global sticky no topo. Remover limites máximos de altura e rolagem vertical interna dos wrappers de tabela nas páginas, preservando somente rolagem horizontal quando a largura exigir.

## Prevenção

Distinguir explicitamente entre header sticky com scroll do documento e layout de viewport fixa com scroll interno. Para páginas administrativas e listas completas, priorizar altura natural e uma única barra vertical da página.