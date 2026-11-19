# Ajustes da home e acessibilidade — VIVA+

## O que mudou

- A home foi simplificada: saiu o banner duplicado, a apresentação extensa em blocos (problema/solução/fases) e o bloco de atalhos que repetia as opções de acessibilidade.
- O visitante agora vê uma mensagem principal, dois caminhos de ação e três cartões curtos de navegação (cadastro, unidades e campanhas).
- A área de estoque fica compacta quando não há dados cadastrados; os oito tipos sanguíneos só aparecem quando há informação inserida. O texto deixa explícito que não existe sincronização oficial em tempo real.
- Para quem já entrou na conta, os indicadores da jornada e campanhas continuam disponíveis.
- O botão flutuante personalizado de Libras foi removido. O atalho azul de acessibilidade universal continua disponível.
- O widget oficial VLibras agora é carregado automaticamente em todas as páginas, em vez de depender de um botão personalizado.
- A política de privacidade informa a presença do serviço externo VLibras e aponta para o aviso oficial.
- A Content Security Policy libera os domínios necessários para o script, o iframe e as fontes do VLibras, conforme a documentação oficial.

## Limite do VLibras

O VLibras precisa do próprio controle flutuante para que a pessoa ative o tradutor e selecione o texto a traduzir. O projeto remove o botão customizado duplicado, mas mantém o controle nativo do widget. A documentação oficial não descreve abertura automática do avatar nem tradução contínua sem interação.

## Arquivos alterados

- `src/main.jsx`
- `src/style.css`
- `server/index.js`

## Testes feitos

- Parsing JSX de `src/main.jsx`, `src/Impact.jsx` e `src/Requirements.jsx` usando o parser TypeScript incluído no ambiente.
- Balanceamento de chaves em `src/style.css`.
- Parsing JSON de `package-lock.json`.
- `node --check server/index.js`.
- O `npm ci --no-audit --no-fund` excedeu o tempo disponível; por isso, não foi possível executar o build Vite ou o teste visual do widget no navegador neste ambiente.
