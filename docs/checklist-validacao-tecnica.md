# Checklist de validação técnica

## 1 Como usar

Execute este roteiro na versão candidata à entrega. Salve logs e capturas em `docs/evidencias/`, sem segredos ou dados pessoais. Para cada item, registre data, commit, ambiente, resultado e caminho da evidência. Não transforme um item não executado em aprovado.

## 2 Identificação da execução

| Campo | Valor |
|---|---|
| Data | 9 de novembro de 2026 |
| Commit | `0e63ce39ea7faf3c656538ac4b0dc5a1968079b3` |
| Sistema operacional | Microsoft Windows NT 10.0.26100, 64 bits |
| Node e pnpm | Node 24.22.1; pnpm 11.25.0 |
| Docker | Disponível na atualização administrativa; consultar evidência complementar |
| Navegador | Navegador Chromium integrado |

## 3 Preparação

- [ ] A árvore de trabalho corresponde à versão candidata.
- [ ] Dependências foram instaladas pelo lockfile.
- [ ] Variáveis obrigatórias existem e não usam valores de produção.
- [ ] O conjunto de dados é fictício e reproduzível.
- [ ] Logs e capturas não revelam segredos.

Comandos de identificação:

```powershell
git rev-parse HEAD
node --version
pnpm --version
docker --version
```

## 4 Compilação e testes automatizados

```powershell
pnpm --filter @eco/shared build
pnpm --filter @eco/api build
pnpm --filter @eco/web build
pnpm --filter @eco/api test
```

- [x] Os três builds terminaram com código zero.
- [x] Todos os testes terminaram com código zero.
- [x] Quantidade de casos aprovados foi registrada.
- [x] Advertências relevantes foram discutidas no relatório.

## 5 Ambiente integrado

Use o procedimento do `README.md` da raiz para iniciar a composição Docker.

- [x] PostgreSQL iniciou com PostGIS habilitado.
- [ ] Schema e índices foram criados em volume vazio.
- [x] API alcança o banco.
- [x] `GET /health` retorna sucesso.
- [x] Frontend é servido pelo proxy.
- [ ] Reinício preserva os dados esperados.
- [ ] Backup e restauração foram ao menos documentados.

## 6 API e banco geoespacial

- [x] `GET /categories` retorna as seis categorias previstas.
- [ ] Consulta por caixa geográfica respeita área e filtros.
- [ ] Caixa excessiva ou malformada é rejeitada.
- [ ] Consulta de proximidade respeita categoria e raio.
- [ ] Um relato válido cria os registros relacionados atomicamente.
- [ ] UUID e payload inválidos retornam erro controlado.
- [x] Item oculto não aparece na resposta pública.
- [ ] Respostas não expõem colunas internas ou stack trace.

Para cada caso, arquive requisição, status, corpo sanitizado e consulta de conferência quando aplicável.

## 7 Segurança e privacidade

- [ ] IP bruto não aparece em resposta, banco ou log.
- [ ] Cabeçalho de proxy vindo de origem não confiável é ignorado.
- [ ] O limite por período retorna 429 e informa espera.
- [ ] A repetição proibida não altera contadores.
- [x] Sessão administrativa ausente ou revogada retorna 401; papel inadequado retorna 403.
- [ ] Foto acima do limite retorna 413.
- [ ] SVG, arquivo corrompido e executável renomeado são rejeitados.
- [ ] Imagem aceita é reprocessada e não conserva EXIF.
- [ ] Chave interna de mídia não aparece na API pública.
- [ ] Busca de segredos no repositório foi revisada.
- [ ] Dependências vulneráveis foram registradas e classificadas.

## 8 Desempenho

- [ ] Hardware, dataset, aquecimento e quantidade de execuções foram registrados.
- [ ] `GET /issues` possui p50 e p95 calculados.
- [ ] `GET /issues/nearby` possui p50 e p95 calculados.
- [ ] `POST /reports` sem foto possui p50 e p95 calculados.
- [ ] Tempos de imagens de 1, 4 e 8 MB foram registrados.
- [ ] Tamanho do bundle foi registrado.
- [ ] Limitações do cenário foram descritas.

## 9 Responsividade

Verifique 360, 390, 768, 1024 e 1440 pixels:

- [ ] Mapa, filtros e painéis continuam acessíveis.
- [ ] Formulários não apresentam corte ou rolagem horizontal indevida.
- [ ] Teclado virtual não encobre a ação principal.
- [ ] Mensagens de sucesso e erro permanecem legíveis.
- [ ] Orientação e redimensionamento não perdem estado essencial.
- [ ] Uma captura por largura foi arquivada.

## 10 Inspeção heurística de acessibilidade e interação

- [ ] Todo fluxo essencial pode ser percorrido por teclado.
- [ ] A ordem de foco é lógica e o foco é visível.
- [ ] Controles possuem nome e rótulo compreensíveis.
- [ ] Contraste foi verificado com ferramenta apropriada.
- [ ] Informação não depende apenas de cor.
- [ ] Zoom de 200% preserva conteúdo e operação.
- [ ] Botões e ícones apresentam nome acessível.
- [ ] O mapa possui alternativa textual ou em lista.
- [ ] O sistema informa carregamento, sucesso e erro.
- [ ] Mensagens ajudam a corrigir entradas inválidas.
- [ ] Termos e estados são consistentes entre telas.
- [ ] Relato, ocorrência, corroboração e verificação estão diferenciados.

Registre cada achado com severidade, captura, requisito e recomendação. O resultado é uma inspeção do escopo definido, não uma declaração de conformidade integral.

## 11 Matriz final

| Área | Situação | Evidência | Pendência |
|---|---|---|---|
| Compilação | Aprovado | [registro](evidencias/validacao-tecnica-2026-11-09.md) | Repetir se o código mudar |
| Testes automatizados | Aprovado: 8 API + 6 componentes | [registro administrativo](evidencias/painel-administrativo-2026-11-09.md) | Cobertura ampliada de carga e upload pendente |
| API e banco | Integração administrativa aprovada | [registro administrativo](evidencias/painel-administrativo-2026-11-09.md) | Ensaio completo no computador da defesa |
| Segurança e privacidade | Parcial | [registro](evidencias/validacao-tecnica-2026-11-09.md) | Casos integrados pendentes |
| Desempenho | Parcial | [registro](evidencias/validacao-tecnica-2026-11-09.md) | Latência da API pendente; bundle grande |
| Responsividade | Parcial | [registro](evidencias/validacao-tecnica-2026-11-09.md) | API ausente durante inspeção |
| Acessibilidade e interação | Parcial | [registro](evidencias/validacao-tecnica-2026-11-09.md) | Alvos pequenos e auditorias pendentes |

## 12 Decisão de prontidão

- [ ] Todos os itens críticos têm evidência.
- [ ] Falhas abertas possuem impacto e tratamento descritos.
- [ ] A demonstração usa somente dados fictícios.
- [ ] O texto final distingue o que foi comprovado do que é futuro.
- [ ] O orientador revisou o recorte e as limitações.

**Decisão:** fluxos administrativos integrados verificados para demonstração local; preparar primeiro owner e conferir sessão autenticada antes da defesa; não apto para operação pública.

**Justificativa:** compilação, testes de API integrada e componentes foram aprovados. Docker/PostGIS está disponível na atualização administrativa. A inspeção visual inicial encontrou alvos abaixo de 44 px; acessibilidade e carga ampliadas permanecem parciais. O identificador antigo no cabeçalho refere-se à primeira execução; a evidência complementar registra a evolução.
