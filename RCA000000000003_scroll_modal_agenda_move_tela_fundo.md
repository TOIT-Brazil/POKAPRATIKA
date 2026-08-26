[2026-08-26 13:26] | RCA criada | Scroll da Agenda e encadeamento para a página de fundo corrigidos | [frontend/src/styles.css](frontend/src/styles.css) | Validar roda do mouse e gesto touch nos limites dos modais

# Sintoma
O modal da Agenda não apresentava uma rolagem vertical clara para acessar todas as informações. Ao chegar ao limite de rolagem de um modal, a roda do mouse ou o gesto touch podia continuar movimentando a página que estava ao fundo.

# Causa raiz
O card da Agenda usava `overflow: hidden`, inclusive em um override específico do breakpoint mobile. Além disso, os overlays globais não declaravam contenção de overscroll e a página não era bloqueada enquanto um elemento `.modal` estivesse aberto.

# Impacto
Campos e registros da Agenda podiam ficar inacessíveis em viewports menores, e o scroll encadeado alterava a posição da página de fundo durante o uso de modais em todo o site.

# Origem
A Agenda foi transformada em modal fullscreen com foco inicial na rolagem da tabela, mas o card externo permaneceu bloqueado. Os demais modais dependiam apenas de `overflow: auto`, sem uma política global contra scroll chaining.

# Correção aplicada
O modal da Agenda passou a ter rolagem vertical própria, barra visível e estilizada, gutter estável e contenção de overscroll no desktop e no mobile. A tabela interna continua rolável. Globalmente, `html` e `body` são bloqueados enquanto existir `.modal`, e overlays/cards usam `overscroll-behavior` para impedir que o movimento chegue à página de fundo.

# Prevenção
Novos modais devem usar a classe global `.modal`, definir uma superfície interna rolável quando o conteúdo puder exceder a viewport e preservar `overscroll-behavior: contain` no overlay e no card.