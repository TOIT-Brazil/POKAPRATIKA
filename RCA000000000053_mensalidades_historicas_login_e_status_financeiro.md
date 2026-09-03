# RCA000000000053 - Mensalidades históricas, login e status financeiro

## Sintoma

- A expansão de mensalidades mostra todas as cobranças abertas do atleta.
- Ao trocar ou encerrar a temporada, cobranças anteriores deixam de compor a tela principal.
- Usuários inadimplentes conseguem autenticar normalmente.
- Os status `Atrasado` e `Pendente` podem aparecer cortados no mobile.
- A Gestão financeira permanece disponível para ADMIN e COORDENADOR.

## Causa raiz

- O frontend renderiza toda a coleção `openPayments` e carrega a listagem principal filtrada pela temporada ativa.
- As consultas administrativas de pagamentos e resumo aceitam `seasonId`, embora a obrigação financeira continue existindo depois do encerramento esportivo.
- O login valida apenas usuário ativo e senha, sem consultar saldo vencido.
- A coluna móvel de status combina largura estreita, `white-space` e recorte por overflow.
- As rotas financeiras reutilizam a permissão ampla de coordenação.

## Impacto

- A operação financeira fica poluída por várias competências e pode ocultar inadimplência histórica ao trocar de temporada.
- Atletas e coordenadores inadimplentes mantêm acesso ao sistema.
- Status truncados prejudicam leitura e ação no celular.
- O escopo financeiro fica mais amplo que a decisão administrativa vigente.

## Correção

- Exibir por atleta no máximo a mensalidade vencida mais antiga e a próxima cobrança aberta não vencida, avançando automaticamente quando competências futuras forem quitadas.
- Tratar listagem e resumo administrativos como históricos globais, preservando `season_id` apenas para vínculo esportivo e pontuação.
- Bloquear emissão de JWT para ATLETA e COORDENADOR com cobrança vencida e saldo positivo; ADMIN mantém acesso para operar regularizações.
- Restringir a Gestão financeira administrativa e suas rotas ao perfil ADMIN; o atleta preserva a consulta das próprias mensalidades.
- Recalibrar a coluna e o badge de status para uma única linha sem recorte.

## Prevenção

Separar explicitamente escopo esportivo por temporada de obrigação financeira histórica, centralizar a condição de inadimplência no backend e validar rótulos financeiros completos nos breakpoints mobile.

## Resultado

- A visão administrativa carrega mensalidades e resumo sem filtro de temporada; caixa, receitas, despesas, saldo e dívidas continuam após encerramento ou troca de temporada.
- Cada atleta exibe no máximo a cobrança vencida mais antiga e a próxima cobrança aberta não vencida. Competências quitadas são ignoradas automaticamente.
- ATLETA e COORDENADOR com saldo vencido não recebem JWT no login. ADMIN mantém acesso para registrar a regularização.
- Gestão, geração, baixa e caixa são exclusivos de ADMIN; os demais perfis preservam somente `Minha mensalidade`.
- O status móvel ganhou largura e badge compacto em linha única, sem cortar `Atrasado` ou `Pendente`.
- Typechecks e builds de frontend/backend, diagnósticos e `git diff --check` foram concluídos sem erros.
