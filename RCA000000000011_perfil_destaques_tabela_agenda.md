# RCA 000000000011 - Perfil nos destaques e tabela da Agenda

## Sintoma

- Os cards Artilheiro, Assistências, Aproveitamento e Mais cartões exibem o atleta, mas não abrem seu perfil ao clicar.
- Após a Agenda deixar de ser modal e passar a ser página, sua tabela pode não aparecer e mantém uma barra de rolagem azul divergente da paleta oficial.

## Causa raiz

- `DashboardMatchesPanel` não recebe o callback de abertura de perfil. Os itens de destaque também descartam o `userId` disponível nos rankings e são renderizados como `article`, sem ação.
- A tabela da Agenda preservou regras criadas para o antigo modal: `flex: 1 1 0`, rolagem dependente da altura do pai e overrides responsivos genéricos que alternam o wrapper para `overflow: visible`. Na página, essa combinação conflita com o `overflow: hidden` do card e não garante uma área visível e rolável.
- O scrollbar azul está hardcoded em `scrollbar-color` e `::-webkit-scrollbar-thumb` no wrapper da Agenda.

## Impacto

- O acesso ao perfil a partir dos principais indicadores da home exige navegação indireta.
- Coordenadores podem perder acesso visual à listagem e às ações da Agenda.
- A barra azul quebra o padrão visual verde e neutro do projeto.

## Origem

A ausência de ação nos destaques é anterior. A regressão da Agenda surgiu na conversão do modal fullscreen para página, quando estilos dependentes do container modal foram reutilizados no novo fluxo.

## Correção

- Propagar `onOpenProfile` do `App` para `DashboardMatchesPanel`.
- Preservar `userId` nos quatro destaques e renderizá-los como botões acessíveis.
- Tornar o wrapper da tabela da Agenda independente da altura modal, com altura mínima e rolagem horizontal/vertical contida na página.
- Substituir o scrollbar azul por cores neutras da paleta oficial.

## Prevenção

Ao converter modal em página, remover regras de dimensionamento dependentes da viewport/pai e validar explicitamente estados com tabela vazia, tabela larga, desktop e mobile. Componentes visuais clicáveis devem usar elemento `button` e manter o identificador da entidade exibida.
