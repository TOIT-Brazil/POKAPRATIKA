# RCA000000000059 - Gestão financeira e caixa na mesma página

## Sintoma

Mensalidades e caixa do grupo compartilhavam a mesma página, o mesmo cabeçalho, os mesmos indicadores e ações. A navegação não distinguia cobrança de atletas da prestação de contas do caixa.

## Causa raiz

`PaymentsPanel` concentrou progressivamente dois domínios visuais: mensalidades e lançamentos de caixa. Embora os endpoints já fossem separados, a view e o estado de navegação permaneceram únicos.

## Impacto

A página ficou mais densa, misturou ações de geração/baixa de mensalidade com lançamento de receita/despesa e exibiu indicadores sem hierarquia clara.

## Correção

Criar a página ADMIN `Caixa do grupo` no menu e tornar o painel financeiro explícito por modo. Gestão financeira mantém mensalidades e seus controles; Caixa do grupo recebe lançamento, exportação, ledger e somente os indicadores Receita, Despesa e Saldo do caixa. O indicador Pendentes não compõe a nova página.

## Prevenção

Novas funções financeiras devem respeitar a fronteira entre contas a receber de atletas e movimentação do caixa, mesmo quando compartilham helpers de moeda, filtros e componentes de modal.
