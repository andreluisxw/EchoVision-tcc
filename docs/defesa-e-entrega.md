# Defesa e entrega do TCC

## 1 Finalidade

Este documento organiza a defesa do Projeto de Software de ADS sobre a plataforma Raiz, estruturado no modelo oficial da Fatec Franca. O roteiro de apresentação deve ser ajustado ao tempo confirmado pela banca. Resultados marcados como `EXECUTAR` não podem ser apresentados como concluídos.

## 2 Mensagem central

O trabalho projeta, implementa e verifica tecnicamente um MVP web colaborativo para registrar, consolidar e consultar ocorrências ambientais sem cadastro obrigatório. A contribuição é demonstrar como baixa fricção, informação geográfica, prevenção básica de abuso e transparência sobre confiança podem ser combinadas em um artefato de ADS, com limites explícitos.

O sistema não comprova ocorrências, não garante atendimento público e não está pronto para lançamento irrestrito. Essas restrições demonstram análise crítica e orientam a evolução.

## 3 Roteiro de apresentação de 15 a 20 minutos

### Slide 1 — Título e contexto — 1 minuto

- título, autores, orientador, curso e unidade;
- relatos ambientais ficam dispersos e difíceis de consultar espacialmente.

### Slide 2 — Problema e questão — 2 minutos

- dispersão e duplicidade de relatos;
- diferença entre repetição e verificação;
- riscos da publicação sem cadastro, localização e fotografia.

> Como projetar, implementar e verificar tecnicamente uma aplicação web colaborativa, sem cadastro obrigatório, para o registro, a consolidação e a consulta de ocorrências ambientais, mantendo controles básicos de qualidade, privacidade e prevenção de abuso?

### Slide 3 — Objetivos — 1 minuto

Agrupar os cinco objetivos em:

1. modelagem e arquitetura;
2. implementação e controles;
3. verificação, riscos e prontidão.

### Slide 4 — Método — 2 minutos

- pesquisa aplicada, tecnológica e descritiva;
- construção e avaliação técnica de artefato de software, com referência aos princípios de Design Science Research;
- problema, objetivos, projeto, desenvolvimento, demonstração e avaliação técnica;
- evidências produzidas por compiladores, testes, requisições, medições e inspeções documentadas.

### Slide 5 — Requisitos e decisões — 2 minutos

- Issue é diferente de Report;
- criação sem conta;
- sugestão por proximidade antes de criar;
- estados `unverified`, `corroborated` e `verified`;
- agrupamento visual é diferente de consolidação;
- foto opcional e localização controlada na interface.

### Slide 6 — Arquitetura — 2 minutos

```text
React e MapLibre → Nginx/proxy → Fastify → PostgreSQL/PostGIS
                                      └──→ volume privado de imagens
```

Explicar contrato REST, implantação separada e papel do PostGIS.

### Slide 7 — Segurança e privacidade — 2 minutos

- quotas por IP em duas janelas;
- IPv6 normalizado e HMAC;
- IP bruto não persistido nos relatos;
- reprocessamento JPEG e remoção de EXIF;
- proxy confiável e API privada;
- contas individuais, papéis, sessões revogáveis e histórico por autor;
- limitações: NAT, VPN, storage local, ausência de MFA e política operacional ainda pendente.

### Slide 8 — Demonstração — 3 a 4 minutos

Executar a sequência da seção 4 com dados fictícios. Evitar digitação longa e GPS real.

### Slide 9 — Verificação técnica — 2 minutos

- typecheck aprovado nos três projetos;
- testes automatizados de API, senhas, datas, permissões e componentes do painel aprovados, conforme evidência atual;
- build de produção aprovado com aviso de bundle grande;
- cinco larguras sem rolagem horizontal;
- alvos menores que 44 px como achado de acessibilidade;
- API e PostGIS executados em Docker, com moderação e auditoria verificadas.

Mostrar somente números e evidências efetivamente obtidos.

### Slide 10 — Resultados e discussão — 2 minutos

- situação por área: aprovado, reprovado, parcial ou não executado;
- até três falhas ou achados prioritários;
- relação entre resultados e objetivos;
- limitações do ambiente e do método;
- decisão de prontidão do MVP.

### Slide 11 — Conclusão — 1 minuto

- responder à questão no limite das evidências técnicas;
- destacar a contribuição de ADS;
- reconhecer lacunas;
- indicar próximos passos.

### Slide 12 — Encerramento — 30 segundos

> O resultado é um artefato implementado e documentado que materializa decisões de arquitetura, geoprocessamento, privacidade e confiança. Sua funcionalidade integrada e sua prontidão dependem das verificações registradas.

## 4 Roteiro de demonstração

### 4.1 Preparação

- usar notebook ligado à energia;
- desativar notificações e atualizações;
- subir o ambiente com antecedência;
- executar health check;
- carregar seed fictício;
- abrir mapa em viewport conhecida;
- separar app, API e slides;
- manter vídeo e capturas de contingência;
- nunca usar dado pessoal ou ocorrência real.

### 4.2 Sequência principal

1. Abrir o mapa e mostrar as categorias.
2. Filtrar uma categoria e selecionar um pin.
3. Mostrar quantidade de relatos e estado de confiança.
4. Iniciar um relato e marcar localização manualmente.
5. Mostrar sugestão de ocorrência próxima.
6. Confirmar a existente.
7. Criar uma ocorrência diferente sem foto.
8. Se seguro, mostrar upload com imagem fictícia.
9. Mostrar ou explicar a evidência automatizada de quota.
10. Entrar no painel com conta fictícia previamente preparada, sem expor a senha.
11. Resolver uma ocorrência com justificativa, mostrar autor/data no histórico e habilitar resolvidas no mapa.
12. Reabrir a ocorrência e explicar preservação dos relatos e da auditoria.

