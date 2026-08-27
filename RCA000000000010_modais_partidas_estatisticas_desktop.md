# RCA000000000010 - Modais Partidas e Estatísticas limitados no desktop

## Sintoma

Os modais `Partidas da temporada` e `Estatísticas da temporada` exibiam fundo divergente do padrão visual do projeto e ocupavam apenas uma região central, próxima de metade da tela em viewports desktop.

## Causa raiz

O card compartilhado desses modais estava limitado a `960px` de largura e possuía apenas altura máxima, sem altura própria. Além disso, o card principal e os cards internos herdavam fundos azul-marinho translúcidos do tema global `.card`.

## Impacto

- Desperdício de espaço útil em desktop.
- Menor área para histórico e classificação.
- Aparência divergente do fundo preto solicitado para essas consultas.

## Origem

Os overlays foram criados inicialmente como visualizações dedicadas para celular e depois reutilizados pelo menu em desktop sem sobrescrever suas dimensões e cores.

## Correção

- Expandir o card para praticamente toda a viewport no desktop.
- Definir altura útil explícita e manter rolagem no corpo interno.
- Aplicar ao overlay, card principal e cards internos os mesmos tokens e superfícies claras dos demais modais do projeto.
- Preservar o comportamento fullscreen já existente no mobile.

## Prevenção

Modais acessíveis em desktop e mobile devem definir dimensões para ambos os contextos e não depender do fundo genérico de `.card` quando a identidade visual for específica.