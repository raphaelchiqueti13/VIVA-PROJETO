# Roteiro de testes para a apresentação do VIVA+

## Instalação no VS Code (Windows)
1. Extraia o ZIP e abra a pasta `viva_plus` no VS Code.
2. Instale Node.js 20 ou 22 LTS se ainda não tiver.
3. Abra **Terminal > Novo Terminal**.
4. Execute `npm install`. Aguarde a conclusão (pode levar alguns minutos).
5. Copie `.env.example` para `.env` e troque `JWT_SECRET` por uma sequência aleatória com 32 ou mais caracteres.
6. Execute `npm start` e abra `http://localhost:5173`.
7. Para testar a API diretamente: `http://localhost:3001/api/health` deve retornar `ok: true`.

## Verificações manuais
- [ ] Abrir a página inicial sem erros no console (F12).
- [ ] Criar conta de doador com e-mail válido e senha de pelo menos 10 caracteres.
- [ ] Sair e entrar novamente com a conta criada.
- [ ] Atualizar a página e confirmar que a sessão permanece ativa.
- [ ] Abrir a carteira digital e conferir a emissão automática do código temporário de 6 dígitos.
- [ ] Não é necessário celular, câmera ou IP da rede: copiar visualmente os 6 dígitos da carteira e digitá-los no painel institucional.
- [ ] Entrar como hemocentro, digitar os seis dígitos atuais da carteira do doador e confirmar a localização. Repetir o mesmo código para confirmar que o uso único bloqueia a segunda tentativa.
- [ ] Confirmar que localizar a carteira não cria automaticamente uma doação; o registro deve ser feito separadamente pela instituição.
- [ ] Testar responsividade reduzindo a janela do navegador.
- [ ] Conferir preferências e acessibilidade.
- [ ] Confirmar que o diretório de hemocentros inicia vazio sem unidades cadastradas.
- [ ] Se houver unidade verificada, selecionar uma data e consultar os horários disponíveis.
- [ ] Reservar um horário livre e conferir que o status fica `confirmed` imediatamente, sem aprovação da unidade.
- [ ] Repetir a reserva do mesmo horário em outra conta e confirmar que o horário aparece ocupado e a API bloqueia a duplicidade.
- [ ] Cancelar a reserva e confirmar que o horário volta a ficar disponível.
- [ ] Abrir **Requisitos para doar** no menu e testar a calculadora de próxima doação.
- [ ] Testar logout e bloqueio das rotas protegidas.

## Limites importantes
O VIVA+ confirma reservas apenas na agenda interna da plataforma; não sincroniza vagas com serviços externos, não confirma doações reais automaticamente e não substitui a documentação clínica. Não use dados pessoais reais na apresentação.

## Se algo não abrir
- Confira se `npm start` está em execução e se as portas 5173 e 3001 estão livres.
- Confirme que você abriu a pasta que contém `package.json`.
- Se `npm install` falhar com `better-sqlite3`, use uma versão LTS do Node.js e instale as ferramentas de compilação do seu sistema.
- O banco SQLite é criado automaticamente em `database/viva.sqlite` na primeira inicialização.

## Contas de demonstração (ambiente local)
Execute uma vez: `npm run seed:demo` (bloqueado em produção). Senha de todas: `Demo@12345678`
- `doador@demo.viva` — doador
- `hemocentro@demo.viva` — instituição vinculada à "Unidade de Demonstração (teste)"
- `admin@demo.viva` — administrador
A unidade é fictícia e serve apenas para testes; não use em ambiente real.

Fluxo para homologação: doador consulta horários disponíveis → escolhe uma vaga e recebe confirmação imediata no VIVA+ → comparece à unidade conforme as orientações oficiais → funcionário localiza a carteira, confere documento oficial e registra a doação separadamente → doador vê o histórico na carteira.

## Apresentação para investidores
1. `npm run seed:demo` e depois `npm run seed:apresentacao` (só local): cria 64 doadores, doações e campanhas FICTÍCIOS para preencher os gráficos.
2. Abra **Impacto** no menu. A página mostra o aviso "Ambiente de demonstração" enquanto existirem contas `@demo.viva`; não apresente esses números como reais.
3. Sugestão de roteiro: Impacto (problema e números) → Requisitos para doar → entrar como `doador@demo.viva` e mostrar a carteira com código temporário → entrar como `hemocentro@demo.viva` e validar a doação → Impacto atualizado.
4. Para projetar, use o link Acessibilidade no rodapé ou o atalho Alt + Shift + A para aumentar o texto e o modo escuro para telões.
