# RCA000000000072 - Horários fixos na criação do jogo

## Sintoma

O modal principal `Criar jogo` exibia somente o horário `20:00` em um campo bloqueado, não permitia informar o horário final e criava jogos avulsos ou recorrentes com a janela fixa das 20:00 às 21:00.

## Causa raiz

O fluxo principal de criação não reutilizou o contrato temporal já existente na Agenda. A interface omitia `scheduledStart` e `scheduledEnd` na criação do jogo base e enviava literalmente `20:00` e `21:00` ao gerar recorrências. Os defaults do backend, destinados à compatibilidade, acabaram tratados como regra universal do produto.

## Impacto

Grupos que jogam em outros horários ou por períodos diferentes de uma hora não conseguiam cadastrar sua janela real. Como o tempo útil do rodízio é calculado entre o início efetivo (`started_at`) e o horário final agendado (`scheduled_end`), a janela incorreta também produzia uma cadência de substituições inadequada ao tempo disponível.

## Correção

Permitir a edição obrigatória dos horários de início e fim no modal principal, validar que o fim seja posterior ao início e persistir ambos no jogo base e nas recorrências. Preservar o cálculo autoritativo existente: antes do início, a previsão usa o horário agendado; depois do botão `Iniciar jogo`, o tempo útil passa a ser o intervalo entre `started_at` e `scheduled_end`.

## Prevenção

Defaults de compatibilidade não devem substituir parâmetros operacionais que variam entre grupos. Todo fluxo que cria uma partida deve coletar e enviar explicitamente a janela completa de uso.

## Resultado esperado

- Jogos podem começar e terminar em qualquer horário válido do mesmo dia.
- Jogos com duração menor ou maior que uma hora persistem a janela informada.
- Recorrências reutilizam os horários escolhidos no jogo base.
- O atraso real no início reduz o tempo disponível até o fim agendado e recalcula a cadência das substituições.