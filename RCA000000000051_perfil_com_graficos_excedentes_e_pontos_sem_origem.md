# RCA000000000051 - Perfil com gráficos excedentes e pontos sem origem

## Sintoma

Ao abrir o próprio perfil ou o perfil de outro atleta, o modal exibia um cabeçalho redundante, histórico de temporadas, gráfico de evolução, títulos e badges. O resumo informava apenas o total de pontos, sem explicar quais eventos e configurações formaram esse valor.

## Causa raiz

O perfil foi construído como um painel amplo de carreira, embora o uso mobile priorize identidade, radar e resumo. O endpoint `/users/:id/career` devolvia apenas `totalPoints` e métricas agregadas, sem as quantidades de jogos/pagamentos nem as regras atuais de `point_settings` necessárias para uma memória de cálculo.

## Impacto

O modal consumia espaço com informações secundárias e não permitia ao atleta auditar sua pontuação. Diferenças vindas de saldos iniciais importados também não eram identificadas na interface.

## Correção

O cabeçalho textual e os painéis de evolução, temporadas, títulos e badges foram removidos do perfil. Permaneceram identidade, radar e resumo da carreira. O endpoint passou a devolver jogos disputados, pagamentos pontuáveis e as regras reais de pontuação; a interface exibe cada fonte como quantidade multiplicada pelo valor configurado e reconcilia eventual diferença com o total oficial como ajuste/importação. Campos novos possuem fallback para permitir deploy independente de frontend e backend sem quebra transitória.

Após a homologação, o header global com logo e menu também foi ocultado enquanto qualquer perfil estiver aberto, tanto o próprio quanto o de outro atleta. Ao fechar o modal, a navegação global volta a ser renderizada normalmente.

A memória de cálculo deixou de ocupar permanentemente uma box própria. Ela agora fica em um dropdown nativo dentro do Resumo da carreira: fechado exibe somente o comando compacto e o total; ao tocar ou clicar, apresenta as parcelas alinhadas sem outro card ou contorno externo.

Na revisão seguinte, a grade com pontos, presenças, gols, assistências, vitórias e cartões e o título `Resumo da carreira` foram removidos. O terceiro bloco do perfil agora contém exclusivamente `Ver composição dos pontos`, mantendo o detalhamento sob demanda e reduzindo a altura ocupada.

## Prevenção

Totais derivados exibidos ao usuário devem vir acompanhados de memória de cálculo baseada nos mesmos dados autoritativos. Interfaces de perfil mobile devem manter apenas informações acionáveis e evitar repetir navegação ou painéis históricos sem demanda operacional.