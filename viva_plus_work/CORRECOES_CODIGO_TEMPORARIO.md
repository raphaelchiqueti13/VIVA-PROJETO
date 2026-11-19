# VIVA+ — substituição do QR Code por código temporário

## Por que
O fluxo anterior dependia de câmera/leitor de QR, URL alcançável a partir do celular e autenticação no segundo dispositivo. Para um protótipo executado localmente, isso criava atrito desnecessário.

## Novo fluxo
1. O doador abre “Minha carteira” e apresenta um código numérico de 6 dígitos.
2. O código é emitido sob autenticação, expira em 120 segundos e é renovado automaticamente.
3. O funcionário autenticado como hemocentro/administrador digita o código em “Localizar carteira”.
4. O servidor compara somente o HMAC-SHA-256 com o segredo da aplicação, consome o código atomicamente e retorna nome e ID interno do doador.
5. O funcionário confere a identidade com documento oficial. O registro de doação permanece uma ação separada e explícita.

## Segurança e limites
- O código não é senha permanente nem prova de identidade civil.
- Um código só pode ser usado uma vez; a emissão de outro invalida os anteriores do doador.
- O banco armazena hash, não o número em texto claro.
- A rota institucional exige autenticação e perfil autorizado e tem limite de 8 tentativas por janela/IP no rate limiter local existente. Em produção com várias instâncias, o limitador deve ser compartilhado (ex.: Redis/gateway).
- A consulta não retorna tipo sanguíneo ou dados clínicos.
- A confirmação da doação exige ação separada e confirmação humana.
- QR e câmera foram removidos do fluxo apresentado; a tabela antiga `qr_verifications` foi preservada por compatibilidade, mas não é mais usada.

## Validação necessária
O build e os testes HTTP devem ser executados no ambiente de desenvolvimento com `npm install`, `npm run build`, `npm start` e contas de demonstração. Antes de uso real, exigir teste de segurança, revisão jurídica, política de retenção e auditoria de logs/acessos.
