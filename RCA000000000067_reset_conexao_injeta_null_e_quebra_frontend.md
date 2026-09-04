# RCA000000000067 - Reset de conexão injeta null e quebra frontend

## Sintoma

O navegador registrou `ERR_CONNECTION_RESET` em `/users` e, em seguida, `TypeError: Cannot read properties of null (reading 'filter')`, derrubando a interface autenticada.

## Causa raiz

O cliente HTTP convertia falha de parse JSON em `null` para qualquer resposta e aceitava esse valor como o tipo genérico solicitado. Assim, uma resposta intermediária vazia ou inválida podia ser gravada em estado declarado como array. Componentes chamavam `.filter()` conforme o contrato TypeScript, mas recebiam `null` em runtime. Falhas transitórias de GET também não tinham uma tentativa de recuperação.

## Impacto

Uma instabilidade momentânea do proxy ou serviço Railway podia deixar de ser apenas uma mensagem de erro e causar crash completo da aplicação.

## Correção

Rejeitar respostas 2xx vazias ou com JSON inválido em vez de retorná-las como dados válidos. Repetir uma única vez somente GETs que falhem por rede, resposta inválida ou HTTP 502/503/504. Escritas não são repetidas para evitar duplicidade. Depois da repetição malsucedida, apresentar erro técnico controlado e preservar os estados anteriores.

## Prevenção

A fronteira HTTP não deve usar coerção genérica para aceitar payload ausente. Retentativas devem ser limitadas a operações idempotentes e falhas transitórias conhecidas.
