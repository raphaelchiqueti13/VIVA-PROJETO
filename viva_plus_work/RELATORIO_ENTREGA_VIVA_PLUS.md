# VIVA+ 1.0 — relatório da revisão e correções

**Data:** 13/11/2026  
**Base:** arquivo ZIP fornecido nesta conversa e instruções de auditoria anexadas.  
**Escopo:** correções locais no código e documentação. Esta entrega não publica alterações em hospedagem nem configura a conta externa do Resend.

## Resultado por status

### CORRIGIDO E TESTADO

- Sintaxe dos módulos JavaScript do backend (`server/index.js`, `server/db.js`, `server/mail.js` e scripts de seed): `node --check` sem erros.
- Sintaxe do componente React (`src/main.jsx`): TypeScript `transpileModule` com zero diagnósticos.
- Schema SQLite: execução em banco temporário com `foreign_key_check` sem violações.
- Serviço de e-mail: `npm test` com 5 testes aprovados, cobrindo ausência de configuração, autenticação Bearer, endpoint Resend, idempotência, falha do provedor, escape de HTML e conteúdo dos modelos.
- Documentação dos perfis revisada para não afirmar que existe um fluxo separado de comparecimento/cancelamento de atendimento.

### IMPLEMENTADO, MAS NÃO TESTADO DE PONTA A PONTA

- Recuperação de senha com token aleatório de uso único, armazenado somente como hash, validade de 30 minutos e invalidação de sessões antigas.
- Alteração de senha autenticada com conferência da senha atual, limite de 72 bytes por compatibilidade bcrypt, hash bcrypt e revogação das demais sessões.
- Envio por Resend, feito exclusivamente no backend, com timeout, chave de idempotência, modelos HTML/texto e logs sem credenciais.
- E-mail transacional após alteração de senha e após registro de doação.
- Gestão administrativa de contas de doadores com ativação/desativação sem apagar histórico.
- Preservação de doações e encerramento de campanhas em vez de exclusão destrutiva.
- Permissões de campanha e cancelamento de solicitação limitadas ao perfil doador.
- Validação do código da carteira, criação da autorização do funcionário e log de auditoria na mesma transação imediata.
- Registro de doação com verificação transacional de duplicidade e consumo da autorização do funcionário.
- Consulta de disponibilidade por unidade/data e reserva imediata com status `confirmed`, limite diário, tratamento de conflito e auditoria dentro de transação imediata.
- Índices únicos parciais para evitar duplicidade de doação por doador/data e conflito de horários ativos; em bancos legados com duplicidades, a migração preserva os dados e registra aviso em vez de apagá-los.
- Invalidação de sessões ao desativar/reativar contas, mudar unidade do funcionário ou desativar/reativar a unidade.

### DEPENDENTE DE CONFIGURAÇÃO EXTERNA

