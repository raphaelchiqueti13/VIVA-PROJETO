# Perfis de funcionário e administrador — fluxo ativo

Esta documentação descreve somente as funções que existem na versão ativa do VIVA+.

## Funcionário da unidade

- A conta precisa estar ativa e vinculada a uma unidade ativa.
- A interface do funcionário é separada da navegação do doador e do painel administrativo.
- O funcionário digita o código temporário de seis dígitos exibido na carteira do doador.
- O código expira em 120 segundos, é armazenado como HMAC-SHA-256 e só pode ser consumido uma vez.
- A consulta cria uma autorização curta vinculada ao doador e ao funcionário autenticado.
- Após a confirmação de que a doação ocorreu e a equipe responsável concluiu os procedimentos, o funcionário registra a doação realizada.
- O backend valida novamente a autorização e impede duplicidade de doação validada para o mesmo doador/data.
- A consulta e o registro ficam na trilha de auditoria.

**Limite explícito:** não existe fluxo operacional ativo separado de “registrar comparecimento” nem ação de “cancelar atendimento”. A tabela `attendance_records` permanece no banco por compatibilidade histórica, mas não é usada no fluxo atual nem deve ser apresentada como funcionalidade ativa.

## Administrador

O painel administrativo possui acesso exclusivo para:

- Consultar indicadores agregados.
- Criar e editar campanhas.
- Cadastrar, vincular, ativar e desativar funcionários.
- Cadastrar e administrar unidades.
- Consultar registros de doação e trilha de auditoria.
- Consultar contas de doadores e ativar/desativar essas contas.

Registros de doação não podem ser apagados pelo endpoint administrativo. A desativação de usuário preserva seu histórico. O encerramento de campanha altera seu status em vez de remover o registro.

## Regras de acesso

- Os endpoints institucionais exigem perfil `hemocenter` e unidade ativa vinculada.
- Os endpoints administrativos exigem perfil `admin`.
- A listagem pública de campanhas autenticadas é exclusiva do perfil `donor`.
- O cancelamento de um agendamento confirmado é exclusivo do doador proprietário.
- A mudança de senha incrementa `auth_version`, revogando sessões JWT anteriores.
