# Documentação do TCC Raiz

## Entrega conforme modelo de ADS da Fatec Franca

A versão acadêmica principal segue o modelo oficial de Projeto de Software de ADS (31/08/2023), publicado em https://site.fatecfranca.edu.br/estudante/tg. O texto final está em `projeto-software-ads.md` e é espelhado em `tcc-relatorio-completo.md` para compatibilidade. O pacote Word/PDF para revisão e submissão está em `output/entrega-fatec-franca/` na raiz.

O relatório contém TAP, BPMN, requisitos, regras, casos de uso, modelo de dados, rastreabilidade, ferramentas, desenvolvimento com capturas reais, portabilidade, métricas e proposta comercial acadêmica. Documentos operacionais e evidências acompanham como complementos; o design original e os planos internos não substituem o relatório final.

Os documentos não atribuem aprovação, nota ou consentimento aos autores e à instituição. Assinaturas e escolhas no termo RIC/CPS, dados pessoais exigidos no formulário e confirmação de nome/prazo do depósito permanecem externos ao pacote técnico.

Este diretório reúne o pacote acadêmico e técnico do Trabalho de Conclusão de Curso de Tecnologia em Análise e Desenvolvimento de Sistemas sobre a plataforma Raiz, um sistema web colaborativo para registro e consulta de ocorrências ambientais.

## Estado do pacote

| Documento | Finalidade | Estado |
|---|---|---|
| [Projeto de Software ADS](projeto-software-ads.md) | Texto principal do TCC | Modelo oficial aplicado; PDF e DOCX conferidos; aceite institucional externo |
| [Documentação técnica](documentacao-tecnica.md) | Requisitos, arquitetura e implementação | Pronto para revisão |
| [Testes e avaliação técnica](testes-e-avaliacao.md) | Estratégia, critérios e registro das verificações | Integração administrativa e componentes verificados; limites registrados |
| [Checklist de validação técnica](checklist-validacao-tecnica.md) | Comandos, inspeções e evidências da entrega | Parcialmente executado e documentado |
| [Ética, LGPD e segurança](etica-lgpd-e-seguranca.md) | Proteção de dados, riscos e controles | Pronto para revisão |
| [Defesa e entrega](defesa-e-entrega.md) | Apresentação, demonstração e checklist | Pronto para adaptação |

## Convenções

- Identificação preenchida: Guilherme Henrique Campos da Silva e André Luis Maia Junior; Fatec Franca; orientador Leonardo Henrique Raiz; Franca, 2026.
- `EXECUTAR`: verificação técnica que ainda precisa ser realizada no ambiente de entrega.
- **Implementado**: comportamento verificável no código atual.
- **Parcial**: comportamento existente, mas inferior ao escopo especificado.
- **Não implementado**: requisito planejado que ainda não está presente.

Nenhum marcador deve ser substituído por estimativa. Resultados somente podem ser declarados quando houver comando, data, ambiente e evidência correspondente.

## Ordem recomendada de trabalho

1. Conferir o relatório final em Word/PDF, já estruturado no modelo institucional da Fatec Franca.
2. Revisar a questão, os objetivos e o recorte técnico com o orientador.
3. Validar a documentação técnica contra a versão exata do sistema que será demonstrada.
4. Executar compilação, testes automatizados e verificações de API, banco, segurança e desempenho.
5. Realizar as inspeções heurísticas de responsividade e acessibilidade.
6. Substituir os campos `EXECUTAR` exclusivamente por resultados comprovados.
7. Confirmar os dados externos da submissão e ensaiar a defesa.

## Evidências

As evidências devem ser armazenadas em `docs/evidencias/` ou em repositório institucional controlado. Organização sugerida:

```text
evidencias/
  compilacao-e-testes/
  api-e-banco/
  seguranca-e-desempenho/
  responsividade-e-acessibilidade/
  capturas-demonstracao/
```

Cada arquivo deve registrar data, versão do código, ambiente, procedimento, resultado esperado e resultado obtido. Segredos, endereços IP reais e dados pessoais não devem ser versionados.

## Fontes do projeto

O pacote foi elaborado a partir do código-fonte, do `README.md` da raiz e da documentação técnica do sistema. As referências e a formatação do relatório foram ajustadas ao modelo de Projeto de Software de ADS da Fatec Franca; a revisão do orientador antecede o aceite institucional.

## Limites do material atual

Os documentos resolvem a estrutura, o método, a documentação técnica, o plano de validação, a análise de riscos e a preparação da defesa. O painel administrativo e a integração com PostGIS possuem verificação local. Permanecem externos a revisão do orientador, as assinaturas e os dados institucionais do termo e do depósito.

A execução disponível em 9 de novembro de 2026 está em [evidências da validação](evidencias/validacao-tecnica-2026-11-09.md). As ações restantes devem ser conferidas diretamente no checklist de validação técnica.

A atualização do painel está em [evidências administrativas](evidencias/painel-administrativo-2026-11-09.md), complementadas pelo [registro de entrega ADS](evidencias/entrega-ads-2026-11-11.md).
