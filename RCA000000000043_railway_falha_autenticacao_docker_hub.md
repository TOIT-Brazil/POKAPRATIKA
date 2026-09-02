# RCA000000000043 - Railway falha ao autenticar no Docker Hub

## Incidente

Em 2026-09-02 às 20:24:23Z, o deployment `7aab6f50-a8a4-4ceb-a9aa-584bdad840fe` do serviço frontend falhou ao resolver a imagem base `nginx:1.27-alpine`.

## Sintoma

O build daemon retornou `failed to authorize` porque a solicitação de token para `auth.docker.io` recebeu `500 Internal Server Error`.

## Causa raiz

Falha transitória externa no endpoint de autenticação do Docker Hub, durante a obtenção de metadados da imagem oficial do Nginx. O erro ocorreu no processamento do segundo `FROM` do Dockerfile, antes da execução das etapas de cópia, instalação de dependências ou compilação do frontend.

## Evidência

- O Dockerfile referencia uma imagem pública oficial válida: `nginx:1.27-alpine`.
- A mensagem da Railway identifica resposta HTTP 500 de `https://auth.docker.io/token`.
- Em nova consulta após o incidente, o mesmo endpoint respondeu HTTP 200 e forneceu token válido.
- O build local do frontend já havia sido concluído sem erros.

## Impacto

O deployment do frontend não gerou imagem e não avançou para uma instância de execução. O código, as configurações de runtime, o banco e o backend não foram executados nem alterados por essa tentativa.

## Recuperação

Executar `Redeploy` no deployment mais recente do serviço frontend na Railway. Como o endpoint externo voltou a responder normalmente, não é necessária alteração no Dockerfile.

## Prevenção

Falhas HTTP 5xx ao buscar token ou metadados de imagens públicas devem ser tratadas primeiro como dependência externa transitória. Repetir o deployment após verificar o endpoint; alterar a imagem base somente se houver evidência de tag inexistente, bloqueio persistente ou incompatibilidade comprovada.