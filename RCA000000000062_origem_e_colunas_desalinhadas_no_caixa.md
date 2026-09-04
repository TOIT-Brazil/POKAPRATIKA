# RCA000000000062 - Origem e colunas desalinhadas no Caixa

## Sintoma

A tabela de Lançamentos exibia a coluna Origem sem necessidade operacional e os cabeçalhos não se alinhavam de forma consistente com os dados.

## Causa raiz

A tabela preservava a geometria anterior de seis colunas: largura mínima de 880px, recuo manual na descrição e percentuais mobile específicos. A remoção de informações exigia redefinir a grade completa, não apenas ocultar uma célula.

## Impacto

Descrição, responsável e valor ocupavam eixos visuais inconsistentes, especialmente entre desktop e mobile.

## Correção

Remover Origem, seu filtro e sua participação na busca. Reconfigurar a tabela para cinco colunas com largura fixa em todas as telas: Data 16%, Tipo 15%, Descrição 31%, Responsável 19% e Valor 19%. Remover largura mínima e recuo manual da descrição.

## Prevenção

Toda alteração na quantidade de colunas deve atualizar em conjunto cabeçalho, corpo, estado de filtros, `colSpan` e grade responsiva.
