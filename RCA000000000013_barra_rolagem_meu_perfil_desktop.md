# RCA 000000000013 - Barra de rolagem no Meu perfil desktop

## Sintoma

O modal Meu perfil apresenta barra de rolagem no desktop mesmo havendo largura disponível para organizar o conteúdo sem empilhamento vertical.

## Causa raiz

`.athlete-profile-modal-card` mantém largura máxima de `440px`, dimensão adequada ao mobile, e herda de `.profile-modal-card` o limite de altura com `overflow: auto`. As seções de identidade, histórico, títulos e resumo ficam todas empilhadas, excedem o limite vertical e ativam a barra.

## Impacto

No desktop, a consulta do perfil exige rolagem desnecessária e não aproveita a área horizontal disponível.

## Origem

O perfil foi desenhado inicialmente com composição mobile e a mesma geometria foi mantida no breakpoint desktop.

## Correção

No desktop, ampliar exclusivamente o card de perfil do atleta e reorganizar `.athlete-profile-sheet` em grade: identidade na coluna esquerda, histórico ocupando a área superior direita e títulos/resumo lado a lado abaixo. Remover o limite de altura e o overflow do card somente nesse breakpoint.

O comportamento mobile permanece com largura total e rolagem de proteção para telas baixas.

## Prevenção

Componentes modais ricos devem definir composições distintas por viewport. A versão desktop deve usar largura horizontal antes de recorrer a rolagem vertical; o mobile pode preservar overflow contido para garantir acesso integral.
