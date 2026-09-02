# RCA000000000034 - Indicador aberto na Gestão financeira

## Sintoma

O resumo superior da Gestão financeira ainda exibia o indicador monetário `aberto`, embora ele não fosse desejado nessa visão resumida.

## Causa raiz

O indicador fazia parte da sequência original de métricas e não havia sido incluído entre os elementos removidos na simplificação da página.

## Impacto

O resumo mantinha uma informação não solicitada e ocupava espaço adicional no mobile.

## Correção

Ocultar somente o segundo indicador do resumo, correspondente ao valor em aberto. A coluna `Próximo mês em aberto` da tabela permanece, pois representa o detalhe operacional por atleta.

## Prevenção

Separar métricas do resumo executivo das informações detalhadas necessárias à operação da tabela.