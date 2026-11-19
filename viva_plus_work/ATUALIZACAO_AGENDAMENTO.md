# Atualizar o VIVA+ — agendamento autônomo

1. Pare o servidor com `Ctrl+C` no terminal onde está rodando.
2. Faça uma cópia de segurança de `database/viva.sqlite` e do `.env` local.
3. Extraia o ZIP `VIVA_PLUS_AGENDAMENTO_AUTONOMO.zip` para a pasta que contém `viva_plus_work`, aceitando substituir os arquivos.
4. Não substitua nem apague `database/viva.sqlite` e mantenha o `.env` local. O pacote não contém banco local nem chave do Resend.
5. Abra um terminal em `viva_plus_work` e execute `npm start` (ou `npm run start`).
6. Entre como doador, abra Agendamentos, escolha unidade e data, confira a lista de horários e confirme uma vaga disponível.

Não é necessário executar `npm run demo:setup` novamente. A inicialização converte para `confirmed` apenas os agendamentos pendentes pertencentes às contas fictícias `@demo.viva`, quando não há conflito. Agendamentos legados de usuários reais são preservados.
