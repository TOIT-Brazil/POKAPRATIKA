# RCA000000000018 - Altura das tabelas Agenda e Prêmios

## Sintoma

- A tabela da Agenda possui barras de rolagem, mas ocupa uma área vertical pequena.
- A página de Prêmios termina antes do final da tela, diferente das demais páginas operacionais.

## Causa raiz

- O wrapper da Agenda está dentro de uma linha flexível que já limita sua altura, porém conserva `max-height: calc(100dvh - 250px)`, reduzindo novamente a área disponível.
- A página de Prêmios não possui classe de geometria própria. O card `.rules-center` mantém `max-height: min(76dvh, 720px)` e o wrapper genérico `.management-table-wrap` limita a tabela a `56dvh`.

## Impacto

- Menos registros visíveis e rolagem excessiva na Agenda.
- Espaço vazio abaixo da tabela de Prêmios e menor aproveitamento da viewport.

## Correção

- Permitir que a tabela da Agenda ocupe toda a linha flexível restante, preservando as barras nos dois eixos.
- Criar uma geometria própria para a página de Prêmios, fazendo o card e o wrapper da tabela crescerem até o final da área útil.

## Prevenção

Não combinar linhas flexíveis limitadas pelo pai com novos tetos em `dvh`. Páginas administrativas fullscreen devem possuir classe de página e classe de wrapper próprias quando reutilizam tabelas genéricas.

## Resultado

- A Agenda manteve o cabeçalho em altura natural e passou a entregar todo o restante da tela à tabela, sem o teto adicional de `calc(100dvh - 250px)`.
- As barras vertical e horizontal da Agenda foram preservadas.
- A página de Prêmios recebeu `.awards-page`; o card `.rules-center` perdeu os limites de `76dvh/720px` dentro dessa página.
- A tabela de Prêmios recebeu `.awards-table-wrap`, cresce com `flex: 1 1 0` e rola internamente até o final da área útil.
- Os seletores finais são mais específicos que o override mobile global, preservando a rolagem das duas tabelas.
- Typecheck, build de produção e diagnósticos do frontend concluídos sem erros.