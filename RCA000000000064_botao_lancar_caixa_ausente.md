# RCA000000000064 - Botão Lançar caixa ausente

## Sintoma

A página Caixa do grupo exibia indicadores e lançamentos, mas não apresentava a ação para registrar uma nova receita ou despesa.

## Causa raiz

O modal de lançamento permaneceu implementado e condicionado ao modo Caixa, porém seu botão de abertura foi removido do cabeçalho durante alterações recentes no componente financeiro.

## Impacto

O administrador conseguia consultar o caixa, mas não conseguia abrir o formulário de novo lançamento pela interface.

## Correção

Restaurar o botão `Lançar caixa` exclusivamente no modo `cash`, acionando o modal já existente.

## Prevenção

Ações que controlam modais devem ser validadas junto com a renderização do modal para impedir fluxos implementados, porém inacessíveis.
