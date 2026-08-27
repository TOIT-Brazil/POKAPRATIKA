# RCA000000000006 - Jogador posicionado no campo adversário

## Sintoma

As posições táticas iniciais podiam colocar atletas além da linha central e o arraste manual permitia salvar jogadores do Time A na metade do Time B e vice-versa.

## Causa raiz

O mapa padrão do Time A continha coordenadas horizontais de até 70% e era espelhado para o Time B. A função compartilhada de contenção também aceitava sobreposição entre 44% e 56%, permitindo cruzar a linha central. O backend validava apenas o intervalo geral de 0% a 100%, sem relacionar coordenada e equipe.

## Impacto

- Escalação inicial divergente da formação operacional esperada.
- Jogadores dos dois times podiam ocupar a mesma metade.
- Coordenadas inválidas podiam ser persistidas e reaparecer após refresh.

## Origem

O posicionamento manual foi implementado com limites gerais do campo e slots ofensivos compartilhados, sem invariável explícita de metade por equipe.

## Correção

- Substituir o mapa padrão por corredores progressivos na metade da própria equipe.
- Limitar Time A ao intervalo horizontal de 8% a 47%.
- Limitar Time B ao intervalo horizontal de 53% a 92%.
- Normalizar coordenadas legadas antes do autosave.
- Rejeitar no backend escalações que tentem salvar atleta na metade adversária, incluindo convidados.

## Prevenção

Toda futura alteração de posicionamento deve usar `clampPitchSlot` no frontend e preservar a validação equivalente no `playerSchema` do backend. Alterações de equipe devem limpar ou recalcular coordenadas manuais.
