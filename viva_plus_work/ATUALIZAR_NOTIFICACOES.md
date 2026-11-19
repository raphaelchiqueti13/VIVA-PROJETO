# Atualizar o VIVA+ com a central de notificações

O pacote não adiciona dependências npm. A nova tabela é criada automaticamente ao iniciar a API.

## Atualização preservando dados

1. Pare o VIVA+ no terminal com `Ctrl+C`.
2. Faça uma cópia de segurança da pasta do projeto, principalmente de `database/viva.sqlite` e `.env`.
3. Extraia `VIVA_PLUS_NOTIFICACOES_CORRIGIDAS.zip` **sobre a pasta que contém `viva_plus_work`**. No computador usado durante a orientação, o destino era `~/Documentos/VIVA_PLUS_1_0_CORRIGIDO`.
4. Autorize substituir os arquivos de código quando o sistema perguntar. O pacote não contém `database/viva.sqlite`, `.env` nem `node_modules`, portanto os dados, as credenciais locais e as dependências existentes não são sobrescritos.
5. Volte ao terminal, entre em `viva_plus_work` e execute `npm start`.

Não apague `database/viva.sqlite` e não execute `npm run demo:setup` para instalar notificações. A migração é automática e aditiva.

## Teste rápido

- Mantenha uma sessão de doador aberta em um navegador.
- Em outra sessão, publique uma campanha com região `Nacional` para alcançar doadores que mantiveram a preferência de campanhas ativada.
- O sino do doador deve abrir a página **Notificações** e mostrar um contador; em até 7 segundos o novo aviso aparece na lista e como aviso visual. A página também deve estar disponível no menu lateral.
- Em outra sessão institucional, valide uma doação do doador. O aviso “Doação concluída!” deve aparecer na página Notificações. Marcar o aviso como lido não deve mudar de página nem abrir campanhas/carteira.
- Um agendamento confirmado deve aparecer na página Notificações. Marcar esse aviso como lido também deve manter o usuário na central.

Uma campanha direcionada por região e tipo sanguíneo só notifica doadores ativos, inscritos e compatíveis com esses critérios. As notificações são internas ao VIVA+; não são notificações push do sistema operacional.
