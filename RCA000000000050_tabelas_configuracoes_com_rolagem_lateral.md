# RCA000000000050 - Tabelas de Configurações com rolagem lateral

## Sintoma

As tabelas de Temporadas e Pontuação na página Configurações exibiam barra de rolagem lateral no mobile. A tabela de temporadas mantinha informações e ações demais na visualização principal, enquanto a ação de importar Excel permanecia disponível sem necessidade operacional nessa tela.

## Causa raiz

As duas tabelas herdavam `min-width: 1180px` do componente administrativo compartilhado. Temporadas ainda definia mínimos individuais que somavam aproximadamente 940px em seis colunas, e Pontuação apresentava uma coluna técnica de código além do nome e dos pontos.

## Impacto

O operador precisava deslocar horizontalmente para consultar e agir sobre dados simples, prejudicando leitura, navegação e operação em telas estreitas.

## Correção

A ação Importar Excel foi removida da área de Configurações. Pontuação passou a exibir somente nome e pontos. Temporadas exibe somente nome, ano e status; o clique ou acionamento por teclado em uma linha abre um modal com período, votação, status e ação operacional aplicável. As duas tabelas usam largura de 100%, layout fixo, colunas responsivas e nenhuma largura mínima.

Após a primeira homologação, o modal de Pontuação ainda mantinha a geometria compartilhada `wide`, chegando a 980px e afastando visualmente as duas colunas. O modal passou a ter até 460px, a coluna Pontos foi fixada em 92px e seu campo em 72px, ambos centralizados no mesmo eixo do cabeçalho. O wrapper também oculta overflow horizontal exclusivamente nesse fluxo.

## Prevenção

Tabelas administrativas mobile devem apresentar somente os campos necessários para comparação imediata. Informações secundárias e ações contextuais devem ficar em detalhes acionados pela linha, com estilos proprietários que neutralizem mínimos globais incompatíveis.