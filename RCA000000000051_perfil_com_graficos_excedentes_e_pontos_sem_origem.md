# RCA000000000051 - Perfil com gráficos excedentes e pontos sem origem

## Sintoma

Ao abrir o próprio perfil ou o perfil de outro atleta, o modal exibia um cabeçalho redundante, histórico de temporadas, gráfico de evolução, títulos e badges. O resumo informava apenas o total de pontos, sem explicar quais eventos e configurações formaram esse valor.

## Causa raiz

O perfil foi construído como um painel amplo de carreira, embora o uso mobile priorize identidade, radar e resumo. O endpoint `/users/:id/career` devolvia apenas `totalPoints` e métricas agregadas, sem as quantidades de jogos/pagamentos nem as regras atuais de `point_settings` necessárias para uma memória de cálculo.

## Impacto

O modal consumia espaço com informações secundárias e não permitia ao atleta auditar sua pontuação. Diferenças vindas de saldos iniciais importados também não eram identificadas na interface.

## Correção

O cabeçalho textual e os painéis de evolução, temporadas, títulos e badges foram removidos do perfil. Permaneceram identidade, radar e resumo da carreira. O endpoint passou a devolver jogos disputados, pagamentos pontuáveis e as regras reais de pontuação; a interface exibe cada fonte como quantidade multiplicada pelo valor configurado e reconcilia eventual diferença com o total oficial como ajuste/importação. Campos novos possuem fallback para permitir deploy independente de frontend e backend sem quebra transitória.

## Prevenção

Totais derivados exibidos ao usuário devem vir acompanhados de memória de cálculo baseada nos mesmos dados autoritativos. Interfaces de perfil mobile devem manter apenas informações acionáveis e evitar repetir navegação ou painéis históricos sem demanda operacional.