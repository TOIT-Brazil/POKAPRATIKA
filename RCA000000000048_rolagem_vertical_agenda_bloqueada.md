# RCA000000000048 - Rolagem vertical da Agenda bloqueada

## Sintoma

A página Agenda exibia os primeiros agendamentos, mas a barra de rolagem não permitia alcançar todas as linhas da tabela.

## Causa raiz

O override final do wrapper da tabela combinava `overflow-x: auto` com `overflow-y: hidden`. Pelas regras de cálculo de `overflow` do CSS, essa combinação mantinha o wrapper como contêiner de recorte e impedia que toda a altura da tabela contribuísse corretamente para a rolagem vertical do documento.

## Impacto

Agendamentos existentes abaixo da área visível ficavam inacessíveis, impedindo consulta, edição e abertura dos detalhes desses jogos.

## Correção

O wrapper da tabela passou a manter os dois eixos com `overflow: visible`. A tabela continua sem barra lateral porque já usa largura de 100%, layout fixo e contenção das células; agora ela cresce de acordo com todas as linhas e transfere a rolagem vertical para a página, enquanto o header global permanece sticky.

## Prevenção

Tabelas que devem crescer junto com o documento não devem combinar um eixo rolável com o outro eixo oculto. Quando a largura já é responsiva e a rolagem horizontal é indesejada, manter o wrapper fora do contexto de rolagem e conter a largura na própria tabela e em suas células.