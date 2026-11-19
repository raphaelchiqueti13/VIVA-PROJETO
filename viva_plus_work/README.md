## Selos ligados aos benefícios (12/11/2026)

Os benefícios de `Propostas e benefícios` agora dependem do selo do doador (regras em `src/benefits.js`, usadas também em "Meus selos" e na carteira):

| Selo | Doações validadas | Propostas desbloqueadas |
|---|---|---|
| Bronze | 1+ | Cultura e lazer |
| Prata | 3+ | Reconhecimento universitário; ações preventivas e vacinação |
| Ouro | 5+ | Vestibulares/exames; atendimento administrativo prioritário |
| Diamante | 10+ | Passagem com 70% de desconto; reforço do nível da conta Gov.br |

Os benefícios são cumulativos. Continuam sendo **propostas**: não há integração com Gov.br nem com operadores de transporte, e a doação segue voluntária e não remunerada.

## Correções aplicadas em 11/11/2026

- Corrigidas expressões regulares do servidor que impediam a validação correta de e-mail, datas e horários e a leitura do token Bearer.
- Mensagem clara na interface quando a API estiver desligada ou inacessível.
- Tratamento de sessão expirada e exibição de erros na carga inicial.
- Datas iniciais do formulário calculadas no fuso local do navegador.
- Incluído roteiro de verificação rápida (`TESTES_APRESENTACAO.md`).

**Validação nesta entrega:** sintaxe do backend conferida com `node --check`; a instalação completa das dependências e os testes de ponta a ponta não puderam ser concluídos neste ambiente. Execute os testes guiados antes da apresentação.

# VIVA+ — Carteira Digital do Doador

Aplicação acadêmica com frontend React/Vite, API Node/Express e banco SQLite. Esta versão remove unidades fictícias e melhora os fluxos internos de autenticação, diretório, agendamentos, código temporário da carteira e área institucional.

> **Limite de uso:** o VIVA+ não é um sistema oficial de hemoterapia. Não substitui triagem clínica, prontuário, carteira oficial ou agendamento nos sistemas de hemocentros. Não cadastre dados reais de saúde até concluir revisão jurídica, segurança, privacidade/LGPD e parceria institucional.

## O que foi melhorado

- O diretório operacional fica vazio até o administrador cadastrar unidades reais com fonte HTTPS conferida. Separadamente, `demo:setup` cria uma unidade explicitamente fictícia, identificada como demonstração, somente para apresentação local.
- Cadastro de unidades reais com fonte oficial, além de unidades fictícias de demonstração marcadas explicitamente; edição, vínculo e ativação/desativação administrativa.
- Agendamentos usam disponibilidade por unidade e data, com uma vaga interna por horário. O doador consulta horários livres e a reserva fica **confirmada imediatamente no VIVA+**; a operação não sincroniza com sistemas externos do hemocentro.
- Ambientes separados: funcionário com tela única de atendimento e administrador com painel exclusivo de gestão.
- Código temporário da carteira com seis dígitos, validade de 120 segundos, HMAC-SHA-256 no banco, uso único e verificação exclusiva por perfil institucional autenticado.
- Tela exclusiva do funcionário para digitar o código temporário apresentado pelo doador, sem precisar de câmera ou leitor externo.
- Registro institucional de doação realizada após consulta recente da carteira; a autorização é vinculada ao funcionário e consumida na mesma transação que grava a doação e a auditoria. Não há etapa operacional separada de comparecimento.
- Respostas institucionais deixam de expor e-mails dos doadores na listagem.
- JWT com emissor/audiência, segredo obrigatório em produção, limitação básica de tentativas em autenticação e cabeçalhos de segurança.
- Frontend e API podem ser servidos no mesmo domínio em produção; Vite faz proxy `/api` durante desenvolvimento.
- Migrações aditivas preservam os dados de instalações anteriores; a migração de agendamentos preserva registros existentes.
- Central de notificações persistentes: doação validada, campanha publicada para o perfil do doador e agendamento confirmado. O sino abre a caixa, mostra contador de não lidas e cada tipo leva à área correta.

## O que continua dependendo de terceiros

Não há API pública universal conectada a todos os hemocentros. Para usar dados reais, o administrador deve conferir nome, endereço, telefone, horário e URL diretamente em fonte oficial e cadastrar essa referência no painel. O link externo de agendamento é apenas um atalho para o sistema da instituição; não sincroniza reservas.

Ainda não há integração automática com Gov.br, prontuários, sistemas clínicos, transporte público ou benefícios. O backend possui envio transacional por Resend para recuperação de senha, alerta de alteração de senha e confirmação de doação. Os avisos de doação, campanha e confirmação de agendamento são exibidos na central interna do VIVA+; campanhas e agendamentos não disparam e-mail nesta versão. Lembretes automáticos de elegibilidade ainda não estão implementados. O envio de e-mail depende de chave, remetente/domínio verificados e URL pública configuradas no servidor. A verificação do código temporário apenas localiza uma carteira dentro do VIVA+; não confirma identidade civil nem aptidão para doar.

