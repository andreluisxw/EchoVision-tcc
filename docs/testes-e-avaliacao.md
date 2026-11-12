# Plano de testes e avaliação técnica

## 1 Finalidade

Este documento define como verificar o MVP EchoVision e sustentar os objetivos técnicos do TCC. Resultados não realizados permanecem marcados como `EXECUTAR`; os critérios não devem ser alterados depois da execução para favorecer o resultado.

## 2 Ambientes

| Ambiente | Finalidade | Configuração a registrar |
|---|---|---|
| Local | Compilação, análise estática e testes unitários | SO, Node, gerenciador e commit |
| Integração Docker | API, PostGIS, proxy e mídia | Docker, imagens e variáveis sem segredos |
| Navegadores | Responsividade e acessibilidade | navegador, versão e viewport |
| Desempenho | Medições repetíveis | hardware, dataset, carga e duração |

## 3 Resultado formal disponível

Em 9 de novembro de 2026, no commit `0e63ce39ea7faf3c656538ac4b0dc5a1968079b3`:

- o typecheck do pacote compartilhado passou;
- o typecheck da API passou;
- o typecheck do frontend passou;
- três testes automatizados do limitador passaram;
- o build Vite de produção passou, com aviso de chunk JavaScript acima de 500 kB;
- a inspeção em cinco larguras não encontrou rolagem horizontal, mas identificou alvos interativos menores que 44 px;
- Docker/PostGIS estava indisponível, portanto as rotas dependentes do banco não foram verificadas.

A evidência inicial está em [Evidência de validação técnica](evidencias/validacao-tecnica-2026-11-09.md). Esse registro é histórico. A execução posterior do painel, com Docker/PostGIS disponível, está em [Atualização administrativa](evidencias/painel-administrativo-2026-11-09.md): oito testes de API (incluindo um cenário integrado com múltiplas asserções) e seis testes de componentes passaram. Se o código for alterado, repetir as verificações na versão submetida à banca.

## 4 Matriz de verificação

### 4.1 Compilação e testes automatizados

| ID | Cenário | Resultado esperado | Estado |
|---|---|---|---|
| AUT-01 | Typecheck do pacote compartilhado | Sem erros | Aprovado |
| AUT-02 | Typecheck da API | Sem erros | Aprovado |
| AUT-03 | Typecheck do frontend | Sem erros | Aprovado |
| AUT-04 | Suíte automatizada | Todos os casos aprovados | Aprovado: 8 API + 6 componentes |
| AUT-05 | Build de produção | Artefatos gerados sem erro | Aprovado com aviso de bundle |

### 4.2 Banco e PostGIS

| ID | Cenário | Resultado esperado | Estado |
|---|---|---|---|
| DB-01 | Inicialização com volume vazio | Extensões, tabelas e índices criados | `EXECUTAR` |
| DB-02 | Consulta por caixa geográfica | Somente pontos da área e filtros | Aprovado no cenário integrado administrativo |
| DB-03 | Proximidade com distâncias conhecidas | `ST_DWithin` respeita o raio | `EXECUTAR` |
| DB-04 | Criação de relato | Occurrence e Report persistidos na mesma transação | `EXECUTAR` |
| DB-05 | Confirmação repetida | Segunda ação equivalente bloqueada | `EXECUTAR` |
| DB-06 | Ocultação administrativa | Item ausente da API pública | Aprovado no cenário integrado administrativo |

### 4.3 API e contratos

| ID | Requisição | Resultado esperado | Estado |
|---|---|---|---|
| API-01 | `GET /health` com banco | 200 e estado saudável | Aprovado pelo proxy final |
| API-02 | `GET /categories` | 200 e seis categorias | Aprovado pelo proxy final |
| API-03 | Caixa geográfica inválida | 400 sem stack trace | `EXECUTAR` |
| API-04 | UUID inválido | 400 | `EXECUTAR` |
| API-05 | Relato válido sem foto | 201 com IDs e `unverified` | `EXECUTAR` |
| API-06 | Foto maior que 8 MB | 413 | `EXECUTAR` |
| API-07 | Sessão administrativa ausente ou revogada | 401 | Aprovado |
| API-08 | Limite por período excedido | 429 e `Retry-After` | `EXECUTAR` |
| API-09 | Ocorrência inexistente | 404 | `EXECUTAR` |
| API-10 | Tentativa de definir contador | Campo ignorado ou rejeitado | `EXECUTAR` |

### 4.4 Segurança e privacidade

- confirmar que IP bruto não aparece em banco, resposta ou log;
- enviar `X-Forwarded-For` por origem não confiável e confirmar que é ignorado;
- verificar mudança do HMAC quando o segredo muda;
- testar SVG, arquivo corrompido, executável renomeado e imagem acima do limite;
- confirmar a remoção de EXIF do JPEG resultante;
- confirmar que `object_key` não aparece em respostas públicas;
- tentar acessar mídia ligada a ocorrência oculta;
- executar análise de dependências e busca de segredos;
- verificar que rotas administrativas rejeitam sessão ausente, expirada ou revogada e aplicam papéis.

