# Ajuste de posição dos atalhos de acessibilidade

- O botão azul de acessibilidade foi fixado no canto inferior direito da janela, com margem de segurança e suporte a safe-area em celulares.
- O atalho oficial do VLibras foi empilhado acima dele para evitar sobreposição.
- Em telas estreitas, os botões mantêm tamanho e espaçamento adequados.
- Alteração concentrada em `src/style.css`; nenhuma rota, API ou fluxo de autenticação foi alterado.

Para aplicar: substitua a pasta do projeto pela versão deste pacote, execute `npm install` caso necessário e `npm start`.