## Requisitos

- Node.js 20+
- npm
- Em Linux, `build-essential`, `python3`, `make` e `g++` podem ser necessários para compilar `better-sqlite3`.

## Rodar localmente

```bash
npm install
npm run demo:setup
npm start
```

O comando `demo:setup` cria/atualiza contas locais de demonstração, uma unidade fictícia claramente identificada e registros ilustrativos. As três contas possuem ambientes separados: doador (carteira), funcionário (tela única de atendimento) e administrador (gestão). Não use essas contas em produção. Para operação real, configure as variáveis do `.env`, especialmente `JWT_SECRET`, conforme a seção de hospedagem.

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/health

Gerar build de produção:

```bash
npm run build
NODE_ENV=production npm run start:prod
```

Em produção, o Express serve o conteúdo de `dist/` e a API no mesmo domínio.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `NODE_ENV` | Use `production` em produção. |
| `PORT` | Porta fornecida pelo provedor de hospedagem. |
| `JWT_SECRET` | Segredo aleatório forte; obrigatório em produção (mínimo 32 caracteres). |
| `DATABASE_PATH` | Caminho do SQLite. Use disco persistente, por exemplo `/var/data/viva.sqlite`. |
| `CORS_ORIGINS` | Origens adicionais permitidas, separadas por vírgula, se frontend e API estiverem em domínios diferentes. |
| `VITE_API_URL` | URL da API durante o build; padrão `/api` para mesmo domínio. |
| `APP_URL` | Origem pública do frontend usada nos links de recuperação; HTTPS obrigatório em produção. |
| `RESEND_API_KEY` | Chave secreta de envio do Resend, somente no servidor. |
| `RESEND_FROM_EMAIL` | Remetente pertencente a domínio verificado no Resend. |
| `CSP_CONNECT_SRC` | Origens adicionais permitidas em `connect-src` quando necessário. |

## Agendamento autônomo

O doador consulta `GET /api/appointments/availability?hemocenterId=...&date=AAAA-MM-DD` e vê os horários livres da unidade/data. A reserva usa `POST /api/appointments` e recebe status `confirmed` imediatamente, sem aprovação manual. Há uma vaga por horário e unidade; horários passados e já ocupados são retornados como indisponíveis. O backend valida a disponibilidade novamente dentro de uma transação e o índice único impede duas reservas para o mesmo horário. Os horários padrão do VIVA+ são 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 13:00, 13:30, 14:00, 14:30 e 15:00.

**Limite:** essa confirmação é válida na agenda interna do VIVA+. Não há integração com os calendários ou sistemas externos dos hemocentros. Antes de usar com uma unidade real, os horários internos precisam ser acordados e configurados de acordo com o funcionamento autorizado da instituição.

## Central de notificações

A central interna persiste avisos no SQLite e respeita a conta autenticada. A doação validada gera uma notificação na mesma transação do registro; campanhas publicadas notificam doadores ativos inscritos, com filtragem por região e tipo sanguíneo quando aplicável; agendamentos confirmados geram aviso de confirmação. O sino abre a lista, o contador mostra avisos não lidos, e os cliques levam à carteira, campanhas ou agendamentos conforme o evento. Consulte `NOTIFICACOES.md` para endpoints, regras e limites (notificações push do sistema operacional não estão disponíveis).

## E-mails transacionais

A recuperação de senha usa tokens aleatórios de uso único, guardados como hash e válidos por 30 minutos. A troca de senha incrementa `auth_version` e invalida sessões JWT existentes. O envio via Resend é implementado no backend; configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `APP_URL` conforme `GUIA_RESEND.md`. A chave nunca deve ter prefixo `VITE_` nem ser armazenada no frontend.

## Hospedagem

Há um `render.yaml` de referência para um serviço Render com disco persistente. O plano configurado requer suporte a disco persistente. Antes de publicar:
1. Revise as variáveis de ambiente e confirme que `JWT_SECRET` foi gerado pelo provedor.
2. Confirme que o disco está montado em `/var/data` e que `DATABASE_PATH=/var/data/viva.sqlite`.
3. Não use SQLite em armazenamento efêmero: os dados podem desaparecer em reinicializações/deploys.
4. Teste `/api/health`, cadastro, login, campanhas, agendamentos, emissão/consumo de código temporário e permissões institucionais.
5. Configure domínio/HTTPS e política de backup do banco.

Para escala com múltiplas instâncias, migre para PostgreSQL com migrações versionadas; SQLite em disco persistente é adequado apenas para uma instância pequena.

## Diretório de hemocentros

