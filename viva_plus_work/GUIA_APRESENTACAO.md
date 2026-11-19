# Guia de apresentação do VIVA+

## Preparação local

1. Use Node.js 20 ou superior.
2. Execute `npm install`.
3. Execute `npm run demo:setup` para criar as contas e dados fictícios de apresentação.
4. Execute `npm start`.
5. Abra `http://localhost:5173`.

## Contas fictícias

| Perfil | E-mail | Senha |
|---|---|---|
| Doador | `doador@demo.viva` | `Demo@12345678` |
| Funcionário | `hemocentro@demo.viva` | `Demo@12345678` |
| Administrador | `admin@demo.viva` | `Demo@12345678` |

Use apenas no ambiente local de demonstração.

## 1. Doador

1. Entre como doador.
2. Abra **Minha carteira**.
3. Gere/atualize o código temporário de seis dígitos.
4. Observe a validade de 120 segundos e o histórico de doações fictícias.

## 2. Funcionário

1. Abra outra janela do navegador ou uma janela privada.
2. Entre como funcionário.
3. Digite o código exibido na carteira do doador e consulte.
4. Confira a identificação mínima apresentada e faça a conferência com documento oficial.
5. Somente após a doação ter ocorrido e a equipe responsável concluir os procedimentos, use **Registrar doação realizada**.
6. Não demonstre um botão de comparecimento ou cancelamento de atendimento: essas ações separadas não existem no fluxo ativo.

## 3. Confirmar no lado do doador

Volte à sessão do doador e atualize **Minha carteira**. O registro institucional deve aparecer no histórico e atualizar a contagem. O e-mail de confirmação só será enviado se o Resend estiver configurado e aceitar a solicitação; sem essa configuração, a doação é registrada normalmente e `notificationSent` permanece falso.

## 4. Administrador

1. Entre como administrador.
2. Consulte os indicadores agregados.
3. Crie/edite campanhas e gerencie seu status.
4. Cadastre funcionários e vincule-os a unidades.
5. Cadastre/edite unidades.
6. Consulte contas de doadores e ative/desative contas.
7. Consulte registros de doação e auditoria.

## Limites a explicar

- A unidade de demonstração e as contas `@demo.viva` são fictícias.
- O código temporário localiza uma carteira no banco VIVA+; não comprova identidade civil nem aptidão clínica.
- O registro é interno ao VIVA+ e não é comprovante oficial nem sincroniza com sistemas de hemocentros.
- Solicitações de agendamento no VIVA+ não reservam vaga no sistema externo da instituição.
- Benefícios são propostas, sem integração com Gov.br, transporte ou parceiros.
- O projeto não deve receber dados pessoais reais ou dados de saúde para a demonstração.
