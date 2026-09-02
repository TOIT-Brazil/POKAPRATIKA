# RCA000000000046 - Agenda com tabela oculta e modal gigante

## Sintoma

A página Agenda deixou de exibir a tabela de agendamentos. Ao clicar em `Recorrente` ou `Data específica`, o formulário abria superdimensionado e o controle de fechamento podia ficar fora da área útil.

## Causa raiz

Após devolver altura natural às páginas, o wrapper da tabela da Agenda manteve `flex: 1 1 0`, `min-height: 0` e dependência de uma altura fixa do pai. Sem essa referência, a área podia colapsar. O modal de agenda continuava explicitamente excluído da política de modais compactos e preservava largura de 980px, espaçamentos grandes e fechamento dependente somente do botão no cabeçalho.

## Impacto

Agendamentos existentes ficavam inacessíveis na página e os fluxos de criação recorrente, criação avulsa e edição apresentavam baixa usabilidade, especialmente no mobile.

## Correção

Retirar o wrapper da tabela do dimensionamento flexível e permitir que sua altura seja determinada pelas linhas, mantendo apenas a rolagem horizontal. Tornar o editor um modal compacto, centralizado e limitado à viewport, com cabeçalho visível, conteúdo rolável e fechamento por X, clique externo e tecla `Esc`.

## Prevenção

Wrappers de tabela em páginas de altura natural não devem usar `flex-basis: 0` sem pai de altura definida. Modais operacionais compactos não devem ser excluídos da política comum sem necessidade comprovada e devem oferecer os três mecanismos de fechamento.