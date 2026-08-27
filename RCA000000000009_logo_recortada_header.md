# RCA000000000009 - Logo recortada no header

## Sintoma

O símbolo PlayField aparecia parcialmente cortado no lado esquerdo do header e distante da assinatura visual esperada.

## Causa raiz

O recorte criado para neutralizar margens transparentes do PNG foi combinado com margem negativa no conjunto inteiro. Embora o recorte interno estivesse dimensionado para o conteúdo visível, o deslocamento externo empurrou parte do símbolo para fora da área útil do header.

## Impacto

- Identidade visual incompleta no primeiro elemento da aplicação.
- Símbolo e assinatura pareciam desconectados.
- O nome adicional `PlayField` criou uma hierarquia não solicitada.

## Origem

A tentativa de corrigir o espaço transparente do arquivo tratou simultaneamente o recorte interno e a posição externa do lockup.

## Correção

- Remover a margem negativa do conjunto.
- Manter o recorte apenas dentro do container do símbolo.
- Remover o nome adicional.
- Posicionar `° sports & gaming hub` diretamente ao lado do símbolo, centralizado verticalmente.

## Prevenção

Compensações da margem transparente devem ocorrer somente dentro do container de recorte da imagem. O lockup completo deve permanecer dentro do padding do header.