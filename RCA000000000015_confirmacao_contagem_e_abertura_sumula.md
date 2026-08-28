# RCA000000000015 - Confirmação, contagem e abertura da súmula

## Sintoma

- O backend identifica quando um atleta convocado precisa confirmar presença, mas a interface não apresenta esse chamado automaticamente.
- A contagem regressiva do próximo jogo aparenta parar e voltar a funcionar em momentos diferentes.
- Depois do sorteio, a súmula operacional não abre automaticamente quando falta uma hora para a partida.

## Causa raiz

- O endpoint `GET /matches/confirmation-prompt` existe e aplica usuário, convocação, temporada e janela de confirmação, porém não é consumido pelo frontend.
- O texto da contagem usa `Date.now()` durante a renderização, mas não existe um estado atualizado a cada segundo para provocar novas renderizações. O valor muda apenas quando outro polling ou interação atualiza o componente.
- O frontend abre o board operacional somente por ações manuais ou pelo histórico do último jogo; não há gatilho temporal associado ao início agendado nem validação de que os times já foram sorteados.

## Impacto

- Atletas podem não perceber que a confirmação foi aberta.
- A contagem exibida pode permanecer visualmente congelada por até o próximo reload periódico.
- A coordenação perde parte da janela de preparação da escalação e precisa localizar a partida manualmente.

## Origem

Os agendamentos e o endpoint de confirmação foram evoluídos no backend sem a integração equivalente do prompt global. A contagem e a abertura do board permaneceram dependentes de renderizações e ações incidentais.

## Correção

- Consumir o prompt de confirmação no frontend e permitir que o próprio atleta convocado responda no modal compartilhado de presença.
- Manter um relógio de interface com atualização por segundo e usá-lo na contagem e nas decisões temporais locais.
- Para `ADMIN` e `COORDENADOR`, abrir uma vez o board da partida em rascunho quando entrar na janela de uma hora antes, desde que os times A e B tenham jogadores sorteados.

## Prevenção

Centralizar decisões temporais em funções que recebem o instante atual explicitamente e validar novos gatilhos agendados nos limites anterior, exato e posterior da janela.

## Resultado

- A home mantém um pulso por segundo, atualizando continuamente a contagem regressiva e a seleção do próximo jogo.
- O atleta convocado recebe o modal de confirmação enquanto não houver respondido; a gravação continua restrita ao próprio usuário autenticado no backend.
- A súmula sorteada abre automaticamente para `ADMIN` e `COORDENADOR` a partir de 60 minutos antes do início.
- O fechamento voluntário do board impede reabertura automática repetitiva e disponibiliza a ação manual `Reabrir súmula` durante a mesma janela.