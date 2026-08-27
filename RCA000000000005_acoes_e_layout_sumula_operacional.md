# RCA000000000005 - Ações e layout da súmula operacional

## Sintoma

A súmula operacional exibe quatro botões de evento em todas as linhas de atletas, avatares e escudos decorativos, comprimindo nomes e deixando Time A, campo e Time B concorrendo horizontalmente. O cartão azul existe no domínio, mas não está disponível nas ações rápidas e não informa os dois minutos de afastamento.

## Causa raiz

O componente `OpenMatchSheetBoard` foi estruturado em uma arena de três colunas (`Time A | campo | Time B`) e cada `rosterRow` incorporou avatar, posição e ações permanentes. Esse desenho aumenta a largura mínima das listas e duplica comandos para todos os atletas. O tipo de evento registra apenas o minuto inteiro, insuficiente para uma contagem operacional precisa de 120 segundos no rascunho.

## Impacto

- Leitura lenta das escalações em desktop e mobile.
- Nomes truncados por controles repetidos.
- Maior risco de toque acidental em gol ou cartão.
- Cartão azul não pode ser lançado pelo fluxo operacional principal.
- Ausência de indicação confiável do tempo restante fora de campo.

## Origem

Evolução incremental da súmula: ações rápidas, avatares, drag-and-drop e campo foram adicionados no mesmo layout lateral sem reavaliar densidade e hierarquia.

## Correção

- Abrir um menu contextual de eventos ao clicar no atleta.
- Disponibilizar gol, assistência, cartões amarelo, vermelho e azul nesse menu.
- Persistir no rascunho o segundo exato do jogo para cartão azul e exibir contagem regressiva de 2 minutos.
- Remover avatares, posições e escudos das listas, mantendo somente o nome com tipografia maior.
- Posicionar Time A e Time B lado a lado, separados por linha central, com campo e log abaixo.

## Prevenção

Manter comandos secundários sob interação contextual em listas densas e validar novos eventos operacionais em desktop/mobile quanto a persistência, acessibilidade por clique e impacto no cronômetro.

## Refinamento do menu contextual

Na primeira versão, atletas com confirmação pendente aplicavam `opacity` na linha inteira, incluindo o menu filho, deixando-o visualmente transparente. Além disso, o posicionamento por `top` abria o menu abaixo do atleta. A correção restaura opacidade e filtro quando a linha está selecionada, posiciona o menu por `bottom`, usa fundo branco sólido e eleva as camadas da escalação e do item selecionado. As opções disciplinares passaram a usar cartões retangulares amarelo, vermelho e azul com nomes acessíveis e tooltips.
