# Evidência de validação técnica — 9 de novembro de 2026

> Registro histórico da primeira execução, anterior ao painel. A indisponibilidade de Docker descrita aqui foi superada posteriormente; consultar [atualização administrativa](painel-administrativo-2026-11-09.md) para o estado atual. Resultados antigos são preservados para rastreabilidade.

## Identificação

| Campo | Valor |
|---|---|
| Data | 9 de novembro de 2026 |
| Fuso | America/Sao_Paulo |
| Commit do código verificado | `0e63ce39ea7faf3c656538ac4b0dc5a1968079b3` |
| Sistema | Microsoft Windows NT 10.0.26100, 64 bits |
| Node.js | 24.22.1 |
| pnpm | 11.25.0 |
| Docker | Indisponível no ambiente |

## Resultados reproduzidos

| Área | Procedimento | Resultado |
|---|---|---|
| Tipos compartilhados | `tsc -p tsconfig.json` em `packages/shared` | Aprovado, código de saída 0 |
| API | `tsc -p tsconfig.json` em `apps/api` | Aprovado, código de saída 0 |
| Frontend | `tsc -b` em `apps/web` | Aprovado, código de saída 0 |
| Testes da API | Node Test Runner com `apps/api/src/limiter.test.ts` | 3 aprovados, 0 falhas |
| Bundle do frontend | `vite build` em `apps/web` | Aprovado, 1.587 módulos transformados |

Os três testes aprovados verificam: limite conjunto por hora, preservação do limite diário e devolução única de uma reserva inválida.

## Bundle

| Artefato | Tamanho | Gzip |
|---|---:|---:|
| `dist/index.html` | 0,62 kB | 0,38 kB |
| CSS principal | 88,29 kB | 14,83 kB |
| JavaScript principal | 1.317,89 kB | 365,92 kB |

O Vite emitiu aviso porque o chunk JavaScript supera 500 kB após minificação. O build é válido, mas divisão de código permanece uma melhoria de desempenho.

## Inspeção responsiva e heurística

O frontend estático foi aberto no navegador integrado e inspecionado em 360, 390, 768, 1024 e 1440 px de largura.

Resultados:

- não foi detectada rolagem horizontal nas cinco larguras;
- os controles visíveis apresentaram nomes acessíveis, com exceção do `input` de arquivo visualmente oculto e acionado por botão nomeado;
- mapa, filtros e formulário mudaram de disposição conforme a largura;
- foram encontrados alvos menores que 44 px, incluindo menu, controles do mapa, ação de cancelamento e alguns botões com 38–42 px de altura;
- a consulta à API falhou de forma controlada, pois backend e banco não estavam ativos;
- não foram realizados leitor de tela, auditoria completa de contraste nem fluxo com teclado virtual real.

Classificação: **parcial** para responsividade e acessibilidade. A ausência de rolagem horizontal foi comprovada, mas os alvos pequenos e as verificações não executadas impedem aprovação integral.

## Segurança estática

- `.env` não é rastreado pelo Git;
- `.env.example` é rastreado como modelo;
- typecheck e build não expuseram segredos nos logs observados.

Não foram executados os casos de proxy, upload, EXIF, moderação e persistência porque exigem a API integrada ao PostGIS. Classificação: **parcial**.

## Limitações

Docker não está disponível nesta máquina. Por isso, não foram executados schema PostGIS, seed, smoke test HTTP, contratos integrados, upload, moderação, medições de latência da API, backup ou restauração. Nenhum desses itens deve ser apresentado como aprovado.
