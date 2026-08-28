# RCA000000000017 - Modal da súmula e rolagem da Agenda

## Sintoma

- O modal `Súmula Inteligente` ocupa área excessiva e deixa muito espaço entre o cabeçalho, `Detalhes do Jogo` e as ações `Cancelar`/`Próximo` ou `Voltar`/salvar.
- Na Agenda, não é possível alcançar todos os registros e colunas da tabela por rolagem vertical e horizontal.

## Causa raiz

- O modal mantém largura de até `980px`, espaçamentos distribuídos entre cabeçalho, conteúdo e rodapé e transforma o rodapé em coluna já abaixo de `980px`, aumentando desnecessariamente sua altura.
- O wrapper da Agenda define `overflow: auto`, mas um override responsivo posterior inclui `.schedule-table-wrap` em uma regra com `max-height: none !important` e `overflow: visible !important`, removendo a área rolável vertical.

## Impacto

- Fluxo de criação visualmente disperso e com ações distantes do conteúdo relacionado.
- Parte das linhas e colunas da Agenda fica inacessível em viewports menores.

## Correção

- Reduzir largura, paddings e gaps do modal e limitar sua altura com rolagem interna somente quando necessária.
- Manter o rodapé em linha até telas estreitas, aproximando ações e texto auxiliar do formulário.
- Dar à página Agenda uma área flexível limitada e aplicar `overflow: scroll !important` ao wrapper da tabela, com barras vertical e horizontal sempre disponíveis.

## Prevenção

Componentes que precisam de rolagem própria devem possuir regra final específica após overrides globais responsivos. Modais de fluxo curto devem usar largura e altura determinadas pelo conteúdo, não dimensões de telas operacionais extensas.

## Resultado

- O modal passou de `980px` para até `760px`, usa altura do conteúdo com limite da viewport e possui paddings/gaps menores no cabeçalho, card e rodapé.
- O rodapé permanece horizontal até `560px`; abaixo disso, empilha os controles para preservar a largura dos botões.
- A Agenda ocupa a altura útil da shell em duas linhas (`cabeçalho` e `tabela`) e impede rolagem concorrente da página.
- O wrapper da tabela usa rolagem vertical e horizontal explícita, barras de `12px`, gutter estável e altura máxima responsiva.
- Typecheck, build de produção e diagnósticos do frontend concluídos sem erros.