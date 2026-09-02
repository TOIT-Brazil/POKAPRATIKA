# RCA000000000047 - Agenda extensa e jogos duplicados

## Sintoma

A tabela da Agenda expunha Data, Jogo, Horário, Confirmação, Janela, Presenças e Ações, exigindo rolagem lateral e exibindo informações extensas permanentemente. Alguns horários apareciam mais de uma vez como jogos distintos.

## Causa raiz

A interface não usava divulgação progressiva para os detalhes do agendamento. No backend, a geração recorrente executava uma consulta de existência seguida por `INSERT`, sem lock transacional por data/horário; requisições concorrentes podiam passar pela consulta simultaneamente. O cadastro manual e a edição não validavam conflito de horário.

## Impacto

A Agenda ficava difícil de consultar no mobile e registros repetidos podiam gerar convites, confirmações e operações paralelas para o mesmo horário.

## Correção

Exibir uma linha por temporada, data e horário, com somente Data/Horário, Jogo, Status e Ações. Ao clicar no agendamento, abrir modal compacto com equipes, origem, janela, presenças e comandos operacionais. Quando já existirem duplicatas, o modal deve informar a quantidade e listar os registros para revisão, sem exclusão automática.

No backend, serializar criação manual e recorrente com advisory lock transacional por temporada/data/horário e rejeitar conflito antes do `INSERT`. A edição deve bloquear e validar o novo horário, excluindo o próprio registro da consulta.

## Prevenção

Toda escrita de agenda deve usar a mesma identidade de horário e validação transacional. Informações secundárias devem permanecer no modal de detalhes para evitar novas colunas e rolagem lateral.