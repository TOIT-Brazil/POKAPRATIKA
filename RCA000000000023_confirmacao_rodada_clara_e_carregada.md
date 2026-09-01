# RCA000000000023 - Confirmação da rodada clara e carregada

## Sintoma

O modal `Confirmação da rodada` exibia superfícies claras dentro do tema escuro e acumulava textos, status globais, identificação do clube, observação e acesso à edição de escalação, tornando o fluxo visualmente carregado.

## Causa raiz

O componente mantinha cores claras hardcoded da versão anterior (`#fff`, cinzas claros e gradientes claros). A camada final do tema escuro cobria apenas parte dos elementos internos e não tinha autoridade sobre o painel principal e todos os estados dos controles.

## Impacto

- Quebra de consistência com o tema oficial.
- Excesso de informação antes da ação principal de confirmação.
- Checkbox de janta desproporcional ao restante do formulário.
- Ação administrativa de escalação misturada ao fluxo pessoal do atleta.

## Correção

- Aplicar autoridade escura específica ao painel, shell, botões, cards e controle de janta.
- Remover texto explicativo, faixa de status global, identificação `Club no: PlayField` e campo de observação.
- Retirar o editor de escalação dos modais de confirmação.
- Reduzir o checkbox visual de janta de 24px para 18px.

## Prevenção

Componentes inseridos no tema escuro devem usar tokens ou receber um seletor proprietário completo que cubra superfície principal, controles inativos, estados ativos e textos.