# RCA000000000070 - Quantidade de jogadores de linha fixa no sorteio

## Sintoma

O cadastro de jogo não perguntava quantos jogadores de linha participariam. Todo pré-jogo exigia 20 pessoas e o sorteio selecionava 20 independentemente do formato da partida.

## Causa raiz

A capacidade estava fixada em 20 no frontend, nos schemas do backend, na função de ativação do pré-jogo, no algoritmo de sorteio e em uma constraint da migration 19. O algoritmo também selecionava participantes antes de reservar explicitamente dois goleiros, usando jogador de linha como fallback quando faltava goleiro.

## Impacto

Partidas com formatos diferentes não conseguiam representar a quantidade real de jogadores por lado. Também não havia garantia autoritativa de um goleiro em cada time.

## Correção

Perguntar no cadastro a quantidade total de jogadores de linha, exigindo valor par. Persistir em `player_capacity` o total de participantes selecionados, calculado como linhas mais dois goleiros. No sorteio, exigir dois goleiros confirmados, selecionar exatamente a quantidade configurada de linhas, distribuir metade das linhas e um goleiro para cada time e manter excedentes como reservas. Exibir o total configurado no contador do próximo jogo.

## Prevenção

Regras de composição da partida devem ser dados persistidos por jogo e validados no backend. A interface deve distinguir jogadores de linha, goleiros e total antes de salvar.
