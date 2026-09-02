# RCA000000000042 - Usuários mobile com colunas e resumo excessivos

## Sintoma

A tela de Usuários exigia rolagem horizontal e exibia informações secundárias na tabela, incluindo e-mail, perfil e retorno operacional. Os cinco indicadores superiores não respeitavam a hierarquia desejada de três itens na primeira linha e dois na segunda.

## Causa raiz

A tabela compartilhada possuía sete colunas e mantinha largura mínima de 920px no mobile. O resumo usava cinco colunas no desktop e era sobrescrito para uma única coluna em regras responsivas genéricas.

## Impacto

Posição, status e ações ficavam afastados do nome e podiam sair da área visível. A coluna de retorno ocupava espaço permanente para mensagens eventuais, e o resumo não priorizava cadastrados, ativos e atletas.

## Correção

Exibir somente nome abreviado, posição, status e ações. Remover e-mail, perfil e retorno da tabela, mantendo mensagens de ações nos fluxos existentes. No mobile, usar tabela fixa em 100% sem rolagem lateral. Organizar o resumo em uma grade de seis partes: cadastrados, ativos e atletas ocupam duas partes cada; coordenadores e administradores ocupam três partes cada na segunda linha.

## Prevenção

Tabelas operacionais mobile devem mostrar apenas os dados necessários para identificar e agir. Indicadores devem possuir uma grade explícita em vez de depender de overrides genéricos.