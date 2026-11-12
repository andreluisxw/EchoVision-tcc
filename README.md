# EchoVision — MVP de ocorrências ambientais


Web app colaborativo para localizar e reportar problemas ambientais. **EchoVision** é a identidade do produto. **Frontend React e backend Fastify são projetos independentes**, comunicando-se apenas por HTTP/REST; compartilham tipos TypeScript, não regras de infraestrutura.

> Status: MVP para desenvolvimento e piloto controlado. **Não é uma plataforma pronta para lançamento público sem revisão de segurança, termos, política de privacidade, operação de moderação e testes em ambiente real.**

## Executar com Docker

Requisitos: Docker Engine + Compose v2 e acesso à internet para baixar imagens/dependências/tiles.

```bash
cp .env.example .env
# altere as senhas e segredos no .env (obrigatório antes de publicar)
docker compose up --build -d
```

Abra **http://localhost:8080** (ou a porta `WEB_PORT` do `.env`). A API fica no mesmo domínio em `/api/v1/`, encaminhada pelo Nginx. Um usuário externo não acessa a porta do container API diretamente.

```bash
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/categories
./scripts/smoke.sh
```

O mapa começa vazio. Para visualizar pins de exemplo, carregue os dados de demonstração **fictícios**:

```bash
docker compose exec -T db psql -U eco -d eco < infra/db/seed.sql
```

Use seu `POSTGRES_USER`/`POSTGRES_DB` no comando se tiver alterado as credenciais.

### Desenvolvimento sem Docker para frontend/backend

1. Inicie apenas o banco: `docker compose up -d db` (ou providencie PostgreSQL 16 + extensão PostGIS e execute `infra/db/init/001_schema.sql`).
2. Execute `pnpm install` na raiz (Node 22+).
3. Em dois terminais: `pnpm dev:api` e `pnpm dev:web`.
4. Abra `http://localhost:5173`. O Vite redireciona `/api/*` para `http://localhost:3001`.
5. Para acessar banco fora do Docker, o default da API usa as variáveis PGHOST, PGUSER, PGPASSWORD e PGDATABASE para `localhost`.

Em dev, crie `apps/api/uploads` somente se quiser personalizar o caminho de mídias. Fotos são armazenadas em `./uploads` relativo ao processo da API; em Docker ficam em volume persistente.

## O que já funciona

- Interface responsiva com React, Vite, TypeScript, modo desktop/mobile.
- Mapa MapLibre + tiles OpenFreeMap, atribuição automática do provedor.
- Pan/zoom com consulta espacial PostGIS por `bbox`; filtros por seis categorias.
- Clusters de mapa (zoom) **separados** do número de confirmações de cada ocorrência.
- Pins crescem com quantidade de relatos; visualização de detalhe, fotografia e estado de confiança.
- Criar ocorrência anônima: categoria, coordenadas via mapa/GPS, texto opcional, foto opcional.
- Busca por ocorrências próximas da mesma categoria **antes de enviar** (100 m lixo/esgoto, 250 m demais categorias) e possibilidade de confirmar a existente.
- Confirmação de ocorrência ativa. Cada IP pode confirmar a mesma ocorrência somente uma vez a cada 24 h.
- Rate limiting em memória por IP: padrão **5 publicações/hora + 20/dia** e 30 confirmações/dia, com `429` e `Retry-After`.
- Normalização de IPv6 para prefixo /64 e HMAC-SHA256 do IP em registros (não armazenamos IP bruto no banco).
- Upload backend com reprocessamento JPEG (remove EXIF), tamanho máximo 8 MB, armazenamento em volume privado.
- Painel `/admin` com contas individuais, papéis owner/moderator, sessões revogáveis e histórico imutável.
- Verificar/desverificar, resolver/reabrir e ocultar/restaurar ocorrências, sempre com justificativa.
- Prévia do mapa com marcador nas coordenadas do detalhe administrativo, por mouse, teclado ou toque.
- Filtro “Exibir resolvidas” no mapa e no painel, por data de resolução em São Paulo.
- Dados novos entram em `unverified`; com 3 hashes de IP distintos, tornam-se `corroborated`, **não** `verified` (somente moderação altera para `verified`).

