# VIVA+ — auditoria técnica, privacidade, segurança e acessibilidade

**Data da revisão:** 13/11/2026  
**Material analisado:** pacote VIVA+ recebido nesta conversa (`VIVA_PLUS_HISTORICO_AUTOMATICO.zip`)  
**Arquitetura observada:** React 18 + Vite, API Node.js/Express, SQLite (`better-sqlite3`), JWT, bcryptjs, QRCode e Lucide React.  
**Natureza desta auditoria:** revisão estática do código recebido e correções aplicadas. Não é pentest, certificação, parecer jurídico nem homologação para uso clínico ou institucional.

## Resumo executivo

O projeto já continha fluxos de cadastro/login, carteira com código temporário, campanhas, solicitações internas de agendamento, painel institucional e demonstrativo de impacto. A auditoria é estática; a existência de telas/rotas não foi tratada como prova de fluxo operacional completo. Também já havia textos preliminares de privacidade e termos, preferências locais de cookies, controles de acessibilidade e uma camada inicial de segurança.

Nesta entrega foram feitos ajustes de design e animação sem reconstruir a aplicação, removido o link/botão “Acessibilidade” do menu/rodapé (mantidos os controles da página inicial e o atalho `Alt + Shift + A`), revisado o aviso do cadastro, restringida a lista de doadores por hemocentro, adicionados cabeçalhos HTTP de segurança e corrigida a chave estrangeira da tabela de doações com migração preservadora dos registros.

**A aplicação continua sendo um protótipo acadêmico. Não deve receber dados reais de saúde/doadores até que as pendências de governança, jurídicas, de segurança e de operação sejam resolvidas.**

## Auditoria dos 17 pontos

| # | Ponto | Resultado | Evidência / pendência |
|---|---|---|---|
| 1 | Política de privacidade | **Atualizada — preliminar** | Texto corrigido para descrever os campos realmente solicitados no cadastro atual e explicar `localStorage`, token, dados opcionais e limites. Faltam identidade do controlador, contato, bases legais por finalidade, retenção, operadores e processo de direitos. |
| 2 | Termos de serviço | **Existem — preliminares** | Os termos já descrevem a natureza acadêmica, os limites do código temporário, agendamentos internos, indisponibilidade e funcionalidades futuras. Exigem revisão jurídica e identificação do fornecedor antes de publicação. |
| 3 | Cookies e preferências | **Parcial** | Banner e painel permitem manter apenas armazenamento necessário; não há analytics/pixel ativo identificado. O projeto usa `localStorage`, não necessariamente cookies HTTP. Se tecnologias não essenciais forem adicionadas, deverão ser bloqueadas antes da escolha do usuário e ter consentimento granular efetivo. |
| 4 | Reembolso | **Não aplicável** | Não foi localizado fluxo de pagamento, assinatura ou cobrança. Nenhuma política artificial foi criada. Reavaliar caso pagamentos sejam adicionados. |
| 5 | Formulários e LGPD | **Parcial — melhorado** | Cadastro informa finalidades observadas, destaca campos opcionais e diferencia tipo sanguíneo autodeclarado. Não foi inventada uma caixa de consentimento genérica: a base legal precisa ser definida pelo controlador, especialmente para dados sensíveis. Faltam formalização e processo para direitos dos titulares. |
| 6 | Minimização de dados | **Melhorado** | Cadastro público atual solicita nome, e-mail e senha; tipo sanguíneo e região são opcionais. Telefone, data de nascimento, cidade e preferência de Libras ainda existem como colunas legadas no banco, mas não são solicitados no cadastro público atual. Planejar limpeza/migração dessas colunas após confirmar histórico e necessidade. |
| 7 | Tracking e scripts externos | **Sem analytics/pixel identificado; VLibras externo ativo** | Não foram encontrados Google Analytics, pixels, Hotjar, Clarity ou scripts de publicidade. O widget oficial VLibras permanece carregado por script hospedado externamente e está descrito na política de privacidade. Google Fonts foi removido. Reauditar se novas integrações forem adicionadas. |
| 8 | Acessibilidade | **Melhorias aplicadas — validação parcial** | Permanecem skip-link, foco visível, estrutura semântica, modal com foco/ESC, tema, alto contraste, escala de texto e redução de movimento. O botão do menu/rodapé foi removido a pedido; o painel segue disponível na página inicial e por `Alt + Shift + A`. Falta teste com leitor de tela e usuários. |
| 9 | Texto alternativo | **Parcial / adequado ao inventário** | O código temporário é exibido como texto legível e anunciado na região dinâmica. Elementos visuais do hero são CSS e ícones decorativos; não exigem texto alternativo quando corretamente ignorados por tecnologia assistiva. Não há catálogo de imagens fotográficas no pacote. |
| 10 | Contraste | **Melhorias visuais aplicadas; não certificado** | Foram mantidos estados de foco e opções de alto contraste; cores e hierarquia receberam ajustes visuais. Não foi possível medir todas as combinações WCAG em navegador/tema/estado. Exige auditoria automatizada e manual. |
| 11 | Teclado | **Suporte implementado; teste manual pendente** | Navegação nativa por controles, skip-link, foco visível, fechamento de modal por ESC e contenção de foco existentes. Não houve teste completo com teclado físico no navegador por falta de ambiente de frontend funcional. |
| 12 | Avaliações falsas | **Nenhuma adicionada** | Não foram criados depoimentos, avaliações nem números de usuários. Scripts de demonstração indicam dados fictícios e são bloqueados em produção. Não usar seeds em banco com dados reais. |
| 13 | Promessas falsas | **Melhorado** | O texto “Parceria com instituições de saúde” foi ajustado para “Integração institucional planejada”. Roadmap e telas identificam as fases futuras como planos/propostas. Verificar novamente qualquer material de divulgação antes de publicação. |
| 14 | Copyright de imagens/ícones | **Parcial — baixo volume de assets** | Não foi encontrado conjunto de imagens externas/fotografias no pacote; ilustrações principais são CSS e ícones da dependência Lucide React. Conferir e arquivar as licenças das dependências usadas na distribuição. Não há inventário formal de ativos de terceiros porque não há imagens licenciadas fornecidas no ZIP. |
| 15 | Dados empresariais | **Pendente — dados não fornecidos** | Não foram inventados CNPJ, razão social, endereço, responsável, encarregado ou telefone. Esses dados reais devem ser informados pelo mantenedor e validados antes de lançamento. |
| 16 | Conformidade LGPD | **Parcial — não certificada** | Foram corrigidos avisos e minimização do cadastro; a API passou a limitar a lista de doadores por unidade; cabeçalhos HTTP foram reforçados. Ainda faltam inventário de tratamento, bases legais (art. 11 para dados sensíveis), contratos, retenção, descarte, backups, direitos dos titulares, resposta a incidentes e governança. |
| 17 | Riscos jurídicos | **Mapeados — validação especializada obrigatória** | Tipo sanguíneo e histórico de doação podem revelar dados de saúde. É necessário definir controlador/operadores, base legal, finalidade estrita, acesso por unidade, responsabilidades, uso de códigos temporários, validade de registros, acordos com hemocentros e se é necessário RIPD. O VIVA+ não comprova identidade civil nem aptidão clínica. |