O diretório começa vazio intencionalmente. Um administrador deve:
1. Criar uma conta de usuário normal e promovê-la a `admin` usando o procedimento abaixo.
2. Consultar a fonte oficial da unidade e inserir os dados conferidos no formulário **Cadastrar unidade real**.
3. Informar a URL oficial da fonte e, se existir, a URL oficial de agendamento.
4. Criar a conta da instituição, promovê-la a `hemocenter` e vinculá-la à unidade.

Não use endereços ou horários presumidos. A URL informada deve ser HTTPS.

## Provisionamento inicial de perfis

O cadastro público cria somente contas de doador. Para criar o primeiro administrador local, registre uma conta pela interface e execute no SQLite:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@exemplo.com';
```

Saia e entre novamente para receber um token com o novo perfil. Após cadastrar uma unidade no painel, crie a conta da instituição e vincule-a:

```sql
UPDATE users
SET role = 'hemocenter', hemocenter_id = 1
WHERE email = 'unidade@exemplo.com';
```

Substitua o ID pelo ID real da unidade cadastrada. Faça o provisionamento somente para pessoas autorizadas, com consentimento e controle institucional.

## Banco de dados

O schema fica em `database/schema.sql`; o banco local é criado em `database/viva.sqlite`. Tabelas principais:
- `users`
- `hemocenters`
- `donation_records`
- `appointments`
- `campaigns`
- `audit_logs`
- `qr_verifications`

As migrações adicionam campos sem apagar usuários existentes. A instalação anterior que continha unidades fictícias precisa de revisão manual: unidades antigas não são exibidas porque não possuem `verified_at`. Um administrador deve desativar/remover esses registros e cadastrar dados oficiais conferidos.

## Segurança e privacidade — antes de uso público

Este código é uma base acadêmica melhorada, não uma certificação de segurança. Antes de usar dados pessoais reais:
- Fazer revisão independente de segurança e testes automatizados.
- Verificação de e-mail no cadastro ainda pendente; recuperação de senha e e-mails transacionais foram implementados nesta versão.
- Usar rate limiting compartilhado (Redis/gateway) se houver múltiplas instâncias.
- Configurar logs, monitoramento, backup e política de retenção.
- Definir base legal, consentimento quando aplicável, direitos dos titulares, controlador/operador e política de privacidade LGPD.
- Minimizar dados pessoais: a tela institucional não deve usar dados além do necessário.
- Validar acessibilidade com leitores de tela e usuários.
- Formalizar parcerias e fluxos com instituições de hemoterapia.
- Fazer auditoria técnica das regras de elegibilidade; o sistema não decide aptidão para doação.

## E-mails transacionais — Resend

A API usa o endpoint oficial `POST https://api.resend.com/emails` a partir do backend. Configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `APP_URL` em `.env` (local) ou no painel de variáveis secretas da hospedagem. A chave deve ter permissão de envio e o domínio do remetente precisa estar verificado. Consulte `GUIA_RESEND.md`.

A recuperação gera token aleatório de uso único com validade de 30 minutos; somente o hash fica no banco. A redefinição incrementa `auth_version`, revogando tokens JWT já emitidos. Alertas de senha e confirmações de doação são enviados somente quando o provedor confirma o aceite. Verificação de e-mail no cadastro e disparos de campanhas/lembretes ainda não foram implementados.

## Acessibilidade

O painel oferece escala de texto, alto contraste, redução de animações, sublinhado de links e atalho `Alt + Shift + A`. O widget VLibras é carregado externamente pelo script oficial; consulte a política de privacidade e `AJUSTES_HOME_LIBRAS.md` para os limites e o tratamento pelo serviço de terceiros.

## Página de Impacto (investidores)

`src/Impact.jsx` consome `GET /api/public/impact`, que devolve apenas métricas agregadas e anônimas calculadas do banco. Dados do contexto nacional citam o Ministério da Saúde (2023). Para demonstração, `npm run seed:apresentacao` gera dados fictícios e a interface os sinaliza como tal.

## Requisitos para doar

A página **Requisitos para doar** (`src/Requirements.jsx`) reúne os critérios gerais de aptidão (idade, peso, intervalo, preparo e impedimentos temporários mais comuns), com calculadora local de próxima doação. Base: Portaria GM/MS nº 11.685/2026, em vigor desde 30/09/2026. É conteúdo informativo; a aptidão é decidida na triagem presencial. Revise os textos quando houver nova portaria.


## Transparência, privacidade e interface (13/11/2026)