## Fluxo de aplicação

```text
Usuário (React / desktop-mobile)
      |
      v
Nginx (frontend estático + proxy /api)
      |
      v
Fastify (REST + limites IP + validação + reprocessamento de foto)
      |                    |
      v                    v
PostgreSQL/PostGIS     volume de imagens
```

```text
Reportar > Categoria > Localização > Ver próximos
                                    |                    |
                          Já existe o mesmo?      Não é o mesmo problema
                                    |                    |
                         Confirmar ocorrência     Criar nova ocorrência
                                    |                    |
                                    +------> Mapa <-----+
```

## Endpoints

| Método | URL | Descrição |
|---|---|---|
| GET | `/api/v1/health` | Checa conexão com banco |
| GET | `/api/v1/categories` | Catálogo de categorias |
| GET | `/api/v1/issues?bbox=-47,-24,-46,-23&category=lixo` | GeoJSON com ocorrências ativas |
| GET | `/api/v1/issues/nearby?longitude=-46.63&latitude=-23.55&category=lixo` | Possíveis duplicatas |
| GET | `/api/v1/issues/:id` | Detalhe |
| GET | `/api/v1/media/:id` | Imagem reprocessada de ocorrência visível |
| POST | `/api/v1/reports` | Cria relato e ocorrência (multipart) |
| POST | `/api/v1/issues/:id/confirmations` | Confirma problema ativo |
| GET/POST | `/api/v1/admin/session`, `/login`, `/logout`, `/password` | Sessão e credenciais individuais |
| GET | `/api/v1/admin/issues`, `/issues/:id` | Fila e detalhe administrativo |
| POST | `/api/v1/admin/issues/:id/actions` | Ação explícita com justificativa |
| GET | `/api/v1/admin/history` | Histórico filtrado pelo papel |
| GET/POST | `/api/v1/admin/accounts` | Listar/criar contas (owner) |
| PATCH | `/api/v1/admin/accounts/:id` | Ativar/desativar conta (owner) |
| POST | `/api/v1/admin/accounts/:id/reset-password` | Gerar senha temporária (owner) |
| GET | `/api/v1/admin/media/:id` | Foto administrativa, incluindo ocultas |

### Publicar (API)

```bash
curl -X POST 'http://localhost:8080/api/v1/reports' \
  -F 'category=lixo' -F 'latitude=-23.5505' -F 'longitude=-46.6333' \
  -F 'description=Acúmulo de resíduos na calçada' \
  -F 'photo=@foto.jpg'  # opcional
```

Para confirmar:

```bash
curl -X POST 'http://localhost:8080/api/v1/issues/SEU-UUID/confirmations'
```

### Primeiro acesso administrativo

```bash
docker compose exec api node apps/api/dist/bootstrap-owner.js
```

Informe nome e e-mail. O comando cria o primeiro owner e mostra uma senha temporária uma única vez. Abra `/admin/login`, entre e troque a senha por uma com pelo menos 12 caracteres. Depois entre novamente. O bootstrap recusa execução quando existe owner ativo; contas adicionais são criadas em **Contas**.

Owners gerenciam contas e moderam; moderators apenas moderam. Criação, redefinição e ativação/desativação exigem justificativa. Desativar ou redefinir senha revoga sessões. O último owner ativo não pode ser desativado. Senhas usam scrypt com salt; sessões de 8 horas usam cookie HttpOnly/SameSite=Strict e hash de token no banco. Cinco erros bloqueiam a conta por 15 minutos.

Confiança (`unverified`/`corroborated`/`verified`), ciclo (`active`/`resolved`) e visibilidade (`visible`/`hidden`) são independentes. Resolver mantém os relatos; reabrir limpa apenas a data atual de resolução. O histórico registra autor, alvo, estado anterior/posterior, justificativa e instante. Moderadores não acessam eventos de contas/autenticação.

No mapa e no painel, resolvidas ficam ocultas por padrão. Ative **Exibir resolvidas** para consultar ontem/hoje ou outro intervalo inclusivo de até 90 dias em `America/Sao_Paulo`. Parâmetros da lista pública: `includeResolved=true&resolvedFrom=2026-11-08&resolvedTo=2026-11-09`. Ativas continuam presentes. Ocultas nunca aparecem publicamente. Resolvidas não aceitam confirmações.