## Alterações implementadas

### Interface e experiência visual

- `src/main.jsx`
  - Removido o botão/link “Acessibilidade” da barra inferior de navegação/rodapé, conforme solicitado.
  - Mantido o painel de acessibilidade na seção inicial e o atalho `Alt + Shift + A` para não retirar os recursos de inclusão.
  - Inserida explicação de finalidade dos dados diretamente no formulário de cadastro e acesso visível à política.
  - Política de privacidade corrigida para refletir os campos realmente coletados; colunas antigas foram descritas como legado.
  - Texto sobre parcerias ajustado para indicar planejamento, não parceria confirmada.
- `src/style.css`
  - Hero com superfície mais refinada, fundo suave e elementos decorativos.
  - Animações adicionais de entrada em cascata, halo do ícone central, movimento dos cards, hover e brilho de CTA.
  - Melhorias de profundidade, bordas, elevação e adaptação mobile.
  - Respeito ao `prefers-reduced-motion` e à preferência interna de reduzir animações.
  - Estilo do link de privacidade no formulário.
- `src/Requirements.jsx`
  - Link de referência dos critérios de doação substituído pelo índice oficial de regulamentos técnicos do Ministério da Saúde.

### API, banco e segurança

- `server/index.js`
  - Consulta institucional de doadores: administrador mantém consulta administrativa; perfil de hemocentro recebe somente doadores com agendamento ou doação vinculados à sua própria unidade.
  - Cabeçalhos: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy` e HSTS em produção quando a requisição é HTTPS confiável.
  - `CSP_CONNECT_SRC` permite declarar origens extras estritamente necessárias quando frontend/API forem hospedados separadamente.
- `database/schema.sql`
  - `donation_records.hemocenter_id` agora referencia `hemocenters(id)`, e não `users(id)`.
- `server/db.js`
  - Migração para bancos legados com a FK errada; preserva as linhas de doação e mantém referências de unidade válidas. Referências antigas sem unidade correspondente são convertidas em `NULL`, sem apagar a doação.
- `.env.example`
  - Documentadas as variáveis `CSP_CONNECT_SRC` e `TRUST_PROXY`.
- `render.yaml`
  - `TRUST_PROXY=true` para a aplicação hospedada atrás do proxy HTTPS da plataforma.
- `README.md`
  - Incluídos pré-requisitos de segurança e privacidade antes da produção.

## Pontos técnicos que continuam exigindo decisão

1. **Token em `localStorage`:** risco de exposição se ocorrer XSS. Migrar para cookie `HttpOnly`, `Secure`, `SameSite` com proteção CSRF e plano de revogação de sessão.
2. **Rate limit em memória:** não compartilha contagem entre instâncias; usar Redis/gateway ou serviço equivalente em produção.
3. **Verificação de e-mail:** a recuperação de senha já foi implementada e usa Resend; ainda não há fluxo de verificação do endereço no cadastro. As notificações de campanhas e lembretes de elegibilidade também não têm disparo automático.
4. **Dados antigos:** colunas `phone`, `birth_date`, `city` e `accessibility_libras` ainda existem no schema por compatibilidade. Determinar retenção e descartar dados antigos somente após avaliação e backup autorizado.
5. **Direitos LGPD:** não foi encontrado fluxo completo de exportação/correção/exclusão de conta, confirmação de identidade do solicitante e acompanhamento do pedido.
6. **Infraestrutura:** definir criptografia/controle do volume, backups testados, retenção e descarte de logs, segregação de ambiente e privilégios operacionais.
7. **Monitoramento:** formalizar plano de resposta a incidentes e responsabilidades de comunicação à ANPD e aos titulares, quando aplicável.
8. **Código temporário:** o código de 6 dígitos localiza a carteira no VIVA+, expira em 120 segundos e é consumido uma vez; não autentica identidade civil nem confirma aptidão clínica.
9. **Diretório e unidades:** validar a origem oficial, autorização e atualidade de cada unidade cadastrada.
10. **Demo:** dados de seed são fictícios. Nunca importar seeds para ambientes de produção.

## Testes realizados nesta entrega

| Teste | Resultado |
|---|---|
| `node --check server/index.js` | **Passou** |
| `node --check server/db.js` | **Passou** |
| `node --check server/mail.js` | **Passou** |
| `node --test server/mail.test.js` | **Passou:** 5 testes do envio, falha de provedor, configuração ausente, escape de HTML e modelos transacionais |
| `node --check server/seed-demo.js` | **Passou** |
| `node --check server/seed-apresentacao.js` | **Passou** |
| Parsing estático de `src/style.css` com `tinycss2` | **Passou:** 771 regras, 0 erros de parsing |
| Criação do schema SQLite em memória | **Passou** |
| Simulação da migração FK legada, preservando registro e validando `foreign_key_check` | **Passou** |
| Busca estática por scripts de analytics/pixel conhecidos | **Nenhum encontrado** |
| Build `npm run build` | **Bloqueado:** dependências não ficaram instaladas integralmente; executável `vite` não disponível após timeout de `npm ci` |
| Parsing de JSX com TypeScript `transpileModule` | **Passou:** 0 diagnósticos de sintaxe |
| Testes React/frontend no navegador e fluxo real dos formulários | **Não executados:** build/dependências indisponíveis neste ambiente |
| Integração HTTP real da API + autenticação + banco | **Não executada:** dependências Node não completaram instalação |
| Teclado/leitor de tela, teste WCAG de contraste e pentest | **Não executados:** requerem navegador/ferramentas e ambiente especializado |

Foi adicionado o comando `npm test` para executar os testes automatizados do serviço de e-mail. A suíte ainda não cobre a API completa, o banco de dados ou fluxos de navegador.

## Validações jurídicas e institucionais indispensáveis antes do uso real

- Advogado(a) com experiência em LGPD e saúde deve validar controlador, operadores, bases legais por finalidade, dados sensíveis, termos, avisos e eventual necessidade de Relatório de Impacto à Proteção de Dados (RIPD).
- Informar razão social/nome do controlador, CNPJ quando aplicável, endereço e canal de privacidade real.
- Formalizar contratos, instruções e responsabilidades com hemocentros e fornecedores.
- Definir retenção, descarte, backups, direitos dos titulares e resposta a incidentes.
- Obter validação técnica dos critérios de doação junto a profissional/serviço de hemoterapia. O conteúdo informativo foi apontado ao índice oficial do Ministério da Saúde; a triagem clínica sempre cabe ao serviço competente.
- Realizar revisão de segurança independente e auditoria de acessibilidade com usuários e tecnologias assistivas.

**Conclusão:** foram aplicadas melhorias concretas de interface, transparência e proteção da API. A plataforma fica em melhor condição para demonstração, mas esta entrega não constitui certificação LGPD, garantia de segurança ou autorização para operação real com dados pessoais sensíveis.


## Atualização posterior — código temporário

O fluxo visual de QR Code foi substituído por um código de 6 dígitos, com validade de 120 segundos e uso único; o painel institucional consulta esse código sem precisar de câmera ou domínio público. A análise de segurança e a validação jurídica continuam necessárias antes de qualquer uso com dados reais.


## Correções aplicadas nesta revisão — autenticação, e-mail e administração

- `server/mail.js`: integração de envio transacional com Resend por HTTPS e `Authorization: Bearer`, chave restrita ao servidor, remetente por configuração, suporte a `Idempotency-Key`, tratamento de falhas e modelos HTML/texto.
- `server/index.js`: endpoints `POST /api/auth/forgot-password` e `POST /api/auth/reset-password`; senha pode ser alterada por `PATCH /api/me/password`. Tokens são aleatórios, armazenados como SHA-256, de uso único e expiram em 30 minutos. Respostas de recuperação são uniformes para reduzir enumeração de contas.
- `server/db.js` e `database/schema.sql`: coluna `auth_version` com migração aditiva e tabela `password_reset_tokens`; atualização de senha revoga as sessões JWT emitidas anteriormente.
- `server/index.js`: o registro de doação verifica duplicidade dentro da transação e envia confirmação transacional quando o Resend confirma o aceite.
- `src/main.jsx`: telas de esqueci a senha e redefinição via link, além de alteração de senha em Configurações. O painel administrativo passou a listar e ativar/desativar contas de doadores.
- `server/index.js`: exclusão administrativa de doações foi bloqueada; contas de doadores são desativadas e campanhas são encerradas, preservando o histórico. A interface e os guias deixam claro que não há fluxo operacional separado de comparecimento; a tabela legada permanece no banco sem ser apagada. A validação do código, a criação da autorização e o evento de auditoria agora pertencem à mesma transação.
- `.env.example`, `render.yaml`, `.gitignore` e `GUIA_RESEND.md`: configuração externa documentada sem incluir a chave.

**Pendências de configuração:** a chave exibida na captura deve ser revogada e substituída; falta cadastrar chave nova, remetente/domínio verificados, `APP_URL` HTTPS e variáveis no ambiente de hospedagem. Não foi possível enviar e-mail real nesta execução. Verificação de e-mail no cadastro, notificações de campanhas/lembretes, migração de `localStorage` para cookie seguro, rate limit compartilhado, backups e testes de integração continuam pendentes.


## Auditoria complementar desta entrega — regras de negócio

- A rota `GET /api/campaigns` foi restringida ao perfil `donor`; o painel administrativo não faz mais uma chamada indevida a essa rota.
- A criação/consumo de validação da carteira, autorização do funcionário e trilha de auditoria ocorre em uma única transação `BEGIN IMMEDIATE`.
- O registro de doação é transacional e usa bloqueio de escrita imediato. A aplicação verifica duplicidade por doador/data; o banco tenta instalar um índice único global para doação validada e preserva o histórico caso já existam duplicidades legadas (nesse caso registra aviso para revisão manual).
- Solicitações de agendamento agora validam limite diário e conflito do horário dentro de transação imediata. O banco tenta instalar índice único parcial para horários ativos; duplicidades existentes são preservadas e exigem revisão manual.
- Cancelamento de solicitação ficou exclusivo ao próprio doador. A criação de solicitação tem rate limit dedicado.
- Desativação/reativação de doadores, movimentação/desativação de funcionários e ativação/desativação da unidade invalidam tokens existentes por meio de `auth_version`.
- O histórico de doações não é removido por endpoint administrativo; contas são desativadas e campanhas são encerradas em vez de removidas.
- A documentação de funcionário/admin foi corrigida para refletir o fluxo ativo, sem afirmar que comparecimento/cancelamento de atendimento existe.

**Classificação da entrega:** recuperação de senha, modelos e integração Resend estão implementados no código, porém dependem de chave nova, remetente verificado e `APP_URL`; não foram testados com entrega externa real. O build Vite e a integração HTTP da API continuam sem validação porque `npm ci` não concluiu neste ambiente. O repositório não deve ser considerado pronto para produção ou uso com dados de saúde reais.
