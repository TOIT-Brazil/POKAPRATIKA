- O `config.` agora exibe `Temporadas`, `Usuários` e `Pontuação` em tabelas com filtros por coluna; a Central de `Prêmios` também ganhou filtros laterais em cada coluna da tabela editável.
- O modal `Agenda` foi ampliado e a lista de jogos pré-definidos virou tabela com filtros por coluna, exibindo data, jogo, horário, confirmação, janela e presenças de forma mais legível.
- A aba `Usuários` passou a usar uma versão tabelada própria com colunas de nome, e-mail, perfil, posição, status, ações e retorno; a central de `Prêmios` também foi migrada para tabela editável de regras.
# PROJECT_CONTEXT — POKA PRÁTIKA

Data: 2026-07-23

## Estado atual

Foi criada a base full-stack do sistema POKA PRÁTIKA, seguindo o padrão TOIT/Railway:

- Repositório único com diretórios separados `frontend` e `backend`.
- Backend Node.js/TypeScript com Express e PostgreSQL via `pg`, sem ORM.
- Frontend React/Vite/TypeScript/Tailwind, mobile-first e interface compacta.
- Frontend em produção usa Nginx com `docker-entrypoint.sh` para gerar `/runtime-config.js` a partir de `VITE_API_URL` no runtime Railway, evitando tela branca quando a variável existe no serviço mas não entrou no build Vite.
- Identidade visual original criada em `frontend/src/assets/poka-pratika-logo.svg`, com tom cômico de futebol amador/perna de pau, referência a Balneário Camboriú/SC e paleta azul média aplicada ao escudo e aos elementos de destaque do sistema; no símbolo, `POKA` e `PRÁTIKA` usam o mesmo tamanho de fonte, ambos ampliados em 15% sobre o tamanho anterior de `POKA`, sem a antiga bolinha amarela e com os textos 2px mais baixos.
- Migrações SQL manuais em `migrations/01_core_schema.sql`, `migrations/02_pagamentos_vencimento_pontuacao.sql`, `migrations/03_saldo_inicial_temporada_excel.sql`, `migrations/04_posicoes_oficiais_atletas.sql`, `migrations/05_sumula_rascunho_operacional_autosave.sql`, `migrations/06_selecao_do_ano_7_votos.sql`, `migrations/07_eventos_gol_contra.sql`, `migrations/08_email_case_insensitive_unico.sql`, `migrations/09_reparo_schema_sumula_operacional.sql` e `migrations/10_correcoes_auditadas_sumula.sql`.
- Sem criação de `.env` e sem hardcode de credenciais/URLs.
- Backend valida obrigatoriamente `NODE_ENV=production`, `PORT=8080`, `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS` e `FRONTEND_URL` no startup Railway.
- Backend expõe `/health` e `/ready`; `/ready` consulta o PostgreSQL com SQL nativo para homologar conexão real do serviço.
- CSS customizado foi mantido apenas como complemento ao Tailwind para ajustes finos de densidade visual e responsividade; modais longas e telas pequenas agora priorizam rolagem segura para não cortar formulários operacionais.
- Homologação final documentada em `docs/homologacao-final.md`; garantia técnica consolidada em `docs/garantia-qualidade.md`; troubleshooting Railway em `docs/troubleshooting-railway.md`; o sistema só deve ser considerado finalizado após execução dos fluxos de aceite na Railway.

## Funcionalidades implementadas

### Banco

- Usuários com perfis `ADMIN`, `COORDENADOR`, `ATLETA`.
- Usuários/atletas com posição cadastral oficial em `users.position`: `GO`, `ZG`, `LD`, `LE`, `MD`, `MC`, `MA` ou `AT`.
- A posição cadastral do atleta é independente do papel operacional da súmula; `match_players.role_in_match` permanece com `GOLEIRO`, `LINHA` e `PRESENTE_SEM_JOGAR`.
- Temporadas com status `DRAFT`, `OPEN`, `CLOSED`.
- Súmulas, jogadores da súmula, eventos, pagamentos, pontuação, premiações, votação, badges e suspensões.
- Saldos iniciais importados da tabela atual do Excel em `season_standing_adjustments`, somados às novas súmulas confirmadas.
- `season_standings` separa `games_played` (jogos efetivamente jogados) de `presences` (compareceu, mas não jogou), conforme a planilha real da temporada 2026.
- Métricas da classificação geral incluem gols da equipe pró/contra/saldo, aproveitamento por atleta, médias de gols e cartões ponderados.
- View `season_standings` para pontos corridos/rankings.
- Índices para temporadas abertas, súmulas, eventos, pagamentos, votos e suspensões.

### Backend

