# Verificação da entrega ADS — 11 de novembro de 2026

## Ambiente e execução

Windows com Docker Desktop, serviços Linux e PostgreSQL/PostGIS. A avaliação da API utilizou o banco isolado `eco_admin_test`, sem substituir o banco da demonstração. Os testes usaram o código do workspace montado nos contêineres; a identificação por data é necessária porque a documentação estava em edição, sem commit final.

| Conjunto | Comando no contêiner | Aprovados | Falhas | Ignorados |
| --- | --- | --- | --- | --- |
| API com integração habilitada | `npm run test -w @eco/api` com `ADMIN_INTEGRATION=true` | 8 | 0 | 0 |
| Componentes web | `npm run test -w @eco/web` | 9 | 0 | 0 |

Os 17 são casos automatizados, sem equivalência com cobertura de linhas ou aprovação de todos os requisitos. A integração contém várias asserções; os componentes simulam respostas HTTP. Os três casos da prévia de coordenadas integram o total web. Os registros de 9 de novembro permanecem como evidência histórica, sem alterar suas contagens anteriores.

## Documentação e inspeção

O modelo oficial de Projeto de Software de ADS da Fatec Franca foi utilizado como base do DOCX. Capa, estilos e dimensões foram preservados e os campos de exemplo foram substituídos. O corpo foi preenchido com requisitos, TAP, BPMN, casos de uso, modelo de dados, arquitetura, telas reais com dados fictícios, métricas e referências.

A inspeção autenticada de 11 de novembro foi apenas de leitura: fila, detalhe e histórico foram capturados com conta fictícia já existente e autorizada; ao final ocorreu logout. Nenhuma ocorrência foi alterada nessa captura. A conta foi reativada anteriormente a pedido do usuário para a demonstração; não se deve confundir esse estado atual com sua desativação ao final da inspeção de 9 de novembro.

O PDF principal e os complementos foram gerados com LibreOffice em contêiner isolado. O relatório passou por inspeção das páginas renderizadas, ajustes de capa, larguras de quadros e conferência do sumário. O termo oficial RIC recebeu somente nomes, curso, título, unidade, cidade e orientador conhecidos. Autorizações, fomento, nota, data de defesa, RG, e-mails e assinaturas permaneceram sem preenchimento.

Não foram realizados testes de campo, medição de carga/p95 ou auditoria integral de acessibilidade. A entrega não declara aprovação institucional ou prontidão para operação pública.
