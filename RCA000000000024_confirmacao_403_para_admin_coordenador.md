# RCA000000000024 - Confirmação retorna 403 para admin e coordenador

## Sintoma

Ao salvar a confirmação da rodada, a API retornava `403 Forbidden` com a mensagem `A confirmação de presença está disponível somente para atletas ativos`. O frontend permanecia exibindo `Salvando confirmação...` e registrava uma Promise rejeitada no console.

## Causa raiz

O papel do usuário é exclusivo no banco (`ADMIN`, `COORDENADOR` ou `ATLETA`). A nova autorização consultava somente usuários com `role = 'ATLETA'`, bloqueando administradores e coordenadores que também participam dos jogos. Isso contrariava a decisão de convidar todo usuário ativo do Ferino.

O frontend não capturava a exceção de `saveAttendance`, mantendo a mensagem transitória e propagando o erro para o console.

## Impacto

- Administradores e coordenadores ativos não conseguiam confirmar presença.
- O estado visual sugeria salvamento contínuo após a falha.
- O console exibia erro não tratado.

## Correção

- Autorizar todo usuário ativo, independentemente do papel.
- Incluir todos os usuários ativos na lista técnica e na contagem de convidados dos jogos.
- Capturar falhas no frontend e substituir o estado transitório pela mensagem real da API.
- Remover o texto `Escalação salva no banco` do modal.

## Prevenção

Regras de participação em jogos não devem inferir participação a partir do papel administrativo, porque o modelo atual não permite múltiplos papéis por usuário.