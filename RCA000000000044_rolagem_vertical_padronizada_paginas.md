# RCA000000000044 - Rolagem vertical inconsistente entre páginas

## Sintoma

As páginas autenticadas não moviam o conteúdo vertical da mesma forma. Gestão financeira permitia rolar o conteúdo mantendo o cabeçalho global no topo, enquanto Home/Temporada, Agenda, Prêmios e Tabela da temporada usavam contenções e barras internas próprias; no mobile, outras páginas transferiam a rolagem para o documento inteiro.

## Causa raiz

A shell recebeu políticas conflitantes ao longo da evolução responsiva: altura automática e `overflow: visible` no mobile, exceções fullscreen para Agenda e Prêmios, contenção exclusiva da Tabela da temporada e rolagem própria em Usuários e Configurações. Não existia uma abstração comum para páginas secundárias.

## Impacto

O gesto de rolagem e a permanência do cabeçalho variavam conforme a página. Algumas telas moviam o documento, outras somente a tabela e outras continham o conteúdo em uma área diferente, reduzindo previsibilidade no desktop e no mobile.

## Correção

Aplicar a política compartilhada a todas as views, incluindo Home/Temporada. Manter a shell limitada a `100dvh`, com o cabeçalho global fora da área rolável, e atribuir ao container raiz de cada página o espaço restante e a rolagem vertical. Remover somente nessas views as exceções que impediam a página de rolar, preservando rolagem horizontal e cabeçalhos das tabelas.

## Prevenção

Novas páginas autenticadas devem usar a política compartilhada da shell secundária. Exceções de tabelas e painéis podem controlar rolagem horizontal, mas não devem devolver a rolagem vertical ao `body` nem substituir o container raiz da página sem requisito operacional documentado.