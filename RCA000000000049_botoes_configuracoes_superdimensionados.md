# RCA000000000049 - Botões de Configurações superdimensionados

## Sintoma

As ações principais da página Configurações eram exibidas como cards largos e altos, destoando dos botões compactos usados nas demais áreas e consumindo espaço excessivo, principalmente no mobile.

## Causa raiz

As quatro ações reutilizavam simultaneamente as classes globais `row-card` e `as-button`. Além da largura de 100% aplicada por `as-button`, a grade administrativa impunha altura mínima de 92px e o breakpoint mobile organizava cada card em uma linha inteira.

## Impacto

A página apresentava controles visualmente desproporcionais, aumentava a rolagem necessária e dificultava a leitura rápida das ações administrativas disponíveis.

## Correção

As ações receberam uma classe proprietária compacta e passaram a reutilizar o botão verde primário. A área agora usa uma linha flexível com quebra responsiva, altura curta e largura definida pelo rótulo. Os mesmos modais, handlers, permissões e bloqueio da importação sem temporada ativa foram preservados.

## Prevenção

Ações de comando devem usar classes de botão; `row-card` deve permanecer reservado a itens que realmente exibem conteúdo estruturado em formato de card. Estilos administrativos específicos não devem alterar componentes globais compartilhados.