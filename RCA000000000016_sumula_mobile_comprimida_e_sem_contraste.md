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

- Manter Time A à esquerda e Time B à direita no mobile, separados por um divisor central visível.
- Usar uma coluna interna compacta em cada metade para preservar a ordem e a leitura dos atletas.
- Aplicar contraste explícito aos textos e superfícies da súmula com seletores proprietários.
- Aumentar a altura estável do campo mobile e reduzir peças/rótulos para evitar colisões.
- Ampliar fonte e contraste do log operacional.
- Diferenciar os uniformes no campo por time e função.

## Prevenção

Validar a súmula em viewport mobile real após mudanças globais de tema e preservar contraste, divisor e largura mínima legível na composição simétrica dos dois times.

## Resultado

- Time A permanece à esquerda e Time B à direita, separados por uma linha central durante toda a escalação mobile.
- Cada equipe usa uma coluna interna compacta dentro de sua metade, com alinhamento próprio para reforçar os lados.
- Cabeçalho, placar, nomes, rótulos e log receberam contraste explícito dentro da súmula.
- O log passou a usar registros de `0.82rem`, descrição de `0.8rem` quase branca e horário verde claro.
- O campo mobile passou de `240px` para `340px`, com peças e nomes menores para reduzir sobreposição.
- Jogadores de linha do Time A usam uniforme branco e os do Time B vermelho; goleiros usam ciano no Time A e laranja no Time B.
- Typecheck e build de produção do frontend concluídos sem erros. A inspeção visual automatizada não foi concluída porque o navegador integrado encerrou a página local protegida pela ausência de `VITE_API_URL` e também a aba neutra usada para o cenário isolado.