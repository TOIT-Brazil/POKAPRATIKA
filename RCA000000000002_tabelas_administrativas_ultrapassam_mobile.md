[2026-08-26 12:58] | RCA criada | Estouro horizontal das tabelas administrativas no mobile corrigido | [frontend/src/styles.css](frontend/src/styles.css) | Validar navegação horizontal das tabelas em dispositivo real

# Sintoma
Nas telas `Prêmios`, `Usuários` e `Config.`, as tabelas administrativas ultrapassavam a largura da viewport mobile e expandiam os cards e a página para além do limite visível.

# Causa raiz
As tabelas mantêm uma largura mínima maior que a viewport para preservar a legibilidade das colunas e permitir rolagem horizontal. Porém, a coluna principal da `.shell`, os stacks administrativos e seus cards não redefiniam o mínimo intrínseco dos grid items com `min-width: 0`. Como resultado, a largura mínima da tabela era propagada aos elementos ancestrais e aumentava a largura total da página.

# Impacto
Conteúdo cortado, navegação horizontal da página inteira e dificuldade para acessar campos e ações nas telas administrativas em celulares.

# Origem
Os breakpoints mobile tornaram os wrappers das tabelas roláveis, mas não limitaram explicitamente a largura dos grid items e cards que os contêm.

# Correção aplicada
No breakpoint de até `820px`, a `.shell` passou a usar uma coluna `minmax(0, 1fr)` e largura máxima de `100vw`. Stacks, cards e seções administrativas receberam `min-width: 0` e `max-width: 100%`. Os wrappers de tabela receberam largura limitada a `100%` e mantiveram a rolagem horizontal interna com contenção de overscroll.

# Prevenção
Qualquer tabela responsiva com largura mínima superior à viewport deve ficar dentro de uma cadeia de grid/flex items com `min-width: 0`, além de um wrapper limitado a `max-width: 100%` e responsável pela rolagem horizontal.