- Autenticação JWT e senha com bcrypt.
- Login oficial por e-mail e senha.
- Bootstrap seguro do primeiro admin quando o banco ainda não tem usuários.
- Usuários autenticados podem trocar a própria senha em `/auth/change-password`, informando senha atual e nova senha; o backend valida bcrypt, impede reutilizar a senha atual, atualiza `password_hash` e invalida tokens pendentes de recuperação/ativação.
- Cadastro de usuários por ADMIN/COORDENADOR pode ser feito sem senha inicial; nesse caso o sistema gera token seguro e envia e-mail de ativação pelo Microsoft Graph.
- E-mail de ativação usa o assunto `POKA PRÁTIKA: ATIVE SEU CADASTRO`; recuperação usa `POKA PRÁTIKA: ALTERE SUA SENHA`.
- CRUD base de usuários pelo ADMIN; COORDENADOR pode cadastrar atletas, mas não cria ADMIN/COORDENADOR.
- Gestão administrativa de usuários foi reforçada com edição de nome/e-mail/papel/posição/status, proteção contra remoção do último ADMIN ativo, redefinição de senha pelo ADMIN e reenvio de convite de ativação por Microsoft Graph.
- Configuração de pontuação pelo ADMIN e COORDENADOR.
- Configuração de categorias de premiação pelo ADMIN em `/settings/awards`, permitindo alterar rótulos e ligar/desligar categorias votáveis sem mudar código.
- Temporadas: criar, iniciar, encerrar, ranking e classificação.
- Encerramento de temporada gera prêmios/badges automáticos de ranking para alimentar a carreira histórica dos atletas.
- Endpoint de carreira do atleta consolida estatísticas, temporadas, títulos, badges e suspensões.
- Súmulas: criar, iniciar, submeter, confirmar, registrar eventos e cálculo de trocas.
- Detalhe de súmula `DRAFT` vazia foi endurecido para abrir sem atletas/eventos, sem depender de `scheduled_start/scheduled_end` e sem quebrar caso `match_corrections` ainda não exista; bancos existentes devem executar a migration `09` para autosave operacional e a migration `10` para histórico auditável de correções.
- O `GET /matches/:id` teve o cálculo de `availableMinutes` reescrito para sintaxe PostgreSQL explícita (`EXTRACT(EPOCH FROM (...)) / 60`), corrigindo o erro Railway `syntax error at or near "AS"` que retornava `500` ao abrir a súmula.
- Súmulas existentes em `DRAFT`, `RUNNING` ou `SUBMITTED` podem ter árbitro, data, times e escalação reabertos e editados pela interface, persistindo em `/matches/:id/lineup` e recalculando roteiro de trocas após salvar.
- Início oficial da partida pelo botão `Jogo iniciado`, persistindo `started_at` com o instante real do clique no PostgreSQL e exibindo em horário de Brasília.
- Tempo de jogo e cadência de substituições respeitam a janela fixa da quadra: aluguel das 20:00 às 21:00, mas se o jogo iniciar atrasado o tempo útil passa a ser apenas o intervalo entre `started_at` e 21:00.
- Rascunho operacional da súmula persiste `draft_team_a_score`, `draft_team_b_score`, `draft_events`, `draft_clock_seconds`, `draft_clock_running`, `draft_saved_by` e `draft_saved_at`, evitando perda de placar/eventos se o dispositivo desligar antes da submissão.
- Súmulas não confirmadas podem ser canceladas por ADMIN/COORDENADOR sem pontuar a temporada.
- Detalhe da súmula retorna o histórico de correções auditadas com antes/depois, motivo, responsável e data.
- Súmulas validam consistência antes de pontuar: só confirmam após submissão, eventos precisam ser de atletas escalados e gols lançados precisam bater com o placar por time.
- Súmulas não podem ser submetidas ou confirmadas sem `started_at`; isso bloqueia bypass de pontuação sem o botão `Jogo iniciado`.
- Eventos relacionados são validados para impedir vínculo com atleta fora da súmula, presente sem jogar, atleta do outro time ou o próprio autor do evento.
- Frontend do editor de eventos deriva o time pelo atleta selecionado e filtra atletas relacionados para o mesmo time, evitando seleção visual contraditória.
- Súmulas confirmadas podem ser corrigidas por ADMIN/COORDENADOR através de correção auditada com motivo obrigatório, gravando antes/depois em `match_corrections`, criada pela migration `10_correcoes_auditadas_sumula.sql`.
- Eventos oficiais incluem `GOL_CONTRA`, além de gol, assistência e cartões amarelo/vermelho/azul.
- `GOL_CONTRA` foi alinhado também no SQL base e na migração incremental `07_eventos_gol_contra.sql`, evitando falha em bancos novos ou já existentes.
- Importação de saldo inicial da tabela do Excel por temporada, para iniciar a continuidade da temporada 2026 exatamente na classificação atual.
- Pagamentos: controle de mensalidades por ADMIN/COORDENADOR e visão própria para atleta.
- Mensalidades possuem vencimento; pagamento registrado antes do vencimento gera 1 ponto na temporada vinculada.
- Mensalidades agora têm resumo financeiro por temporada, geração mensal em lote para todos os atletas ativos, preservação de pagamentos já quitados e observações operacionais.
- Votação de premiações com resultado restrito ao ADMIN.
- Seleção do ano possui votação estruturada com 7 votos por atleta: 1 goleiro (`GO`) e 6 jogadores de linha, persistidos em `award_votes.vote_slot`.
- Consolidação de vencedores votados pelo ADMIN grava prêmios no histórico e badges dos atletas.
- Suspensões automáticas por cartão vermelho ou 3 amarelos confirmados na temporada.
- Baixa de suspensão exige partida confirmada, posterior ao jogo gatilho e vinculada à mesma temporada quando houver `season_id`.
- Lista de usuários para atleta autenticado é reduzida a dados públicos de usuários ativos; e-mail/status completos ficam restritos a ADMIN/COORDENADOR.
- E-mails de usuários são normalizados para minúsculas, recebem índice único case-insensitive na migração `08` e conflitos de duplicidade retornam `409` sem vazar detalhes internos.
- Integração de recuperação de senha preparada para Microsoft Graph.

