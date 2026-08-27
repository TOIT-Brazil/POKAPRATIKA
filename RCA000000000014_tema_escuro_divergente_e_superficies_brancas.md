# RCA 000000000014 - Tema escuro divergente e superfícies brancas

## Sintoma

Após tornar o tema escuro padrão, o site passou por uma restauração azul-marinho que não correspondia ao visual histórico percebido pelos usuários. Algumas superfícies auxiliares também continuaram brancas.

## Causa raiz

A identificação inicial do tema histórico considerou apenas a primeira camada antiga da folha, azul-marinho, e ignorou a camada oficial posterior. O histórico Git confirmou que o visual efetivamente utilizado era grafite esverdeado (`#071311`), com superfícies `#0d1d1a/#132723`, acentos verdes `#35b86b/#69d0b0` e uma luz amarela discreta à direita. A camada de compatibilidade cobriu as famílias principais, mas alguns cards com cores claras hardcoded e seletores mais específicos permaneceram fora dela.

## Impacto

A identidade visual perdeu o acabamento grafite, os detalhes verdes e a luz amarela característica. A coexistência de fundos escuros e brancos também deixou o tema inconsistente.

## Origem

Interpretação incorreta de “modo escuro existente” baseada na primeira declaração CSS encontrada, sem conferir qual camada posterior vencia a cascata nem comparar o resultado com o histórico Git e a referência visual do usuário.

## Correção

- Restaurar nos tokens oficiais a paleta grafite esverdeada comprovada no histórico.
- Restaurar as luzes verde à esquerda e amarela à direita no fundo global.
- Converter a camada final de compatibilidade para as mesmas superfícies grafite.
- Incluir superfícies auxiliares que ainda usam branco explícito.
- Preservar cores semânticas somente para sucesso, alerta, perigo, cartões e campo.

## Prevenção

Antes de migrar um tema existente, identificar qual declaração vence a cascata, comparar com o histórico Git e validar contra uma referência visual. Não concluir a identidade pelo primeiro bloco CSS encontrado. Validar superfícies computadas em componentes representativos, não apenas os tokens globais.
