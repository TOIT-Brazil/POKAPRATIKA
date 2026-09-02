# RCA000000000038 - Tabela de prêmios mobile e criação inline

## Sintoma

A Central de regras e premiações exibia 12 colunas no mobile, empurrando informações principais para fora da área visível. O formulário de criação ocupava permanentemente uma linha acima da tabela.

## Causa raiz

A tabela herdava `min-width: 1180px` e não possuía uma seleção responsiva de colunas prioritárias. O fluxo de nova regra foi implementado como grade inline, mesmo sendo uma ação eventual.

## Impacto

No celular, regra, tipo, métrica e status ficavam separados por diversos parâmetros secundários, exigindo rolagem horizontal extensa. O formulário inline reduzia a altura disponível para consultar regras.

## Correção

No mobile, manter visíveis `Regra`, `Tipo`, `Métrica/Votação` e `Status`, distribuídas dentro de 100% da largura. Mover a criação de regra para um modal próprio, preservando a ação `Salvar central` para persistir alterações nas regras existentes.

## Prevenção

Tabelas administrativas mobile devem priorizar identificação, tipo, regra de cálculo e estado. Formulários eventuais devem abrir sob demanda sem ocupar permanentemente a área de consulta.