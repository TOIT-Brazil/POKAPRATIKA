# RCA000000000030 - Barra horizontal na tabela da temporada mobile

## Sintoma

A tabela da temporada ainda exibia uma pequena barra horizontal no celular, e as colunas pareciam deslocadas para a direita.

## Causa raiz

A tabela mantinha `min-width: 420px`, superior à largura interna disponível em celulares de 375px e 390px. Além disso, o padding compacto era declarado antes de uma regra genérica mobile que restaurava `6px` nas laterais das células.

## Impacto

- Rolagem lateral residual na classificação.
- Espaço maior que o necessário entre colunas numéricas.
- Menor aproveitamento da largura útil.

## Correção

Remover a largura mínima no mobile, fazer a tabela ocupar `100%`, reduzir o padding horizontal na regra vencedora e reservar larguras compactas para posição e atleta.

## Prevenção

Overrides específicos de tabelas compactas devem ser declarados depois das regras genéricas responsivas e validados contra a largura interna real do card.