# RCA000000000039 - Central de prêmios tabular e salvamento global

## Sintoma

A Central de Prêmios dependia do botão `Salvar central`, exibia regras em uma tabela extensa e mantinha campos grandes para uma operação compacta. Para editar uma regra, era necessário localizar seu controle entre muitas colunas.

## Causa raiz

Criação e edição alteravam apenas o estado local; a persistência ficava concentrada em uma ação global posterior. A configuração completa de cada regra foi distribuída horizontalmente em 12 colunas, incluindo `Tipo` e `Dica` como informações permanentes.

## Impacto

O fluxo permitia esquecer o salvamento final e desperdiçava espaço, principalmente no mobile. A leitura das regras existentes era menos direta do que uma lista de itens acionáveis.

## Correção

Persistir imediatamente ao adicionar ou editar uma regra. Substituir a tabela por uma lista compacta de regras clicáveis e abrir a configuração de cada item em modal. Remover `Tipo` e `Dica` da interface principal, preservar o tipo já gravado em regras existentes e criar novas regras como ranking automático.

## Prevenção

Configurações independentes devem salvar no próprio fluxo de confirmação. Dados avançados devem aparecer sob demanda em modal, mantendo a tela principal focada em identificação e estado.