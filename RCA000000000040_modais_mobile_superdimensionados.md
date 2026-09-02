# RCA000000000040 - Modais mobile superdimensionados

## Sintoma

No mobile, modais simples ocupavam praticamente a tela inteira e exibiam inputs, botões, espaçamentos e cabeçalhos maiores do que o necessário.

## Causa raiz

O breakpoint global até 820px aplicava `place-items: stretch` ao overlay e forçava `.modal-card`, `.payment-card`, `.profile-modal-card` e outros cards a `width: 100%`, `max-width: none` e altura máxima próxima de `100dvh`. Controles herdavam dimensões globais sem uma escala específica para modais compactos.

## Impacto

Formulários curtos pareciam telas inteiras, sobrava espaço interno e ações simples exigiam mais deslocamento vertical, prejudicando a ergonomia mobile.

## Correção

Centralizar modais comuns, limitar sua largura mobile a 520px ou à viewport com margens, reduzir padding, gaps, inputs e botões e usar grades compactas quando houver pares de campos. Preservar dimensões amplas somente em súmula, criação de jogo e editor de agenda, que possuem fluxos operacionais extensos.

## Prevenção

Não aplicar fullscreen por seletor genérico de modal. Modais compactos e superfícies operacionais amplas devem possuir políticas responsivas separadas.