# Ajuste do fluxo de doação e histórico

## O que mudou
- Removido da carteira do doador o formulário para declarar uma doação realizada.
- Removida da tela do funcionário a ação separada de registrar comparecimento.
- O funcionário consulta o código temporário e, após confirmar que a doação realmente ocorreu e foi registrada pela equipe responsável, utiliza uma única ação: **Registrar doação realizada**.
- O backend exige uma consulta de carteira recente, vinculada ao mesmo funcionário, e consome a sessão de verificação ao registrar a doação.
- O registro validado atualiza `donation_records`, `users.last_donation_date` e o histórico/contagem usados para calcular automaticamente o selo.
- Ao retornar à aba/janela do doador, o painel atualiza os dados ao recuperar o foco/visibilidade.

## Regra importante
A leitura do código identifica a carteira, mas não comprova que houve doação nem aptidão clínica. Por isso, a leitura sozinha não soma selo. A contagem acontece imediatamente após a única ação **Registrar doação realizada**, que só deve ser usada depois da doação efetiva e da confirmação pelos profissionais responsáveis.

## Testes realizados
- `node --check server/index.js`: passou.
- Transpilação/sintaxe JSX com TypeScript `transpileModule`: passou, sem diagnósticos.
- Busca estática: formulário de autodeclaração, botão de comparecimento e endpoints de comparecimento removidos do fluxo ativo.
- Build Vite: não executado; as dependências locais disponíveis neste ambiente não continham o executável `vite`.
