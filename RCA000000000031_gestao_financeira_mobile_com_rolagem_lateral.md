# RCA000000000031 - Gestão financeira mobile com rolagem lateral

## Sintoma

A página Mensalidades mantinha textos introdutórios redundantes, o resumo financeiro era exibido com um indicador por linha no mobile e as tabelas exigiam rolagem horizontal. O nome completo dos atletas ampliava ainda mais a primeira coluna.

## Causa raiz

As regras responsivas forçavam larguras mínimas de `960px` na tabela principal, `820px` na subtabela e `760px` no caixa. O resumo superior era sobrescrito para uma única coluna. Os nomes eram exibidos integralmente e o indicador `Pontos antecipados` ocupava espaço no resumo operacional.

## Impacto

- Navegação lateral para consultar dados financeiros no celular.
- Baixa densidade de informação no resumo.
- Cabeçalho mais carregado que o necessário.

## Correção

Renomear a área para Gestão financeira, remover os dois subtítulos e o indicador superior de pontos antecipados, abreviar atletas para primeiro nome e inicial do sobrenome, organizar o resumo em duas colunas e compactar as tabelas em `100%` da largura mobile.

## Prevenção

Tabelas operacionais mobile devem usar regras específicas posteriores aos mínimos genéricos, com abreviação visual e quebra controlada de conteúdo.