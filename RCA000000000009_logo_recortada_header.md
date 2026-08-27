# RCA000000000009 - Logo recortada no header

## Sintoma

O símbolo PlayField aparecia parcialmente cortado no lado esquerdo do header e distante da assinatura visual esperada.

## Causa raiz

O recorte criado para neutralizar margens transparentes do PNG usava `overflow: hidden` com limites justos ao conteúdo opaco. A antisserrilha e a sombra nas bordas ultrapassavam esses limites e eram cortadas, mesmo após remover o deslocamento externo do conjunto.

## Impacto

- Identidade visual incompleta no primeiro elemento da aplicação.
- Símbolo e assinatura pareciam desconectados.
- O nome adicional `PlayField` criou uma hierarquia não solicitada.

## Origem

A tentativa de corrigir o espaço transparente do arquivo tratou simultaneamente o recorte interno e a posição externa do lockup.

## Correção

- Manter o conjunto sem margem negativa.
- Compensar a transparência pela posição interna da imagem sem mascarar suas bordas.
- Restaurar `PlayField` acima de `sports & gaming hub`.
- Fixar 3px entre o símbolo e o bloco textual em desktop e mobile.

## Prevenção

Compensações da margem transparente devem ocorrer pela posição interna da imagem, preservando margem para antisserrilha e sombra. O lockup completo deve permanecer dentro do padding do header.