### Frontend

- Login e recuperação de senha; a opção visual `Primeiro acesso` foi removida da página de login para simplificar a experiência pública.
- Inputs de senha usam `autocomplete` adequado (`current-password` e `new-password`), removendo o aviso do console do Chrome sem alterar regra de autenticação.
- Login e header com logo/microcopy do POKA PRÁTIKA de Balneário Camboriú/SC.
- Header autenticado expõe `Trocar senha` para ADMIN, COORDENADOR e ATLETA, abrindo modal responsiva com senha atual, nova senha e confirmação, chamando o backend real.
- Header autenticado permite abrir o próprio perfil clicando no avatar/nome; perfis de terceiros são visualizados no mesmo modal sem edição de dados de outro usuário.
- Dashboard de temporada, pontos corridos, rankings e suspensões.
- Dashboard com pódio visual, KPIs compactos, rankings e estados vazios amigáveis.
- Dashboard exibe classificação alinhada à planilha real: pontos, jogos, vitórias, empates, derrotas, presença sem jogar, mensalidade, gols da equipe, saldo e aproveitamento.
- Rankings contemplam artilharia com gols contra/saldo/média, assistência com média, assiduidade com jogos+presença e cartões por pontos/total/média.
- A aba `perfis` foi removida; carreira acumulada de atleta/usuário agora abre em modal sobre fundo fumê transparente, acionado pelo avatar/nome do usuário no header ou por nomes clicáveis na classificação/rankings.
- Lista de súmulas, criação com atletas por time/presença, ordem de sorteio, sequência, banco, cronômetro digital e fechamento por eventos.
- Criação de súmula operacional com busca por nome/e-mail a partir de 3 caracteres, inclusão rápida no Time A, Time B ou presente sem jogar, e ordenação drag-and-drop da sequência de substituições.
- Criação de súmula operacional permite montar uma lista de presença e acionar o balanceamento automático por posições, distribuindo `GO`, defesa/laterais, meio-campo e ataque entre Time A e Time B com diferença mínima por grupo.
- A tela `Nova súmula` agora cria imediatamente uma súmula `DRAFT` no banco e autosalva a escalação via `/matches/:id/lineup`, protegendo a montagem de presentes/times/banco/sequência antes do fechamento da modal.
- O detalhe da súmula permite reabrir e editar escalação existente em `DRAFT`, `RUNNING` e `SUBMITTED`, incluindo árbitro, data, times, banco, goleiro/linha, presentes, rebalanceamento e salvamento real no backend.
- Backend valida edição de escalação contra atletas duplicados/inativos e contra eventos já lançados, além de bloquear `Jogo iniciado` sem exatamente 1 goleiro e pelo menos 6 linhas em cada time.
- O balanceador define o primeiro `GO` de cada time como `GOLEIRO`, transforma excedentes em `LINHA` para evitar múltiplos goleiros fixos no mesmo time e marca automaticamente como banco os jogadores de linha acima dos 6 primeiros de cada equipe.
- Cronômetro oficial é derivado do `started_at` persistido, não do estado local do celular; ao reabrir a súmula, o tempo continua como se o dispositivo nunca tivesse desligado.
- Editor de placar/eventos usa autosave no endpoint protegido `/matches/:id/draft` enquanto a súmula não está confirmada.
- Súmulas da aba são filtradas pela temporada selecionada.
- Operação de jogo agora expõe início oficial da súmula, cancelamento seguro de súmulas não confirmadas, submissão, confirmação e correção auditada.
- Cancelamento de súmula usa confirmação inline na interface, sem `window.confirm`, para UX mais consistente em celular.
- Histórico de correções auditadas aparece no detalhe da súmula, evitando ajuste invisível de placar/eventos.
- Modal operacional da súmula ganhou lançamento rápido por atleta: botões `G`, `A`, `CA`, `AZ`, `CV` e `GC` por jogador de cada time; `GC` mantém a regra de gol contra pontuar o adversário sem somar para artilharia do autor.
- A criação de partida na temporada usa CTA claro `Criar jogo`; a lista de jogos ficou na home da temporada ativa como entrada visual discreta para abrir a súmula em modal fumê.
- Exibição automática de roteiro de trocas conforme súmula tradicional.
- Gestão de mensalidade com mês de referência, vencimento, data de pagamento, status e indicação de ponto antecipado.
- Aba de mensalidades exibe KPIs financeiros, lista densa de cobranças, exportação CSV e ações operacionais em modais fumê: `Gerar mês` para atletas ativos e `Registrar pagamento` individual.
- Votação de premiações sem `Vera Verão`, com apuração ADMIN e consolidação de winners/badges; `SELECAO_ANO` exibe formulário especial com 1 goleiro + 6 linhas.
- Configurações de usuários e pontuação para ADMIN/COORDENADOR, com criação de perfis privilegiados restrita ao ADMIN.
- ADMIN consegue editar cadastro completo de usuários, redefinir senha e reenviar convite de ativação pela interface; a edição de usuário agora abre em modal individual para não poluir a lista operacional.
- ADMIN configura categorias de premiação na aba `premios` através de modal fumê, controlando nomes e votação habilitada sem poluir a tela principal de votação/apuração.
- Classificação geral e mensalidades têm exportação CSV operacional.
- Painel administrativo `config.` foi reorganizado como home operacional com cards de ação e modais fumê para criar temporada, editar pontuação, criar usuário e importar Excel, mantendo listas densas de temporadas e usuários na tela principal.
- ADMIN pode editar perfil, posição oficial e status ativo/inativo de usuários; COORDENADOR mantém criação operacional de atletas sem elevação indevida de privilégio.
- Suspensões abertas podem ser marcadas como cumpridas na temporada a partir de uma partida confirmada.
- Painel administrativo permite colar a tabela atual do Excel com cabeçalho e importar o saldo inicial da temporada, retornando linhas importadas e linhas ignoradas para revisão.
- O formulário antigo de criação de súmula foi removido; existe apenas o fluxo operacional com busca e drag-and-drop.
- UI refinada com logo original azul, palavra `PRÁTIKA` abaixo de `POKA` no símbolo, pódios, cards, microcopy cômica, modais roláveis, listas suspensas com opções em fonte preta e layout compacto/mobile-first com line-height global reduzido em 10%.
- A navegação avançou para o padrão painel principal + modais fumê em todos os módulos principais: jogos/súmulas aparecem como relatório na temporada ativa, operação da partida abre em modal amplo, mensalidades usam modais para geração/registro, prêmios usam modal para configuração administrativa e `config.` usa modais para ações sensíveis.
- O pop-up global automático de confirmação de presença foi removido; atletas agora confirmam presença apenas pelo botão do card do jogo e pela modal do próprio jogo, sem interrupção recorrente ao abrir a home.
- O dashboard principal foi redesenhado em tema light/vibrante com header fixo, seletor de temporada no topo, card hero do próximo jogo com textura de gramado e contagem regressiva, widget operacional lateral com disciplina/financeiro/quadra e seção inferior unificada com jogos finalizados horizontais, líderes, abas e paginação de estatísticas.
- O dashboard principal foi refinado para ficar aderente à referência visual: a temporada voltou para a faixa abaixo do header, o topo ganhou ícones de utilitários, o próximo jogo passou a usar badge de data à esquerda com miolo em gramado e trilha lateral de status/ações, o painel operacional foi compactado em 3 widgets e a base foi reorganizada em duas colunas com jogos finalizados à esquerda e tabela de atletas à direita.
- O card `Central dos jogos` passou a usar a biblioteca `react-soccer-lineup` como camada real de fundo do campo no hero do próximo jogo, com overlay escuro para preservar legibilidade dos dados operacionais.
- O dashboard principal recebeu novo refinamento para aderir ainda mais à imagem de referência: painel operacional lateral simplificado em três widgets compactos, rótulos do hero ajustados para `Não responderam`/`Para ajustar` quando aplicável e densidade visual mais próxima da composição alvo.
- O dashboard principal foi expandido para aproveitar mais a largura útil da tela, com colunas superiores/inferiores recalibradas e o `Central dos jogos` escurecido em verde mais fechado, mantendo apenas um campo grande no fundo em vez do efeito visual de múltiplos campos.
- O topo do dashboard foi refinado novamente para evitar cortes no `Central dos jogos`: a coluna lateral do hero foi alargada para comportar `Fechado para Confirmação`, `% respostas` e os botões completos, enquanto o `Central operacional` ganhou mais largura útil e cards mais altos para impedir sobreposição entre `Suspenses`, `Finance` e `Agenda`.
- Todos os fechamentos de modal foram padronizados visualmente para botões `X`, substituindo os antigos CTAs textuais `Fechar` nos headers e áreas de topo dos modais.
- A modal `Súmula Inteligente` de criação de jogo foi redesenhada para o layout claro em wizard da referência, com header compacto, stepper horizontal, card esquerdo de detalhes, coluna direita de busca/sorteio e footer operacional fixo com `Cancelar` e `Salvar súmula final`.
- A modal `Súmula Inteligente` recebeu refinamento visual adicional para aderir melhor à referência: ícones semânticos nos títulos/indicadores, botão de sorteio com dois dados, camisas distintas para `Time A` e `Time B` e densidade reduzida para evitar barra de rolagem no container principal do modal.
- Os ícones da modal `Súmula Inteligente` foram ampliados levemente para melhorar a leitura visual sem reabrir o problema de densidade/rolagem do modal.
- O stepper da modal `Súmula Inteligente` foi ajustado para o padrão em pílulas conectadas da referência, com trilha ao fundo e sem a linha atravessar visualmente a pílula central.
- O stepper da modal `Súmula Inteligente` foi refinado novamente para que cada pílula envolva número + texto no mesmo bloco visual, impedindo a trilha de passar sobre o rótulo do passo central.
- A lista de atletas selecionados na modal `Súmula Inteligente` foi compactada para linhas únicas com nome + posição e remoção discreta, evitando cards grandes quando houver muitos participantes.
- A lista de atletas selecionados na modal `Súmula Inteligente` agora quebra em duas colunas quando ultrapassa 6 participantes, reduzindo a altura do modal sem perder legibilidade.
- A lista de atletas selecionados na modal `Súmula Inteligente` foi simplificada novamente para permanecer sempre em duas colunas no desktop, mantendo a altura mais controlada desde poucos até muitos participantes.
- A lista de atletas selecionados na modal `Súmula Inteligente` passou a exibir apenas o primeiro nome de cada atleta, reduzindo ainda mais a largura das linhas compactas em duas colunas.
- O resultado do sorteio na modal `Súmula Inteligente` foi compactado para linhas pequenas com primeiro nome + posição; o clique na linha agora alterna se o atleta começa no banco, enquanto a definição fina de função operacional fica para depois.
- O resultado do sorteio foi removido do corpo principal da modal `Súmula Inteligente`: ao clicar em `Sortear times`, abre uma confirmação rápida separada com `Time A` e `Time B`, onde o clique na linha do atleta alterna banco antes do `Salvar súmula final` no modal principal.
- A confirmação rápida de `Time A` e `Time B` foi recentralizada verticalmente no meio da tela, deixando de ficar presa visualmente na parte superior do overlay.
- A `Confirmação da rodada` foi redesenhada para seguir a referência visual clara com ícones de status, dashboard de escolha única, bloco lateral de janta/observação e card de `Sua Resposta Recente`, substituindo a versão antiga mais genérica.
- Durante esse redesign foi necessário reparar a estrutura do `frontend/src/App.tsx`, removendo uma cópia indevida da `AttendancePanel` dentro do editor de escalação, reconstruindo a cauda funcional do `ExistingLineupEditor` e restaurando o componente `SubstitutionManager` para manter o build íntegro.
- Os ícones de bola e refeição da `Confirmação da rodada` foram substituídos por novos SVGs customizados mais legíveis e mais próximos do estilo flat desejado, melhorando a presença visual nos botões, anéis e cards de status.
- Os ícones de bola e refeição da `Confirmação da rodada` deixaram de usar SVG manual e passaram a usar `react-icons`, com `MdSportsSoccer` e `MdOutlineRestaurantMenu`, alinhando a interface à biblioteca visual pedida e melhorando a consistência dos pictogramas.
- A modal operacional do jogo foi separada em duas etapas para coordenação: primeiro `Confirmação da rodada`; depois `Jogo e escalação`. O avanço agora acontece automaticamente após `Salvar minha confirmação`, mantendo a leitura mais limpa e sem empilhar confirmação e operação na mesma tela de uma vez.
- Na etapa inicial `Confirmação da rodada` da coordenação, o bloco `Sua Resposta Recente` foi ocultado; a área inferior de leitura extra não aparece mais antes do salvamento, deixando a primeira tela focada apenas na confirmação. A parte de placar/tempo/escalação continua aparecendo somente após salvar.
- A etapa `Jogo e escalação` da modal operacional foi redesenhada para um board visual mais próximo da referência: card de tempo/placar no topo, laterais com titulares e reservas de cada time, gramado central com posicionamento dos atletas e rodapé separado entre log de eventos e ações de fechamento da súmula.
- A solicitação seguinte removeu toda a parte inferior da modal operacional novamente: ao abrir a súmula, a interface agora exibe somente a `Confirmação da rodada`, sem renderizar mais o bloco abaixo dela. A reconstrução da área de jogo/escalação ficará para uma próxima iteração partindo do zero.
- Depois disso foi identificado um segundo caminho legado no dashboard (`DashboardMatchesPanel`) que ainda mostrava a área operacional antiga da súmula. A home da temporada passou a usar o `MatchesPanel` já limpo, apagando essa parte antiga do site na origem sem depender de novos escondes locais.
- Em seguida foi necessário voltar o topo da temporada para o `DashboardMatchesPanel`, porque a troca para `MatchesPanel` removeu a paleta visual anterior e o gramado ao fundo do hero. O `DashboardMatchesPanel` foi mantido, mas sua modal foi limpa para exibir apenas a `Confirmação da rodada`, sem reativar a parte operacional antiga.
- Depois disso, a modal `Abrir súmula` do coordenador foi reativada como board operacional dentro do `DashboardMatchesPanel`, combinando novamente placar/tempo, checklist, trocas, editor de escalação já expandido, campo central e fechamento da súmula. O hero da temporada com gramado e paleta anterior foi preservado.
- A decisão seguinte separou novamente os conceitos: a modal ativa do `DashboardMatchesPanel` voltou a mostrar apenas `Confirmação da rodada`, sem board operacional, sem `Abrir súmula` embutida e sem misturar confirmação com jogo/escalação. O hero com gramado e paleta anterior foi preservado.
- Na sequência, o card do próximo jogo passou a separar os gatilhos: `Confirmações` continua abrindo a modal de `Confirmação da rodada`, enquanto `Abrir súmula` abre uma segunda modal independente para coordenação, deixada vazia por enquanto para reconstrução posterior sem contaminar o fluxo de presença.
- Depois disso, a nova modal de `Abrir súmula` ganhou um board próprio no `DashboardMatchesPanel`, separado das confirmações: topo claro com cronômetro/placar central, colunas de titulares e banco, campo tático verde ao centro, área de troca à esquerda e bloco de fechamento/log/ações à direita. Os botões `Salvar Súmula`, `Iniciar Relatório`, `FINALIZAR JOGO` e `GERAR SÚMULA` foram ligados ao fluxo real de rascunho, início, submissão e confirmação.
- A modal `Abrir súmula` foi ampliada e compactada para aproveitar mais a viewport e reduzir barras de rolagem. Quando a escalação ainda não existe no banco, o board agora semeia automaticamente os atletas a partir das confirmações salvas, distribui os confirmados entre `TIME A` e `TIME B` com o balanceador existente e já mostra esses nomes nas listas laterais correspondentes.
- O botão de `Confirmações`/`Confirmar presença` no card principal do próximo jogo foi restaurado como ação sempre visível acima de `Abrir súmula`, sem depender de a janela estar aberta naquele instante. Assim a modal de confirmação continua acessível o tempo todo.
- A aba `Mensalidades` deixou o grid de cards individuais e passou a exibir uma tabela densa ordenada por nome/mês, reunindo nome, valor, pago, pendente, status, ponto, observação e ação operacional em menos espaço vertical.
- O bloco `Caixa do grupo` dentro de `Mensalidades` também deixou os cards e passou a usar tabela compacta com data, tipo, descrição, origem, responsável e valor.
- As tabelas de `Mensalidades` e `Caixa do grupo` receberam uma segunda linha no cabeçalho com filtros por coluna, permitindo pesquisa direcionada por nome, mês, vencimento, status, observação, descrição, origem, responsável e demais campos visíveis.
- O filtro dessas tabelas foi refinado para o padrão solicitado: cada coluna agora mostra um ícone de filtro no cabeçalho; ao clicar, abre um painel lateral compacto com campo de busca e lista rolável de valores daquele campo para seleção direta.
- Os indicadores financeiros do módulo `Mensalidades` foram reunidos em uma única faixa horizontal, mantendo recebido, aberto, pendente, atraso, pontos antecipados, receitas, despesas e saldo de caixa na mesma linha com rolagem lateral quando necessário.
- O fluxo de mensalistas foi blindado contra duplicidade por e-mail: cadastro/edição agora recusam e-mails já existentes, a geração/listagem de mensalidades desconsidera atletas repetidos por e-mail e foi preparada uma migration SQL manual para consolidar pagamentos duplicados e inativar cadastros repetidos legados.

