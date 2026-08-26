[2026-08-26 13:33] | RCA criada | Botão de confirmação bloqueado após início do jogo ou fim da janela | [frontend/src/App.tsx, frontend/src/styles.css, backend/src/routes/matches.routes.ts] | Validar transição automática no horário de fechamento

# Sintoma
O botão `Confirmar presença` permanecia acionável no card principal mesmo depois de o jogo começar ou de a janela de confirmação terminar, permitindo abrir o modal de presença.

# Causa raiz
O card principal sempre executava `openMatch` pelo botão de presença, sem usar a regra consolidada `isConfirmationReallyOpen`. Um card alternativo usava essa regra, mas removia completamente o botão quando fechado. Além disso, o helper dependia apenas do valor `confirmationOpen` recebido do servidor e podia permanecer verdadeiro localmente até a próxima atualização após o horário limite.

# Impacto
A interface sugeria incorretamente que ainda era possível alterar a presença e permitia abrir o fluxo de marcação fora do período válido. O backend rejeitava a gravação, mas a experiência permanecia inconsistente.

# Correção aplicada
Os dois cards agora mantêm o botão visível, porém desabilitado e visualmente apagado quando a partida não está em `DRAFT` ou a janela encerrou. O botão desabilitado não executa a abertura do modal. O helper também compara `confirmationCloseAt` com o horário local para bloquear imediatamente, sem aguardar o próximo polling.

# Defesa de backend
A rota `PUT /matches/:id/attendance/me` já valida que a partida está em `DRAFT` e que a janela de confirmação está aberta antes de gravar. Essa validação foi preservada como fonte autoritativa de segurança.

# Prevenção
Toda ação de presença deve usar `isConfirmationReallyOpen` para disponibilidade visual e manter as mesmas validações de status e janela no backend.