# RCA000000000052 - Loading inicial e sessão expirada

## Sintoma

Durante a busca inicial dos dados na Railway, a interface exibia a frase de carregamento ao mesmo tempo em que montava a página com estados vazios, incluindo `Sem próximo jogo operacional`. Quando o JWT expirava, as requisições retornavam 401, mas a autenticação permanecia no navegador e o usuário precisava sair manualmente antes de entrar novamente.

## Causa raiz

O estado `loading` iniciava como falso e as views eram renderizadas sem condicionamento à carga, permitindo conteúdo provisório antes e durante as requisições. O `ApiClient` tratava qualquer resposta não OK como erro genérico e não propagava a expiração de sessão para o estado global de autenticação.

## Impacto

O usuário via informações vazias que pareciam definitivas enquanto os dados reais ainda eram carregados. Sessões expiradas deixavam a aplicação presa em uma área autenticada sem dados e exigiam dois passos desnecessários para recuperar o acesso.

## Correção

Durante a carga inicial, as views são ocultadas e substituídas por um spinner central sem texto visível. O estado já inicia ativo quando existe autenticação salva e também é ativado no mesmo evento do login, impedindo frames intermediários com dados vazios. O cliente HTTP recebeu um callback global de sessão inválida; ao receber 401 em uma requisição autenticada, remove a credencial local e retorna imediatamente à tela de login, inclusive quando a falha ocorre em uma atualização periódica.

## Prevenção

Estados vazios de negócio não devem ser renderizados antes da conclusão da carga inicial. Falhas de autenticação devem ser tratadas na camada HTTP compartilhada, incluindo requisições periódicas cujos erros são silenciosamente ignorados pela interface.