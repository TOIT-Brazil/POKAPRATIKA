# RCA000000000032 - Nome sobrepõe pontos na tabela da temporada

## Sintoma

Em alguns atletas com primeiro nome longo, o texto avançava sobre a coluna `PTS`, fazendo nome e pontuação aparecerem um sobre o outro no mobile.

## Causa raiz

A célula de atleta tinha largura fixa de `96px`, mas o botão reutilizava a regra global `.name-link.strong` com fonte de `1rem` e sem contenção de overflow. O conteúdo podia ultrapassar os limites da célula.

## Impacto

- Pontuação parcialmente coberta pelo nome.
- Leitura incorreta da classificação.
- Layout inconsistente entre nomes curtos e longos.

## Correção

Conter o botão na largura da célula, usar a fonte compacta da tabela e aplicar truncamento com reticências. O nome completo permanece disponível no atributo `title`.

## Prevenção

Conteúdo clicável dentro de colunas fixas deve herdar a largura e a tipografia da célula e declarar comportamento explícito de overflow.