# RCA 000000000014 - Tema escuro divergente e superfícies brancas

## Sintoma

Após tornar o tema escuro padrão, o site passou a usar um tom verde-grafite diferente do modo escuro original e algumas superfícies auxiliares continuaram brancas.

## Causa raiz

A migração anterior substituiu os tokens claros por uma nova paleta verde, em vez de restaurar os valores do tema escuro já existente no início da folha (`#07111f`, cards azul-marinho e acento azul). A camada de compatibilidade cobriu as famílias principais, mas alguns cards com cores claras hardcoded e seletores mais específicos permaneceram fora dela.

## Impacto

A identidade visual mudou além do solicitado e a coexistência de fundos escuros e brancos deixou o tema inconsistente.

## Origem

Interpretação incorreta de “deixar o padrão escuro”: foi criada uma nova direção cromática, quando o requisito era promover o modo escuro existente a padrão único.

## Correção

- Restaurar nos tokens oficiais a paleta azul-marinho original.
- Converter a camada final de compatibilidade para os mesmos tons originais.
- Incluir superfícies auxiliares que ainda usam branco explícito.
- Preservar cores semânticas somente para sucesso, alerta, perigo, cartões e campo.

## Prevenção

Antes de migrar um tema existente, identificar e reutilizar os tokens cromáticos originais. Não criar nova paleta sem solicitação explícita e validar superfícies computadas em componentes representativos, não apenas os tokens globais.
