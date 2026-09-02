# RCA000000000035 - Colunas do Caixa do grupo sobrepostas no mobile

## Sintoma

No Caixa do grupo, textos, filtros e badges de algumas colunas avançavam sobre as colunas vizinhas no mobile.

## Causa raiz

A tabela tinha layout fixo, mas os elementos internos dos cabeçalhos e células mantinham dimensões, padding e comportamento de overflow maiores que as porcentagens reservadas. Cabeçalhos com filtro e badges de tipo não eram contidos pela célula.

## Impacto

- Informações de colunas diferentes apareciam sobrepostas.
- Data, tipo, responsável e valor perdiam associação visual com seus cabeçalhos.
- A leitura do caixa ficava ambígua.

## Correção

Conter overflow em todas as células, alinhar cada tipo de dado à sua coluna, compactar filtros e badges e redistribuir as seis larguras percentuais sem reintroduzir rolagem lateral.

## Prevenção

Em tabelas mobile de layout fixo, todos os filhos de cabeçalhos e células devem respeitar `max-width: 100%` e ter estratégia explícita de quebra ou truncamento.