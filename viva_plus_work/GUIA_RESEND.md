# Configuração do Resend no VIVA+

A integração foi implementada exclusivamente no backend. O navegador nunca recebe nem conhece `RESEND_API_KEY`.

## 1. Proteja a chave que apareceu na captura de tela

A captura fornecida nesta conversa mostra uma chave de API. Considere-a exposta: revogue-a no painel do Resend e gere uma nova chave com permissão **Sending access**, limitada ao domínio remetente quando essa opção estiver disponível. Não reutilize a chave da captura.

## 2. Verifique o domínio remetente

No Resend, cadastre e conclua a verificação DNS do domínio que será usado no remetente. Use um endereço do domínio verificado, por exemplo:

```text
VIVA+ <nao-responda@seudominio.com.br>
```

O remetente precisa ser aceito pela conta do Resend. O domínio de teste `onboarding@resend.dev` não deve ser tratado como remetente de produção.

## 3. Configure as variáveis no servidor

No desenvolvimento, copie `.env.example` para `.env` e preencha:

```env
RESEND_API_KEY=re_nova_chave_guardada_localmente
RESEND_FROM_EMAIL=VIVA+ <nao-responda@seudominio.com.br>
APP_URL=http://localhost:5173
```

Em produção, configure as mesmas variáveis no painel de segredos/Environment do serviço de hospedagem, com `APP_URL` apontando para o domínio público HTTPS do VIVA+.

**Não** coloque a chave em `src/`, em `VITE_*`, no `package.json`, em screenshots, no Git ou em arquivos ZIP que serão compartilhados. Não envie o valor da chave no chat.

## 4. O que já envia e-mail

- Solicitação de recuperação de senha: link aleatório, armazenado no banco somente como hash, validade de 30 minutos e uso único.
- Alteração/redefinição de senha: alerta de segurança quando o Resend confirma o envio.
- Registro de doação realizado pela unidade: confirmação ao endereço cadastrado quando o Resend confirma o envio.

O backend não informa sucesso de envio sem confirmação do Resend. Falhas são registradas no log do servidor sem gravar a chave, o token de redefinição ou o conteúdo sensível do e-mail. A resposta do pedido de recuperação é uniforme para reduzir enumeração de contas.

## 5. Como testar

1. Reinicie o backend após salvar as variáveis.
2. Na tela de login, selecione **Esqueci minha senha**.
3. Solicite a recuperação usando uma conta de teste cujo e-mail você controla.
4. Abra o e-mail e use o link antes de completar 30 minutos.
5. Tente reutilizar o mesmo link: o backend deve rejeitar.
6. Altere a senha em **Configurações** e confirme que outras sessões precisam entrar novamente.
7. Registre uma doação no ambiente de demonstração e verifique a confirmação transacional.

A entrega deste código não configura DNS, não valida o domínio nem envia um e-mail real. Esses passos dependem da conta, da chave nova e do domínio do mantenedor.
