# RCA000000000060 - Totais históricos confundem status da mensalidade

## Sintoma

A tabela de Gestão financeira exibia `Inadimplência total` e `Total pago` como somas de todo o histórico. Valores acumulados, como R$ 900,00, pareciam representar o preço de uma única mensalidade. A tabela também mantinha informações secundárias demais para a consulta operacional.

## Causa raiz

O agrupamento por atleta foi criado para consolidar cobranças entre temporadas, e os acumulados históricos foram expostos como colunas principais sem explicitar o período considerado.

## Impacto

O administrador podia interpretar o acumulado como valor mensal e precisava analisar várias colunas para responder às perguntas imediatas: quem está inadimplente e quem pagou o mês atual.

## Correção

Substituir os acumulados por `Situação`, com `Inadimplente` ou `OK`, e `Pagamento do mês`, baseado na cobrança da competência atual. Remover a coluna `Próximo mês em aberto`, o botão de exportação de mensalidades e o indicador visual de pontos antecipados. A expansão continua apresentando as cobranças abertas reais e permitindo a baixa.

## Prevenção

Indicadores históricos devem identificar explicitamente seu período. A tabela principal deve priorizar estados operacionais; valores detalhados permanecem no nível expandido da cobrança.
