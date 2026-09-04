# RCA000000000065 - Estatísticas ausentes na Tabela da temporada

## Sintoma

A Tabela da temporada mostrava gols antes de vitórias e não apresentava assistências nem aproveitamento. O espaço horizontal reservado ao atleta e às células impedia acrescentar as métricas sem risco de rolagem lateral.

## Causa raiz

O componente compacto da classificação foi criado com oito colunas e uma grade mobile ajustada especificamente para essa quantidade. A evolução das estatísticas não atualizou em conjunto o JSX e a geometria da tabela.

## Impacto

A classificação não permitia comparar em uma única linha pontos, jogos, resultados, gols, assistências e aproveitamento.

## Correção

Reordenar a tabela para `#`, `Atleta`, `PTS`, `J`, `V`, `E`, `D`, `G`, `A`, `APR`. Calcular APR pela regra já usada no produto, `(3V + E) / (3J)`, e compactar posição, atleta e métricas para manter todas as colunas próximas e sem rolagem lateral.

## Prevenção

Mudanças na composição da classificação devem atualizar simultaneamente cabeçalhos, células, cálculo derivado e grade responsiva.
