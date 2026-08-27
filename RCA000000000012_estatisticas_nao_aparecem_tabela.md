# RCA 000000000012 - Estatísticas não aparecem na tabela

## Sintoma

Na página de Estatísticas, o card e o cabeçalho da Tabela da temporada aparecem, mas as linhas estatísticas não ficam visíveis.

## Causa raiz

A página passou a ocupar a altura disponível com o card pai usando `overflow: hidden`. Entretanto, regras responsivas posteriores aplicam `overflow-y: visible !important` a `.dashboard-standings-wrap`. Essa declaração vence a rolagem definida para `.statistics-page`, faz as linhas excederem a área flexível e permite que o card pai as recorte.

A consulta `/seasons/:id/standings` e o tipo `Standing` usam o mesmo contrato em `snake_case`; não há divergência de dados entre backend e frontend.

## Impacto

Usuários acessam a página de Estatísticas, mas não conseguem consultar classificação, pontos, jogos e o indicador selecionado.

## Origem

A regressão surgiu ao ampliar a tabela para ocupar a tela inteira sem neutralizar os overrides responsivos globais criados para tabelas de fluxo natural.

## Correção

Aplicar uma regra específica da página de Estatísticas, após os overrides responsivos, restaurando `overflow: auto !important`, altura flexível mínima e tabela com largura mínima responsiva.

Após a restauração das linhas, a página também foi fixada em `100%` da área útil com `overflow: hidden !important`. Assim, o override mobile global de `.home-stack` não cria uma segunda barra de rolagem e somente `.dashboard-standings-wrap` permanece rolável.

## Prevenção

Ao reutilizar componentes compactos em páginas de altura fixa, validar a cascata completa nos breakpoints e evitar que regras globais com `!important` anulem o container rolável específico.
