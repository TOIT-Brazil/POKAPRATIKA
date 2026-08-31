# RCA000000000019 - Baixo contraste no log da súmula

## Sintoma

Os horários e as descrições dos acontecimentos no `Log da súmula` apareciam em tons escuros sobre o fundo verde escuro, dificultando a leitura.

## Causa raiz

As cores desktop do log (`#215a49` para o horário e `#31463c` para a descrição) foram definidas quando o painel ainda usava fundo branco. A camada final do tema escuro alterou o fundo para `#10231f`, mas preservou essas cores de primeiro plano. O contraste claro existente estava restrito ao breakpoint mobile de até `820px`.

## Impacto

- Dificuldade para conferir rapidamente eventos, cartões, gols e assistências.
- Maior risco operacional de lançar novamente ou excluir um acontecimento incorreto.
- Legibilidade divergente entre larguras mobile e desktop.

## Origem

A migração do painel para o tema escuro não atualizou, em todas as larguras, as cores específicas dos elementos internos do log.

## Correção

Definir no seletor proprietário do modal da súmula horário em verde claro e descrição em branco esverdeado para todas as larguras, preservando a hierarquia visual e o fundo atual.

## Prevenção

Alterações de superfície devem validar conjuntamente as cores de todos os primeiros planos específicos do componente em desktop e mobile.