- Revogar a chave que aparece na imagem enviada e gerar uma chave nova no Resend com permissão de envio.
- Verificar o domínio remetente no Resend e definir `RESEND_FROM_EMAIL` com endereço desse domínio.
- Configurar `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `APP_URL` no `.env` local ou painel de variáveis secretas da hospedagem. Em produção, `APP_URL` deve ser HTTPS.
- Configurar domínio, HTTPS, DNS e ambiente de hospedagem. Nenhuma chave foi incluída no código, no frontend, no `.env.example` ou neste pacote.

### PENDENTE

- Build de produção (`npm run build`), pois a instalação de dependências não concluiu no ambiente desta execução; o binário Vite não ficou disponível.
- Testes HTTP automatizados completos da API, fluxos de autenticação, testes no navegador e responsividade em dispositivos reais.
- Teste de entrega real de e-mails com uma chave nova e domínio validado. Nenhum envio real foi realizado por esta revisão.
- Migração do token em `localStorage` para cookie `HttpOnly`, `Secure`, `SameSite` com proteção CSRF.
- Rate limiting compartilhado para múltiplas instâncias, backups com restauração testada, monitoramento e resposta a incidentes.
- Verificação de e-mail no cadastro e automações de campanhas/lembretes.
- Revisão independente de segurança, validação de acessibilidade com tecnologias assistivas e análise jurídica/LGPD.
- Resolver manualmente eventuais duplicidades legadas indicadas pelos logs de migração antes de exigir os novos índices únicos em banco já populado.

## Arquivos principais alterados/adicionados

- `server/mail.js`, `server/mail.test.js`
- `server/index.js`, `server/db.js`
- `database/schema.sql`
- `src/main.jsx`
- `.env.example`, `.gitignore`, `render.yaml`, `package.json`, `package-lock.json`
- `README.md`, `AUDITORIA_VIVA_PLUS.md`, `GUIA_RESEND.md`, `GUIA_APRESENTACAO.md`, `ALTERACOES_FUNCIONARIO_ADMIN.md`, `TESTES_DEMO.md`

## Instrução de segurança urgente

A chave de API visível na captura foi exposta. Revogue-a no painel Resend. **Não envie a chave nova pelo chat**. Configure-a diretamente como variável secreta no servidor ou ambiente de hospedagem. O código já está preparado para recebê-la com o nome `RESEND_API_KEY`.

## Conclusão

O pacote contém correções concretas e os testes locais listados acima passaram. Entretanto, sem build, testes ponta a ponta, configuração real do Resend, domínio/HTTPS e validações independentes, o VIVA+ deve ser considerado **preparado para nova rodada de testes e demonstração controlada**, não certificado nem pronto para operação real com dados pessoais ou dados de saúde.


## Complemento — central de notificações (13/11/2026)

- Criada tabela persistente `notifications` com chave de deduplicação por usuário/evento, índice de não lidas e migração aditiva.
- Implementada notificação de doação concluída dentro da mesma transação da validação.
- Implementada distribuição de novas campanhas aos doadores ativos inscritos, respeitando região e tipo sanguíneo quando direcionados.
- Reativar campanha pausada também gera aviso (sem duplicar o mesmo evento).
- Agendamentos agora consultam horários disponíveis, reservam uma vaga interna por horário e confirmam imediatamente no VIVA+; a confirmação gera notificação persistente.
- Implementados endpoints autenticados para listar, marcar uma e marcar todas como lidas.
- O sino deixou de navegar diretamente para campanhas e passou a abrir uma central com badge, atualização periódica e aviso visual para eventos novos.
- Destinos corrigidos: doação → carteira/histórico; campanha → campanhas; agendamento → agendamentos. Campanhas futuras publicadas ficam visíveis como programadas para que o destino do aviso tenha conteúdo.

**Validação desta alteração:** 8 testes unitários do módulo de e-mail/notificações aprovados; `node --check` do backend e da camada de persistência aprovados; parser TypeScript transpileModule confirmou a sintaxe JSX sem erros; `database/schema.sql` executado em SQLite em memória e tabela/índices conferidos. O `npm run build` não foi executado com sucesso porque Vite não está instalado neste ambiente e a tentativa de instalar dependências expirou. O teste E2E com banco real e navegador ainda depende da instalação local das dependências nativas (`better-sqlite3`).

## Correção complementar — central de notificações como página própria

- O clique no sino agora navega para a página `Notificações` (`page="notificacoes"`) e atualiza a lista via API.
- A central também aparece como item independente no menu lateral do doador.
- O clique em “Marcar como lida” atualiza somente o estado da notificação; não navega para campanhas, carteira ou agendamentos.
- Removido o menu flutuante antigo do sino e seus estilos associados.
- Testes adicionais: 2 testes de contrato da interface, para garantir o destino do sino e impedir redirecionamento ao marcar como lida.
- Verificações: `npm test` — 10/10 aprovados; análise sintática JSX com TypeScript — 0 diagnósticos.
- `npm run build` não foi concluído neste ambiente porque os binários do Vite não estão instalados no `node_modules` disponível. Não declarar build de produção aprovado até executar `npm install` e `npm run build` na máquina de desenvolvimento.
## Correção adicional — agendamento autônomo

- O doador consulta horários disponíveis por unidade e data.
- Os horários ocupados ou passados aparecem indisponíveis.
- A reserva de um horário livre é confirmada imediatamente no VIVA+, sem aprovação manual.
- A confirmação, notificação e auditoria são persistidas na transação.
- Uma restrição única e a transação impedem duas reservas para a mesma unidade/data/horário, inclusive em tentativas simultâneas.
- A agenda interna não está integrada ao calendário/sistema externo do hemocentro; a confirmação não substitui a triagem presencial.

Testes específicos das regras de disponibilidade: 4/4 aprovados com `node --test server/appointments.test.js`. Suite completa: 14/14 testes aprovados com `node --test`. O JSX dos componentes principais foi analisado via TypeScript `transpileModule` sem diagnósticos; build Vite não foi concluído porque a instalação de dependências ficou incompleta neste ambiente.

