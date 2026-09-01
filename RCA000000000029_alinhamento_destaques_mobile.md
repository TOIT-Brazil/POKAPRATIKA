# RCA000000000029 - Alinhamento dos destaques mobile

## Sintoma

No destaque de Aproveitamento, percentuais como `100,0%` avançavam sobre o divisor entre o valor e os textos. Nos demais destaques, valores curtos como `1` ficavam muito à esquerda, deixando espaço excessivo até o divisor.

## Causa raiz

No mobile, o bloco numérico tinha largura fixa de `38px` e alinhamento à esquerda. O Aproveitamento recebia somente `54px`, insuficientes para o percentual, padding e borda. Os demais valores permaneciam afastados da borda por ocuparem a extremidade oposta da coluna.

## Impacto

- Sobreposição visual entre percentual e divisor.
- Espaçamento inconsistente entre números e categoria.
- Leitura desequilibrada na grade 2x2.

## Correção

Alinhar os números à direita, próximos ao divisor, compactar a coluna comum e reservar uma coluna específica maior para Aproveitamento. Reduzir apenas a fonte do percentual longo.

## Prevenção

Colunas numéricas responsivas devem considerar o maior valor formatado, incluindo símbolo e casa decimal, e alinhar valores curtos junto ao divisor comum.