- Incluídos textos preliminares de privacidade e termos, aviso de cookies/armazenamento e painel de preferências.
- O cadastro público foi reduzido a nome, e-mail, senha, tipo sanguíneo opcional e região opcional. Campos antigos permanecem no schema por compatibilidade, mas não são solicitados no cadastro nem devolvidos pelo endpoint de usuário.
- Removidas fontes externas Google Fonts; o widget oficial VLibras permanece carregado por script externo. Não foram identificados analytics ou pixels de publicidade no código revisado.
- Adicionados refinamentos visuais e animações com respeito à preferência de movimento reduzido.
- Consulte `AUDITORIA_VIVA_PLUS.md` para a matriz dos 17 itens, riscos remanescentes e limitações dos testes.

## Segurança e privacidade — pré-requisitos antes de produção

- Configure `JWT_SECRET` com pelo menos 32 caracteres aleatórios; não reutilize o segredo de desenvolvimento.
- Em hospedagem atrás de proxy reverso confiável, configure `TRUST_PROXY=true` (já indicado no `render.yaml`). Não ative essa opção em uma exposição direta não protegida.
- Se frontend e API forem publicados em origens diferentes, configure `CORS_ORIGINS` e `CSP_CONNECT_SRC` com as origens HTTPS estritamente necessárias.
- O token ainda é mantido no `localStorage`; planeje migração para cookie `HttpOnly`, `Secure`, `SameSite` e proteção CSRF antes de tratar dados reais de saúde.
- Não use os scripts `seed:demo` ou `seed:apresentacao` com dados reais. Os scripts são bloqueados quando `NODE_ENV=production`.
- Antes de operação pública, identifique o controlador, publique canal de privacidade, estabeleça base legal para dados sensíveis, retenção/descarte, contratos com operadores e processo de atendimento aos titulares.

A Content Security Policy e os cabeçalhos de proteção são definidos no servidor. `CSP_CONNECT_SRC` aceita origens adicionais separadas por vírgula apenas quando a API precisar operar em outro domínio.


## Validação da carteira por código temporário

O fluxo principal não depende mais de QR Code, câmera ou domínio público. Na carteira do doador, o sistema solicita um código numérico de 6 dígitos com validade de 120 segundos. O funcionário, autenticado e vinculado a uma unidade ativa, digita o código na tela exclusiva “Validar carteira do doador”. O servidor armazena somente um HMAC-SHA-256 calculado com o segredo da aplicação, consome o código em uma transação atômica e aplica limite de tentativas. A consulta cria uma autorização curta vinculada ao funcionário e ao doador; a confirmação da doação exige essa autorização recente, ainda não consumida, e não permite registro duplicado para o mesmo doador no mesmo dia. A consulta localiza a carteira, mas não substitui documento oficial, triagem clínica ou decisão dos profissionais de saúde.


## Ambientes e permissões

- **Doador:** mantém a navegação e as funcionalidades de carteira, histórico, campanhas, solicitações de agendamento e preferências.
- **Funcionário:** acessa somente uma tela para consultar o código temporário de seis dígitos e registrar doação realizada após a conferência da equipe. Não possui painel de indicadores, cadastro de doadores, campanhas ou gestão. Não existe registro separado de comparecimento na versão ativa.
- **Administrador:** acessa gestão administrativa: indicadores, campanhas, funcionários, unidades, contas de doadores, registros de doação e trilha de auditoria. Não executa consulta de carteira nem registro operacional.

O backend valida os perfis em cada endpoint. Contas inativas ou funcionários sem unidade ativa não conseguem usar a API autenticada. Alterações de senha, ativação/desativação e mudança de unidade incrementam `auth_version` para encerrar sessões anteriores quando necessário. A mudança de perfil não é disponibilizada em endpoints comuns.

## Roteiro de apresentação ponta a ponta

1. Execute `npm install`, `npm run demo:setup` e `npm start`.
2. Entre como doador (`doador@demo.viva` / `Demo@12345678`) e abra **Minha carteira** para exibir o código temporário.
3. Em outra janela, entre como funcionário (`hemocentro@demo.viva` / `Demo@12345678`). A tela principal já será **Validar carteira do doador**.
4. Digite o código exibido na carteira e consulte. O código é de uso único e expira em 120 segundos.
5. Confira nome e identificador interno com documento oficial. A consulta não valida identidade civil nem aptidão clínica.
6. Somente após a doação ter ocorrido e a equipe responsável ter concluído a avaliação, use **Registrar doação realizada**.
7. Volte à carteira do doador e atualize para consultar o histórico atualizado.
8. Entre como administrador (`admin@demo.viva` / `Demo@12345678`) para criar/editar campanhas, gerenciar contas de doadores, cadastrar e vincular funcionários, ativar/desativar contas e unidades e consultar os registros de doação e a auditoria.

As credenciais, unidade, campanhas, doações e agendamentos com sufixo de demonstração são fictícios e destinam-se apenas a apresentação local. A demonstração não constitui validação de hemoterapia nem substitui sistemas, documentos ou procedimentos clínicos de uma instituição real.
