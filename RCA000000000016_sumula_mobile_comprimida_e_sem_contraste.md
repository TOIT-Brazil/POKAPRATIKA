# RCA000000000016 - Súmula mobile comprimida e sem contraste

## Sintoma

No celular, a súmula apresenta nomes quase invisíveis, elencos espremidos em duas metades estreitas e jogadores sobrepostos no campo. A tela fica difícil de ler e operar.

## Causa raiz

- O breakpoint de até `820px` mantém Time A e Time B lado a lado, atribuindo aproximadamente metade da largura útil a cada elenco.
- Seletores claros antigos da súmula possuem maior especificidade que a camada final do tema escuro. Títulos, nomes, placar e rótulos continuam com cores escuras sobre superfícies também escuras.
- O campo mobile reduz a altura para `240px`, mas preserva peças, nomes e coordenadas dimensionados para a composição desktop, aumentando colisões visuais.

## Impacto

- Nomes, cabeçalhos e placar sem contraste suficiente.
- Linhas de atletas estreitas e truncadas.
- Sobreposição de peças e nomes no campo.
- Maior risco de toque ou lançamento de evento no atleta errado.

## Origem

A composição mobile anterior foi criada ainda sobre superfícies claras. A migração posterior para o tema escuro neutralizou fundos genéricos, mas não todos os seletores específicos da súmula nem sua geometria de meia largura.

## Correção

- Empilhar os dois elencos em painéis de largura total no mobile.
- Distribuir titulares e reservas em duas colunas internas compactas quando houver espaço.
- Aplicar contraste explícito aos textos e superfícies da súmula com seletores proprietários.
- Aumentar a altura estável do campo mobile e reduzir peças/rótulos para evitar colisões.

## Prevenção

Validar a súmula em viewport mobile real após mudanças globais de tema e evitar que componentes operacionais densos compartilhem meia largura abaixo de `820px`.