### 4.3 Contingência

Se o ambiente falhar, mostrar vídeo previamente gravado, capturas, respostas sanitizadas e uma explicação breve da causa. Não simular funcionamento. Registrar a limitação no relatório.

## 5 Checklist acadêmico

- [x] autores, orientador, unidade, cidade e ano preenchidos no relatório;
- [ ] título, questão, objetivos e recorte aprovados;
- [ ] método descreve somente o que foi realizado;
- [ ] todos os `EXECUTAR` aplicáveis foram resolvidos ou explicados;
- [ ] conclusão não extrapola as evidências;
- [ ] referências estão no padrão exigido;
- [ ] figuras e tabelas estão numeradas e citadas;
- [ ] resumo e abstract estão atualizados;
- [x] modelo oficial e revisão textual foram aplicados ao relatório;
- [ ] versão, formato e prazo de entrega foram confirmados.

## 6 Checklist técnico

- [ ] commit demonstrado identificado;
- [ ] lockfile preservado e dependências instaladas;
- [ ] banco e volumes iniciam no estado esperado;
- [ ] variáveis e segredos são próprios do ambiente;
- [ ] schema e seed foram verificados;
- [ ] frontend, API e tipos compilam;
- [ ] testes automatizados passam;
- [ ] health check retorna sucesso;
- [ ] API, PostGIS, segurança e desempenho têm evidências;
- [ ] resoluções da apresentação foram verificadas;
- [ ] dados da demonstração são fictícios;
- [ ] nenhum segredo aparece em slides, logs ou terminal;
- [ ] vídeo e capturas funcionam sem rede;
- [ ] demonstração permanece abaixo de quatro minutos.

## 7 Perguntas prováveis da banca

### Por que não exigir cadastro?

Para reduzir a barreira no MVP. A decisão transfere parte do controle para quotas por IP e moderação, com limitações reconhecidas. Contas opcionais e reputação são evoluções possíveis.

### Como o sistema sabe que uma ocorrência é verdadeira?

Ele não sabe automaticamente. Relatos começam como `unverified`. Repetição pode gerar `corroborated`, que não equivale a validação oficial. `verified` exige ação administrativa baseada em fonte adequada.

### Por que IP não prova identidade?

Redes compartilhadas podem representar várias pessoas no mesmo IP, enquanto VPNs e redes móveis permitem alternância. O IP é um sinal operacional limitado.

### HMAC torna o IP anônimo?

Não. Ele reduz a exposição do valor bruto, mas preserva correlação dentro do domínio e do segredo; portanto, é pseudonimização.

### Qual a diferença entre cluster e ocorrência consolidada?

Cluster é um agrupamento visual de diferentes ocorrências em determinado zoom. Consolidação associa vários relatos ao mesmo objeto de ocorrência.

### Por que PostGIS?

Porque o domínio exige distância em metros, caixa geográfica e índices espaciais. PostGIS oferece tipos geográficos, GiST e operações como `ST_DWithin` dentro do banco.

### O sistema está pronto para produção?

Não. O MVP já tem contas, papéis e auditoria, mas requer moderação operacional, política LGPD, MFA conforme risco, storage externo, proteção distribuída, carga ampliada, monitoramento, backup e revisão de segurança.

### Por que utilizar Design Science Research?

Porque o trabalho investiga um problema por meio da construção e avaliação de um artefato. O método conecta relevância, decisões de projeto, demonstração e evidências de avaliação.

### Como a qualidade de uso será avaliada sem sessões externas?

Por inspeção heurística documentada dos fluxos, cobrindo consistência, visibilidade do estado, prevenção e recuperação de erros, responsividade e critérios da WCAG 2.2. Depois da execução, a conclusão deverá se limitar a essa inspeção e não representar percepção em uso real.

### A ausência de avaliação em uso real invalida o TCC?

Não necessariamente. O recorte é técnico e compatível com ADS, desde que questão, objetivos, método e conclusão estejam alinhados e a limitação seja explícita. A aceitação formal depende do orientador e das regras da unidade.

### Qual é a principal contribuição?

A combinação documentada entre modelo Issue/Report, consulta geográfica, baixa fricção, prevenção básica de abuso e comunicação explícita de confiança, acompanhada de rastreabilidade e avaliação técnica.

### O que deve ser feito depois do TCC?

Tratar achados críticos, implementar idempotência, ampliar proteção de autenticação e moderação, mover quotas e mídia para serviços compartilhados e planejar uma operação controlada com governança definida.

## 8 Perguntas que exigem evidência

Não responder antecipadamente:

- “Todos os testes passaram?” — apresentar o log da versão entregue.
- “Qual foi o p95?” — responder com cenário, valor e evidência.
- “O sistema suporta quantos acessos?” — não inferir além do teste executado.
- “A aplicação é plenamente acessível?” — explicar o escopo da inspeção.
- “O sistema resolveu o problema ambiental?” — essa afirmação está fora do recorte.

## 9 Ensaio final

Realizar ao menos dois ensaios cronometrados:

1. técnico, focado em demonstração e contingência;
2. completo, com slides, transições, perguntas e limite de tempo.

Uma pessoa externa pode revisar a clareza da apresentação, sem que isso seja tratado como resultado científico. Corrigir afirmações não sustentadas e slides densos sem alterar ou esconder resultados.
