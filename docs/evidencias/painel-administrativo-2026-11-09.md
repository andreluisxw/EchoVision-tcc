# Evidência complementar — painel administrativo

Data: 9 de novembro de 2026, America/Sao_Paulo. Ambiente: Windows com Docker Desktop, Node 22 no container, PostgreSQL 16/PostGIS 3.4, React 19 e Vite 6.4.6. Código: commits de implementação posteriores à especificação `82f9c78`; consultar os commits que acrescentam este registro. Não confundir este conjunto com a primeira execução histórica.

## Procedimentos e resultados

| Procedimento | Resultado observado |
|---|---|
| `docker compose build api web` | TypeScript de shared/API/web e build de produção aprovados |
| API via Node Test Runner, `ADMIN_INTEGRATION=true` | 8 testes aprovados, 0 falhas, 0 ignorados |
| Componentes via `vitest run` | 6 testes aprovados, 0 falhas |
| Migração aplicada duas vezes | Sucesso; controle versionado evita reaplicar DDL |
| Banco dedicado `eco_admin_test` | Schema inicial criado; integração repetida neste banco |
| Navegador em `/admin/login` | Formulário de login renderizado com rótulos e sem credenciais |
| Proxy final Nginx | Health, categorias e listas pública/por resolvidas: 200; sessão administrativa ausente: 401 |
| Revisão independente do código | Três achados relevantes corrigidos e regressões de interface verificadas |

O teste integrado exercita login válido/inválido, sessão ausente, validação de Origin, criação e unicidade de e-mail, troca obrigatória, permissão de moderador, filtro de histórico por papel, redefinição/desativação com revogação, verificar/desverificar, resolver/reabrir, ocultar/restaurar, justificativa vazia, conflito de repetição, duas resoluções concorrentes, preservação de relatos e rejeição de alteração de auditoria. Também verifica inclusão de resolvidas no mapa, exclusão padrão, bloqueio de confirmação de resolvida, privacidade do detalhe, mídia oculta pública inacessível e limites de dia imediatamente antes/depois de 03:00 UTC em São Paulo.

São oito casos no runner de API, sendo um cenário integrado com múltiplas asserções; isso não significa oito requisições ou cobertura integral. Os seis casos de componentes cobrem sessão ausente, troca obrigatória, papel, justificativa, filtro e alvo/transição no histórico.

## Comandos reproduzíveis

Em um ambiente com dependências instaladas, banco de testes inicializado por `infra/db/init/001_schema.sql` e variáveis PG configuradas:

```bash
ADMIN_INTEGRATION=true PGDATABASE=eco_admin_test npm run test -w @eco/api
npm run test -w @eco/web
npm run build
```

No Windows usado, o código foi montado no container da API, com `ADMIN_INTEGRATION=true` e `PGDATABASE=eco_admin_test`. O frontend foi testado na imagem de estágio builder com o diretório `src` atual montado. A API foi pausada durante `compose run`, pois seu endereço fixo conflita com o serviço em execução. O serviço foi reiniciado depois.

## Correções da revisão

- Estado de contas, eventos, senha temporária e ações pendentes é limpo quando a identidade muda; página de contas também bloqueia renderização por papel e respostas abortadas não repopulam dados.
- Cookie Secure é padrão em produção; a exceção false só é aceita se todas as origens configuradas forem locais.
- Histórico identifica o alvo e apresenta mudanças de estado, com link para a ocorrência.

## Bundle final

O carregamento foi separado por rota com import dinâmico. Bootstrap React: 225,66 kB (70,37 kB gzip); painel: 18,19 kB (5,66 kB gzip); aplicativo público com mapa: 1.089,16 kB (294,79 kB gzip). O aviso de chunk acima de 500 kB permanece para o mapa e está registrado como limitação. Esses tamanhos não representam tempo de carregamento em rede real.

## Limites e pendências

- A revisão automática inicialmente recusou criar owner fictício; após autorização explícita do usuário, foi criada conta local de validação. No navegador foram confirmados login, fila, detalhe, resolução com justificativa, reabertura com preservação do histórico, tela de contas, histórico global, período padrão ontem/hoje e logout. A conta foi desativada e as sessões revogadas ao final. A ocorrência fictícia retornou ao estado ativo e os dois eventos permanecem registrados.
- A imagem de mídia do teste é deliberadamente inexistente; o teste comprova bloqueio público e exigência de sessão, não decodificação visual de foto administrativa.
- Bootstrap interativo, navegação integral por teclado, leitor de tela, contraste, carga ampliada, MFA e restauração de backup não receberam aprovação integral nesta execução.
- Os testes iniciais foram executados no banco local e deixaram contas fictícias desativadas e eventos de auditoria; as execuções finais usam banco isolado. Não são dados de uso real.
- O design DOCX original foi preservado como fonte histórica; documentação vigente e especificação do painel descrevem a evolução.

Não foram realizados testes de campo ou alegações de impacto social/ambiental. O resultado é uma verificação técnica local.
