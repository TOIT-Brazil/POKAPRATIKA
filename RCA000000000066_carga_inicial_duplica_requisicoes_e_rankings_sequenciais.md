# RCA000000000066 - Carga inicial duplica requisições e rankings sequenciais

## Sintoma

Após autenticar ou recarregar a aplicação, os dados demoravam para aparecer mesmo quando cada conjunto retornava pouco conteúdo.

## Causa raiz

A carga inicial buscava classificação, rankings e partidas depois de descobrir a temporada ativa. Ao gravar `activeSeasonId`, o efeito de troca de temporada executava imediatamente e repetia as mesmas três requisições. No backend, o endpoint de rankings ainda aguardava quatro consultas independentes ao PostgreSQL em sequência.

## Impacto

Cada abertura autenticada gerava tráfego e processamento duplicados. A resposta de rankings acumulava quatro tempos de consulta ao banco antes de liberar a carga completa do frontend.

## Correção

Marcar a temporada já carregada pela inicialização e consumir essa marca uma única vez no efeito de troca, evitando a segunda rodada de requisições. Executar gols, assistências, presença e cartões em paralelo no endpoint de rankings.

## Prevenção

Efeitos derivados de estado preenchido por uma carga devem distinguir inicialização de ação do usuário. Consultas independentes do mesmo endpoint devem ser paralelizadas quando não compartilham transação ou dependência de resultado.
