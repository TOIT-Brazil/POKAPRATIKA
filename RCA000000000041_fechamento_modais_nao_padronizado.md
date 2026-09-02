# RCA000000000041 - Fechamento de modais não padronizado

## Sintoma

Alguns modais declaravam o texto `Fechar`, outros exibiam `X` e outros dependiam de um botão vazio estilizado. A regra visual genérica podia ainda produzir um segundo `X` ou transformar qualquer ação `.ghost` do cabeçalho em fechamento.

## Causa raiz

O CSS aplicava aparência de fechar a todo `.ghost` dentro de `.card-head`, sem exigir uma classe semântica exclusiva. O JSX evoluiu com diferentes padrões de conteúdo e acessibilidade.

## Impacto

Os modais não possuíam uma interação visual uniforme e novas ações de cabeçalho corriam risco de aparecer incorretamente como `X`.

## Correção

Padronizar `.modal-close-button` e os controles legados posicionados como fechamento no cabeçalho para ocultar seu conteúdo visual e renderizar um único `X` pelo CSS. A regra final usa `font-size: 0 !important`, impedindo que `Fechar`, um `X` explícito ou um botão vazio apareçam junto ao pseudo-elemento. Os nomes acessíveis e `aria-label` existentes são preservados.

## Prevenção

Todo novo modal deve usar `.modal-close-button`, manter nome acessível e não criar ícone adicional no mesmo botão.