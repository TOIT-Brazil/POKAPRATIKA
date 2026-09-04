# RCA000000000061 - Despesas ocultas no Caixa separado

## Sintoma

A página Caixa do grupo mostrava Receitas e Saldo do caixa, mas não mostrava o container Despesas.

## Causa raiz

Antes da separação entre Gestão financeira e Caixa, uma regra CSS ocultava o segundo card do resumo combinado para retirar o indicador Aberto. Após a criação da página própria de Caixa, Despesas passou a ocupar a segunda posição e herdou essa ocultação por `nth-child(2)`.

## Impacto

O total de despesas continuava correto no backend e no ledger, porém deixou de ficar visível no resumo da página.

## Correção

Identificar o modo da página por classe e restringir a ocultação do segundo card exclusivamente à Gestão financeira. Caixa do grupo mantém visíveis seus três containers oficiais: Receitas, Despesas e Saldo do caixa.

## Prevenção

Regras posicionais de componentes compartilhados devem ser condicionadas ao modo semântico da página, evitando que mudanças de ordem alterem o significado visual.
