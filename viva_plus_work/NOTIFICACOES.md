# Central de notificações do VIVA+

## Eventos registrados

- **Doação concluída:** quando o funcionário confirma uma doação no endpoint `POST /api/institution/donations`, o VIVA+ grava a notificação do doador na mesma transação da doação e da auditoria.
- **Nova campanha:** ao criar uma campanha ou reativar uma campanha pausada, o sistema cria notificações para doadores ativos que habilitaram `notification_campaigns`. Campanhas regionais respeitam a região cadastrada; campanhas com tipo sanguíneo respeitam o tipo declarado do doador. Campanhas nacionais alcançam todas as regiões.
- **Agendamento confirmado:** após a reserva imediata de um horário disponível no VIVA+, o doador recebe uma notificação de confirmação na área de agendamentos.

A restrição `UNIQUE(user_id, dedupe_key)` impede a criação repetida da mesma notificação para o mesmo usuário/evento.

## Comportamento da interface

- O sino abre uma página própria chamada **Notificações**, sem abrir campanhas ou qualquer outra área automaticamente. A página também aparece como item próprio no menu lateral do doador.
- O contador mostra quantas notificações ainda não foram lidas.
- A central consulta a API a cada 7 segundos enquanto a sessão de doador está aberta e a aba está visível.
- Uma notificação nova também gera um aviso visual temporário.
- Os avisos são apresentados em uma lista persistente na página Notificações. O botão “Marcar como lida” atualiza o estado do aviso e mantém o usuário na mesma página; não há redirecionamento automático ao abrir/ler um aviso.
- É possível marcar todas como lidas.
- As notificações são persistidas em SQLite e continuam disponíveis após sair e entrar novamente.

## Endpoints

- `GET /api/notifications` — lista as 40 notificações mais recentes da conta e o total não lido.
- `PATCH /api/notifications/:id/read` — marca uma notificação da própria conta como lida.
- `PATCH /api/notifications/read-all` — marca todas as notificações da própria conta como lidas.

Todos os endpoints exigem sessão autenticada de doador. Um usuário não pode ler nem alterar notificações de outra conta.

## Ativação em instalações existentes

A tabela `notifications` é criada automaticamente pelas migrações de `server/db.js` na próxima inicialização do backend. Não apague `database/viva.sqlite` e não execute `demo:setup` apenas para ativar notificações: a migração é aditiva e preserva as contas, campanhas e doações existentes.

## Limites desta versão

As notificações descritas aqui são notificações **dentro do VIVA+**. A interface atualiza a caixa enquanto a conta está aberta. Notificações push do navegador/sistema operacional não estão implementadas. Os e-mails transacionais de doação continuam sendo um canal separado e dependem do Resend corretamente configurado; avisos de campanha e agendamento não são enviados por e-mail nesta versão.
