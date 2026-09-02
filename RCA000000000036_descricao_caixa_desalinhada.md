# RCA000000000036 - Descrição do caixa desalinhada

## Sintoma

O rótulo `Descrição` e os textos dos lançamentos do Caixa do grupo não ocupavam o mesmo eixo visual no mobile.

## Causa raiz

O cabeçalho mobile posiciona o rótulo dentro da coluna compacta, mas uma regra específica mantinha as células de descrição alinhadas à esquerda. O recuo adicionado inicialmente preservou essa divergência e deslocou ainda mais os valores em relação ao centro da coluna.

## Impacto

Cabeçalho e conteúdo pareciam pertencer a eixos diferentes, prejudicando a leitura da tabela financeira.

## Correção

No mobile, remover o recuo específico e centralizar os valores da descrição como as demais células da tabela. A quebra de textos longos e a contenção dentro da coluna permanecem ativas. No desktop, o alinhamento à esquerda continua preservado para descrições extensas.

## Prevenção

Validar cabeçalho e conteúdo pelo centro geométrico da coluna em tabelas mobile compactas, sem reaproveitar o alinhamento textual do desktop.