A migração `002_admin.sql` roda automaticamente na inicialização, uma vez por banco, sem recriar os dados. Para resolvidas legadas, `last_report_at` serve como aproximação da data; não é fabricado histórico de administrador. Preserve backup antes de aplicar em outro ambiente.

## Arquivos e responsabilidades

```text
apps/web/             React + MapLibre + telas responsivas
apps/api/             Fastify API, regras de negócio, mídias, anti-spam
packages/shared/      Tipos e categorias consumidos pelos dois apps
infra/db/init/        Schema PostGIS inicial (criado no primeiro boot do volume)
infra/db/migrations/  Evoluções versionadas aplicadas automaticamente
infra/db/seed.sql     Ocorrências fictícias opcionais
infra/nginx/          Reverse proxy e host dos arquivos estáticos
Dockerfile.*          Builds independentes de API e frontend
docker-compose.yml    Banco, API e frontend
scripts/smoke.sh      Smoke test HTTP usando curl
```

## Configuração

Veja `.env.example`. Os parâmetros `MAX_POSTS_HOUR`, `MAX_POSTS_DAY` e `MAX_CONFIRMS_DAY` podem ser sobrescritos via variáveis da API. `TRUSTED_PROXIES` é uma lista de IPs explicitamente confiáveis. O Compose usa uma rede privada de IPs fixos (`172.31.77.0/24`) para que o Fastify confie **somente** no Nginx (`172.31.77.10`), evitando falsificação do IP por `X-Forwarded-For` de clientes. Se essa sub-rede conflitar com sua rede, altere os endereços no Compose e a variável `TRUSTED_PROXIES` em conjunto.

O painel usa `/api/v1/admin` na mesma origem do frontend; mantenha o proxy `/api` no deploy. O mapa público aceita `VITE_API_BASE` (`API_BASE_URL` no Compose). `VITE_MAP_STYLE_URL` é opcional; o estilo padrão é `https://tiles.openfreemap.org/styles/liberty` e exige internet. Fora de localhost use HTTPS, configure `ALLOWED_ORIGINS` e `ADMIN_COOKIE_SECURE=true`. A opção false é recusada para origens não locais.

## Testes

```bash
pnpm install
pnpm test         # limiter, senhas e datas; integração requer ADMIN_INTEGRATION=true
pnpm --filter @eco/web test # componentes administrativos
pnpm build        # validação TS e bundle de produção
./scripts/smoke.sh  # com Docker já inicializado
```

## O que falta antes de um lançamento público

1. **Moderação humana e operação:** equipe, canal para denúncias de abuso/contestação e regras de publicação para conteúdo sensível.
2. **Compliance:** política de privacidade LGPD, retenção, exclusão, aviso sobre localização e responsabilidade por conteúdos.
3. **Anti-abuso avançado:** limite atual é **em memória, por instância**, reinicia ao reiniciar container e não impede VPN/IPs rotativos; para múltiplas instâncias, migrar para Redis/DB com atomicidade. IP compartilhado pode bloquear usuários legítimos.
4. **Consolidação:** a API sugere ocorrências similares, mas usuários podem ignorar a sugestão e criar duplicatas; ainda não há merge/moderação automática.
5. **Fotografias:** backend reprocessa metadados, mas não tem moderação por conteúdo, varredura AV, desfocagem automática de rostos/placas ou política de remoção. Storage local deve migrar para S3/R2 em ambiente de escala.
6. **Operação:** HTTPS, domínio, backup do banco **e do volume de imagens**, monitoração, revisão de quotas e testes de carga/e2e.
7. **Métrica:** `report_count` representa acumulado total, não contagem única dos últimos 30 dias. A escala visual do pin usa esse total. Melhorar conforme necessidade.
8. **PWA:** website responsivo, mas manifest/service worker para instalação/offline ainda não foram adicionados.
9. **Geo:** mapas cruzando antimeridiano ou abrangendo o planeta todo não têm tratamento especial; pensados para piloto local.

Licença: código de exemplo destinado à adaptação no projeto do usuário. Dependências de terceiros mantêm suas próprias licenças.