## Regras importantes consolidadas

- Não usar ORM.
- Não criar `.env`.
- Backend deve subir somente com `NODE_ENV=production` e `PORT=8080`.
- Não criar dados mockados.
- Toda alteração de banco deve ser SQL manual em `/migrations`.
- Para bancos já existentes com usuários cadastrados em `LINHA`/`GOLEIRO`, executar `migrations/04_posicoes_oficiais_atletas.sql`; a migração converte `GOLEIRO` para `GO`, `LINHA` para `MC` e preserva posições oficiais já válidas.
- Para continuidade da temporada 2026, executar também `migrations/03_saldo_inicial_temporada_excel.sql` antes de importar a tabela do Excel.
- `Vera Verão` foi removido.
- Cartões oficiais: amarelo, vermelho e azul.
- Controle de cartões usa pontos ponderados no ranking: amarelo = 1, azul = 2, vermelho = 3.
- Vermelho suspende 1 jogo.
- 3 amarelos acumulados em jogos confirmados da temporada suspendem 1 jogo, inclusive 1 amarelo em um jogo + 2 amarelos no jogo seguinte.
- O histórico oficial é acumulado por várias temporadas e forma a carreira do atleta: estatísticas, títulos, prêmios e badges permanecem vinculados à temporada de origem.
- Mensalidade pontua apenas quando paga antes do vencimento (`paid_at::date < due_date`) e vinculada a uma temporada.
- Awards/badges definidos: rankings automáticos de temporada, votação sigilosa e badges históricos por atleta.
- `SELECAO_ANO`: consolidação gera placement 1 para goleiro e placements 2 a 7 para os seis jogadores de linha mais votados.
- A tabela da temporada é calculada por: saldo inicial importado do Excel + súmulas confirmadas/corrigidas + mensalidades pagas antes do vencimento.
- Pontuação da presença: quem joga soma o ponto de participação via `games_played`; quem comparece e não joga soma o mesmo ponto através de `presences`.

