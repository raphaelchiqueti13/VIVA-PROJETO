# Agendamento autônomo — VIVA+

## Fluxo do doador

1. O doador escolhe uma unidade verificada e uma data.
2. A tela consulta `GET /api/appointments/availability?hemocenterId=<id>&date=AAAA-MM-DD`.
3. O backend lista os horários livres/ocupados, exclui horários passados e retorna a disponibilidade atual.
4. O doador escolhe um horário livre e confirma.
5. `POST /api/appointments` revalida a disponibilidade dentro de uma transação SQLite `BEGIN IMMEDIATE` e insere o agendamento com status `confirmed`.
6. A mesma transação grava a notificação “Agendamento confirmado!” e a auditoria.
7. O horário deixa de aparecer como disponível para os outros doadores. Se outra pessoa reservar primeiro, a segunda tentativa recebe HTTP 409 e a tela atualiza a disponibilidade.

## Horários e capacidade

A agenda interna oferece 12 horários: 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 13:00, 13:30, 14:00, 14:30 e 15:00. Cada unidade tem uma vaga por horário. Reservas em status `pending` (registros legados) e `confirmed` bloqueiam o mesmo horário; horários cancelados liberam a vaga.

## Proteções

- Validação da data e do formato/allowlist de horário no backend.
- Consulta e inserção sob transação imediata.
- Índice único parcial para unidade + data + hora em registros ativos (`pending`/`confirmed`).
- Limite de até dois agendamentos ativos por doador/data.
- Cancelamento libera o horário novamente.
- Registros antigos permanecem no banco; apenas reservas fictícias de contas `@demo.viva` pendentes são convertidas com segurança para `confirmed` durante a inicialização, sem alterar pendências de usuários reais.

## Limite de integração

“Confirmado” significa confirmado na agenda interna do VIVA+. A aplicação não consulta, cria nem altera reservas em sistemas externos de hemocentros. Antes de usar com uma unidade real, o responsável precisa validar com a instituição os dias, horários, capacidade e processo de chegada. A confirmação de horário não é aprovação clínica nem garantia de que a pessoa poderá doar; a triagem presencial continua sob responsabilidade da equipe de saúde.
