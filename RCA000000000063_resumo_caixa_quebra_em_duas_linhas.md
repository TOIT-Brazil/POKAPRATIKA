# RCA000000000063 - Resumo do Caixa quebra em duas linhas

## Sintoma

No mobile, Receitas e Despesas ocupavam a primeira linha do resumo, enquanto Saldo do caixa era deslocado para uma segunda linha.

## Causa raiz

O breakpoint compartilhado do painel financeiro definia duas colunas para qualquer resumo, sem distinguir Gestão financeira da página Caixa do grupo, que possui exatamente três indicadores compactos.

## Impacto

O resumo consumia altura desnecessária e enfraquecia a leitura conjunta das entradas, saídas e saldo.

## Correção

Aplicar ao modo `cash-page` uma grade mobile de três colunas iguais, com espaçamento horizontal compacto e texto centralizado. A Gestão financeira preserva sua grade própria.

## Prevenção

Layouts responsivos de componentes compartilhados devem considerar a quantidade e o significado dos itens de cada modo.