## Validações executadas

- `backend`: `npm run typecheck`, `npm run build` e `npm audit --audit-level=moderate` concluídos com sucesso após hardening P1.
- `backend`: `npm run typecheck` e `npm run build` concluídos com sucesso após criação da migration `10` e blindagem do `GET /matches/:id` contra ausência temporária de `match_corrections`.
- `backend`: `npm run typecheck` e `npm run build` concluídos com sucesso após corrigir a sintaxe PostgreSQL do cálculo de `availableMinutes` em `/matches/:id`.
- `backend`: `npm run typecheck` e `npm run build` concluídos com sucesso após adicionar `/auth/change-password`.
- `frontend`: `npm run typecheck`, `npm run build` e `npm audit --audit-level=moderate` concluídos com sucesso após ajustes de árbitro, responsividade e runtime config Railway.
- `frontend`: `npm run typecheck` e `npm run build` concluídos com sucesso após adicionar `autocomplete` nos inputs de senha.
- `frontend`: `npm run typecheck` e `npm run build` concluídos com sucesso após remover `Primeiro acesso` do login, centralizar o card e adicionar a modal `Trocar senha`.
- `frontend`: `npm run typecheck` e `npm run build` concluídos com sucesso após remover a aba `perfis`, criar o modal global de perfil e tornar nomes de atletas da classificação/rankings clicáveis.
- `frontend`: `npm run typecheck` e `npm run build` concluídos com sucesso após integrar jogos na tela da temporada, mover o detalhe da súmula para modal fumê operacional, renderizar lançamento rápido por atleta, ajustar microcopy de criação de jogo e ajustar o logo `POKA PRÁTIKA`.
- `frontend`: `npm run typecheck` e `npm run build` concluídos com sucesso após migrar mensalidades para dashboard com modais de geração/registro e mover configurações de prêmios para modal fumê.
- `frontend`: `npm run typecheck` e `npm run build` concluídos com sucesso após reorganizar `config.` em home administrativa com modais para temporada, pontuação, usuário, importação Excel e edição individual de usuários.
- `frontend`: `npm run typecheck` e `npm run build` concluídos com sucesso após remover a bolinha amarela do logo e baixar `POKA`/`PRÁTIKA` em 2px no SVG.
- `backend`: `npm run typecheck` e `npm run build` concluídos com sucesso após a reforma final de UI para validar o conjunto full-stack antes da homologação.
- `backend`: `npm audit --audit-level=moderate` sem vulnerabilidades.
- `frontend`: `npm audit --audit-level=moderate` sem vulnerabilidades.
- Checagem do workspace sem erros ativos, sem `.env`, sem ORM operacional e sem `console.log`/`window.confirm`/`alert` operacional.
- `frontend`: remoção do pop-up global automático de confirmação de presença pendente; o acesso à confirmação ficou restrito ao card/modal do jogo e exige nova validação com `npm run typecheck`.
- `frontend`: refatoração visual do dashboard validada sem erros no editor em `frontend/src/App.tsx` e `frontend/src/styles.css`; `npm run typecheck` continua indisponível no ambiente atual porque `tsc` não está acessível via terminal do frontend.
- `frontend`: `npm install react-soccer-lineup` executado com sucesso para sustentar o fundo do campo no dashboard; diagnósticos do editor seguem sem erros em `frontend/src/App.tsx` e `frontend/src/styles.css`.
- `frontend`: `npm run typecheck` e `npm run build` concluídos com sucesso após o refinamento fino do dashboard principal alinhado à imagem de referência; o build ainda reporta um warning pré-existente de `@import` fora do topo em `frontend/src/styles.css`.
- `frontend`: `npm run build` concluído com sucesso após ampliar a ocupação horizontal do dashboard e substituir o fundo do hero por um único campo grande em verde escuro; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após remover o `pattern="lines"` do campo da biblioteca, centralizar um único gramado maior no hero e ampliar as áreas laterais do topo para eliminar cortes de status e botões; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após padronizar os botões de fechamento de modal como `X`; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após redesenhar a modal `Súmula Inteligente` para o novo layout visual em wizard; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após adicionar ícones e comprimir a `Súmula Inteligente` para eliminar a rolagem do modal principal; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após converter o stepper da `Súmula Inteligente` para o visual em pílulas conectadas; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após fazer a pílula do stepper da `Súmula Inteligente` envolver número + rótulo completo; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após compactar a lista de atletas selecionados da `Súmula Inteligente` para linhas únicas; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após dividir a lista de atletas selecionados da `Súmula Inteligente` em duas colunas quando houver mais de 6 nomes; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após deixar a lista de atletas selecionados da `Súmula Inteligente` sempre em duas colunas no desktop; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após simplificar o resultado do sorteio da `Súmula Inteligente` para linhas compactas clicáveis que alternam banco; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após mover o resultado do sorteio da `Súmula Inteligente` para um modal rápido de confirmação dos times; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após redesenhar a `Confirmação da rodada` para o layout da referência e reparar a estrutura interna do `App.tsx`; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após substituir os ícones de bola e refeição da `Confirmação da rodada`; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm install react-icons` executado e `npm run build` concluído com sucesso após migrar os ícones de bola e refeição da `Confirmação da rodada` para `react-icons`; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após separar a modal do jogo em duas etapas para coordenação (`Confirmação da rodada` → `Jogo e escalação`) com avanço automático ao salvar a confirmação; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após ocultar `Sua Resposta Recente` na etapa inicial de confirmação da coordenação, mantendo o avanço para `Jogo e escalação` somente depois do salvamento; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após redesenhar a etapa `Jogo e escalação` em formato de board operacional com gramado central e laterais de elenco; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após remover novamente toda a parte inferior da modal operacional e deixar apenas a `Confirmação da rodada`; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após reorganizar a aba `Mensalidades` em tabela ordenada por nome; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `backend`: `npm run build` e `frontend`: `npm run build` devem ser executados após a blindagem de mensalistas duplicados e a criação da migration manual de deduplicação por e-mail.
- `frontend`: `npm run build` concluído com sucesso após trocar a home da temporada de `DashboardMatchesPanel` para `MatchesPanel`, removendo do site o caminho legado que ainda renderizava a antiga área operacional da súmula; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após restaurar o hero visual de `DashboardMatchesPanel` (cores e gramado ao fundo) e manter sua modal limitada à `Confirmação da rodada`; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após restaurar a modal `Abrir súmula` do coordenador como board operacional e manter o hero visual de `DashboardMatchesPanel`; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após remover novamente o board de `Abrir súmula` da modal ativa e voltar o fluxo para `Confirmação da rodada` apenas; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após separar os cliques de `Confirmações` e `Abrir súmula` em modais diferentes no `DashboardMatchesPanel`; a modal nova da súmula ficou vazia por enquanto e o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após implementar o board visual dedicado da nova modal `Abrir súmula`, com cronômetro/placar, elencos laterais, campo tático, trocas e fechamento funcional; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após ampliar a modal `Abrir súmula`, compactar o board e semear automaticamente os times a partir das confirmações quando não houver escalação salva; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.
- `frontend`: `npm run build` concluído com sucesso após restaurar no card principal o botão sempre visível de `Confirmações`/`Confirmar presença` acima de `Abrir súmula`; o warning pré-existente de `@import` fora do topo em `frontend/src/styles.css` permanece sem bloquear o bundle.

## Próximo passo técnico recomendado

1. Em banco novo, executar `migrations/01_core_schema.sql` e depois as migrações incrementais aplicáveis em ordem crescente.
2. Em banco já existente, executar até `migrations/10_correcoes_auditadas_sumula.sql`, garantindo também `04`, `05`, `06`, `07`, `08` e `09` se ainda não tiverem sido aplicadas.
3. Subir backend e frontend na Railway com root directories corretos; para o erro atual de abertura de súmula, redeploy do backend é obrigatório porque a correção está no SQL da rota `/matches/:id`.
4. Conferir variáveis Railway: backend com `DATABASE_URL`, `NODE_ENV=production`, `PORT=8080`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `FRONTEND_URL` e credenciais Microsoft Graph; frontend com `VITE_API_URL`.
5. Garantir que já exista pelo menos um ADMIN ativo; em banco totalmente novo, usar o bootstrap seguro do backend de forma controlada antes de liberar o acesso público.
6. Cadastrar atletas reais por e-mail e deixar o sistema enviar o convite de ativação via Microsoft Graph.
7. Criar/abrir a temporada 2026 pelo painel `config.`.
8. Importar a tabela atual do Excel no painel administrativo usando preferencialmente a coluna `email` para casar cada linha com o usuário certo.
9. Conferir classificação, rankings, suspensões e cartões; depois usar apenas as novas súmulas confirmadas/corrigidas para continuidade da temporada.
10. Próxima etapa técnica: redeploy na Railway, executar as migrations pendentes no PostgreSQL em ordem e homologar os fluxos reais de aceite: login, trocar senha, criar jogo, iniciar súmula, lançar eventos rápidos, confirmar pontuação, registrar mensalidade, votar prêmios e operar `config.`.
