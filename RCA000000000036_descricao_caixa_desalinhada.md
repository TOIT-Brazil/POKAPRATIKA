# RCA000000000036 - Descrição do caixa desalinhada

## Sintoma

O rótulo `Descrição` e os textos dos lançamentos do Caixa do grupo não começavam no mesmo eixo horizontal.

## Causa raiz

O cabeçalho usa um ícone de filtro antes do rótulo, enquanto a célula de descrição começava diretamente na borda da coluna. No mobile, a diferença era de aproximadamente 15px; no desktop, o botão de filtro maior ampliava o deslocamento.

## Impacto

Cabeçalho e conteúdo pareciam pertencer a eixos diferentes, prejudicando a leitura da tabela financeira.

## Correção

Aplicar à célula de descrição um recuo equivalente ao espaço ocupado pelo filtro e seu intervalo no cabeçalho, preservando a quebra de textos longos dentro da coluna.

## Prevenção

Ao adicionar controles internos aos cabeçalhos, alinhar o eixo textual das células ao início do rótulo, não à borda externa do controle.