Estado: **parcial**. Foram verificados sessão ausente/revogada, troca obrigatória, permissão de owner, bloqueio após cinco falhas, rejeição de mutação sem Origin, privacidade dos detalhes, ocultação, concorrência de resolução e trigger imutável. Casos ampliados de upload, dependências e restauração permanecem pendentes.

### 4.5 Responsividade

Executar os fluxos principais nas larguras 360, 390, 768, 1024 e 1440 pixels. Verificar mapa, filtros, formulários, teclado virtual, painel inferior, mensagens de erro e mudanças de orientação. Registrar navegador, versão e capturas.

Estado: **parcial**. Não houve rolagem horizontal nas cinco larguras definidas; a API integrada não estava disponível.

### 4.6 Inspeção heurística de acessibilidade e qualidade de uso

Verificar, com referência à WCAG 2.2 e a princípios de interação:

- navegação por teclado e ordem de foco;
- foco visível e nomes acessíveis;
- rótulos associados aos controles;
- contraste de texto e componentes;
- alvos de toque adequados;
- mensagens que não dependem somente de cor;
- zoom de 200% sem perda de conteúdo essencial;
- alternativa em lista às informações do mapa;
- indicação de carregamento, sucesso e erro;
- prevenção e recuperação de erros;
- consistência de termos, botões e estados;
- clareza da diferença entre relato, ocorrência e confiança.

Cada não conformidade recebe severidade, evidência, requisito relacionado e recomendação. Não declarar conformidade integral sem auditoria especializada. Estado: **parcial**; os controles possuíam nomes acessíveis, mas foram encontrados alvos menores que 44 px e não houve auditoria completa de contraste, teclado e leitor de tela.

### 4.7 Desempenho

Com dataset e hardware registrados, medir ao menos 30 execuções após aquecimento para:

- p50 e p95 de `GET /issues` em uma caixa geográfica definida;
- p50 e p95 de `GET /issues/nearby`;
- p50 e p95 de `POST /reports` sem foto;
- processamento de imagens de 1, 4 e 8 MB;
- tamanho do bundle e carregamento inicial;
- comportamento sob uma série controlada de requisições.

Metas de referência: p95 de consulta inferior a 800 ms e p95 de relato sem foto inferior a 1,5 s no ambiente registrado. Esses valores não representam garantia de produção. Estado: **parcial**; o bundle foi medido, mas a API não estava disponível para latência.

## 5 Registro dos resultados

| ID | Data | Commit | Ambiente | Resultado esperado | Resultado obtido | Situação | Evidência |
|---|---|---|---|---|---|---|---|
| AUT-01 a AUT-05 | 09/11/2026 | `0e63ce3` | Windows, Node 24.22.1 | Compilar e testar sem falhas | Typechecks, 3 testes e build aprovados; aviso de bundle | Aprovado com ressalva | [registro](evidencias/validacao-tecnica-2026-11-09.md) |
| DB-01 a DB-06 | 09/11/2026 | `0e63ce3` | Docker indisponível | Validar PostGIS e transações | Não executado | Não executado | [registro](evidencias/validacao-tecnica-2026-11-09.md) |
| UI-01 | 09/11/2026 | `0e63ce3` | Navegador integrado | Sem overflow e controles adequados | Sem overflow; alvos abaixo de 44 px | Parcial | [registro](evidencias/validacao-tecnica-2026-11-09.md) |

Situações permitidas: **aprovado**, **reprovado**, **parcial** e **não executado**. Uma repetição deve preservar o registro anterior e criar uma nova linha.

Atualização posterior: a evidência administrativa registra a migração aplicada duas vezes, testes no banco isolado `eco_admin_test`, revogação por redefinição e desativação, fonte agregada sem HMAC, limite de data próximo de 03:00 UTC e concorrência de ações. Após autorização, a inspeção autenticada confirmou login, fila, detalhe, resolver/reabrir com histórico, contas, filtro de resolvidas e logout. A conta fictícia foi desativada ao terminar. Os testes de componentes cobrem também troca obrigatória, proteção owner-only e identificação de alvo no histórico.

## 6 Priorização de achados

A repetição final de 11/11/2026 aprovou 8 casos de API e 9 de componentes, sem falhas ou ignorados. Consulte o [registro de entrega ADS](evidencias/entrega-ads-2026-11-11.md). As linhas anteriores permanecem históricas; casos ampliados ainda sem execução não foram convertidos em resultados aprovados.

- **Crítico:** impede fluxo essencial ou expõe dados/segredos.
- **Alto:** quebra requisito relevante ou permite abuso significativo.
- **Médio:** aumenta esforço ou reduz clareza, com alternativa disponível.
- **Baixo:** acabamento sem impacto direto no objetivo.

## 7 Critério de encerramento

A avaliação técnica estará encerrada quando:

1. todos os casos críticos tiverem resultado e evidência;
2. falhas estiverem corrigidas ou explicitamente aceitas com justificativa;
3. houver rastreabilidade entre objetivos, requisitos e resultados;
4. ambiente, commit, dados e limitações estiverem registrados;
5. o relatório não contiver afirmações além das evidências.

Um resultado desfavorável não invalida o TCC. Omissão de falhas ou fabricação de dados invalida a análise.
