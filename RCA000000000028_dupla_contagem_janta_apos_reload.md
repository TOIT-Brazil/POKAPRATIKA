# RCA000000000028 - Dupla contagem de janta após recarga

## Sintoma

Uma única confirmação de janta podia aparecer como duas pessoas na página inicial.

## Causa raiz

A atualização adicionada no RCA 027 era aplicada depois de `onReload`. A recarga já retornava `attendanceDinnerPeople` com a resposta persistida e, em seguida, `applyAttendanceResult` somava a mesma contribuição novamente.

## Impacto

- Uma pessoa sem convidados podia ser exibida como duas.
- O total da janta ficava temporariamente acima do valor persistido.
- O campo numérico também podia ser interpretado como total de pessoas, embora represente convidados adicionais.

## Correção

Aplicar a resposta local antes da recarga e deixar a resposta da listagem como valor final autoritativo. Manter janta igual a zero quando `Fico para Janta?` não estiver selecionado. Renomear o campo numérico para indicar convidados adicionais.

## Prevenção

Atualizações otimistas devem ocorrer antes da reconciliação com o servidor; nunca aplicar um delta calculado sobre um agregado que já contém a gravação recém-concluída.