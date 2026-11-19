# VIVA+ — correções e testes

Base: pacote etapa 3 e índice de 32 bugs enviado em 11/11/2026.

Alterações aplicadas: importação de produção (já presente no pacote), configuração de proxy por TRUST_PROXY, limpeza do rate-limit, CORS com validação de origem, segurança de login, limites de cadastro, limpeza de senha, acesso protegido ao armazenamento local, atualização de /me, bloqueio de duplicatas de doações, vínculo de unidade, consulta de campanhas por datas e região, horário local de Brasília, limite de agendamentos por dia, ações de recusar/concluir, validação de tipo sanguíneo, atualização do diretório, código temporário de seis dígitos com uso único, acessibilidade, e migração de índice.

## Execução
1. Instale Node.js 22 e execute `npm ci`.
2. Copie `.env.example` para `.env` e defina JWT_SECRET forte.
3. `npm start` para desenvolvimento; `npm run build` e `NODE_ENV=production npm run start:prod` para produção.
4. Verifique o fluxo de cadastro, login, cancelamento, emissão e consumo do código temporário no painel institucional.

## Limitações
A publicação real, integração com hemocentros e testes completos de navegador/HTTP dependem de ambiente e credenciais. O agendamento é confirmado na agenda interna do VIVA+, mas não equivale a reserva em sistema externo do hemocentro nem a confirmação clínica de aptidão para doar. JWTs já emitidos não são revogados instantaneamente; para isso, requer-se armazenamento de sessão revogável.
