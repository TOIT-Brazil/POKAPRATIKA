# RCA000000000007 - X duplicado no modal Criar jogo mobile

## Sintoma

No mobile, o modal de criação de jogo apresentava dois símbolos `X` no controle de fechamento.

## Causa raiz

O mesmo botão fornecia o símbolo por duas fontes: o conteúdo textual `X` no JSX e o pseudo-elemento `::before` definido pela regra global `.modal-close-button`. A ocultação do texto dependia da cascata de `font-size: 0`, deixando o controle vulnerável às regras responsivas aplicadas ao botão.

## Impacto

- Duplicação visual do comando de fechar no modal mobile.
- Perda de acabamento e ambiguidade visual em uma ação primária de navegação.

## Origem

O padrão global de estilização foi adicionado sobre botões que já possuíam o caractere de fechamento no conteúdo do componente.

## Correção

Remover o caractere textual do botão específico do modal de criação de jogo e manter uma única representação visual pelo pseudo-elemento, preservando `aria-label` e `title` para acessibilidade.

## Prevenção

Controles `.modal-close-button` devem possuir uma única fonte visual para o ícone. Quando o pseudo-elemento global for utilizado, o JSX não deve repetir o caractere de fechamento.