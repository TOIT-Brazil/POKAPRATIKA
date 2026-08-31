# RCA000000000020 - Subtabela de mensalidades permanece clara

## Sintoma

Ao expandir um atleta na tela de mensalidades, a área `Mensalidades abertas do atleta` permanecia quase branca, divergindo do tema escuro da tabela principal e reduzindo o contraste dos dados.

## Causa raiz

O seletor específico `.payments-group-detail-row td` mantinha o fundo claro `rgba(244,250,246,.96)` criado antes da adoção do tema escuro. Além da célula externa, esse seletor alcançava todos os `<td>` da tabela aninhada e pintava individualmente cada célula de branco. Por ter maior especificidade que as regras genéricas das células, ele continuava prevalecendo. O wrapper `.payments-subtable-wrap` também não possuía superfície escura explícita.

## Impacto

- Ruptura visual ao abrir o detalhamento financeiro do atleta.
- Baixo contraste em mês, vencimento, valores, status e observação.
- Leitura mais lenta das cobranças abertas e atrasadas.

## Origem

A camada de compatibilidade do tema cobriu a tabela de mensalidades e os cartões de histórico, mas não incluiu a linha expansível nem seu wrapper interno.

## Correção

Aplicar a superfície grafite oficial à célula expansível, ao wrapper e a todos os elementos da tabela aninhada. Cabeçalho, linhas alternadas e hover receberam fundos escuros explícitos, preservando texto principal claro, cabeçalho verde e texto auxiliar com o token de contraste secundário.

## Prevenção

Ao revisar temas de tabelas expansíveis, validar separadamente linha principal, célula de expansão, wrapper interno, cabeçalho e estados semânticos.