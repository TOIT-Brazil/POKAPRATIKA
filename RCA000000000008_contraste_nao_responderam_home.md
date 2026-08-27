# RCA000000000008 - Baixo contraste em Não responderam na home

## Sintoma

O indicador `Não responderam` da tela inicial apresentava fundo amarelo claro junto de texto percebido como branco, dificultando a leitura.

## Causa raiz

Os textos dos indicadores do próximo jogo recebem branco por uma regra compartilhada. A variante `pending` usava amarelo luminoso e dependia de sobrescritas separadas para recuperar texto escuro, criando uma combinação frágil na cascata responsiva e com contraste insuficiente quando o branco prevalecia.

## Impacto

- Leitura difícil da quantidade e do rótulo em desktop e mobile.
- Menor acessibilidade visual em um dado operacional importante para a confirmação do jogo.

## Origem

A cor semântica amarela foi aplicada com luminosidade adequada para destaque decorativo, mas sem considerar a cor branca herdada pelo conteúdo dos indicadores.

## Correção

Substituir o amarelo claro por âmbar escuro e definir explicitamente texto branco para o indicador e seu valor, mantendo a identidade visual de pendência com contraste superior.

## Prevenção

Variantes semânticas dos indicadores devem definir fundo e primeiro plano no mesmo seletor e preservar contraste legível em todos os breakpoints.