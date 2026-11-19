# Verificações da demonstração

## Verificações estáticas e automatizadas desta entrega

- Sintaxe do backend verificada com `node --check`.
- Sintaxe JSX do frontend verificada com o compilador TypeScript disponível no ambiente.
- Schema SQLite executado em banco temporário com `sqlite3`.
- Testes automatizados do módulo de e-mail via Node Test Runner (`npm test`).
- O módulo de e-mail verifica configuração ausente, autorização Bearer, cabeçalho de idempotência, resposta negativa do provedor, escape de HTML e modelos de e-mail.
- A rota de consulta da carteira consome código, cria autorização e grava auditoria em transação única.
- A rota de doação consome a autorização, insere a doação, atualiza última doação e grava auditoria em transação.
- A listagem de campanhas é restrita a doadores; rotas de gestão administrativa exigem administrador; rotas institucionais exigem funcionário.
- O fluxo operacional atual não possui endpoints de comparecimento separado ou cancelamento de atendimento. A tabela legada `attendance_records` é preservada e não é apresentada como funcionalidade ativa.

## Verificações manuais necessárias no ambiente de execução

1. `npm install`
2. `npm test`
3. `npm run build`
4. `npm run demo:setup`
5. `npm start`
6. Conferir login dos três perfis e navegação exclusiva de cada papel.
7. Emitir código da carteira, verificar código válido, expirado e reutilizado.
8. Registrar doação e tentar duplicidade no mesmo dia.
9. Testar agendamento, conflito do mesmo horário e limite de duas solicitações ativas por dia.
10. Testar redefinição de senha com Resend configurado: token válido, token expirado, token reutilizado e revogação de sessões.
11. Testar envio de confirmação de doação com remetente/domínio verificados.
12. Inspecionar a interface em celular, tablet e desktop e validar acessibilidade com leitor de tela.

**Limitação desta execução:** a instalação completa das dependências falhou por indisponibilidade/timeout do registry npm no ambiente de trabalho. Portanto, build Vite, servidor HTTP, testes de API e navegador não foram executados aqui. Não considerar os itens manuais acima aprovados até executá-los localmente.
