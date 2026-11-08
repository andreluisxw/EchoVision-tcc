# Ética, LGPD e segurança

## 1 Finalidade

Este documento orienta o tratamento responsável de dados no MVP Raiz. Ele não constitui parecer jurídico nem declaração de conformidade. Base legal, prazos, papéis e procedimentos institucionais devem ser confirmados antes de uma operação pública.

## 2 Escopo de dados

O MVP trata localização da ocorrência, categoria, descrição, fotografia, datas, endereço de rede de forma transitória e HMAC derivado do IP. A coordenada representa o local informado para o problema e não deve ser interpretada automaticamente como endereço de uma pessoa.

O painel trata também nome e e-mail dos administradores, hash de senha com salt, hash do token de sessão e eventos de auditoria. Esses dados são restritos: moderadores veem eventos de ocorrências, enquanto owners veem também eventos de contas e autenticação. Senhas temporárias aparecem somente uma vez e não integram auditoria ou logs.

As verificações do TCC usam dados fictícios. Logs e evidências técnicas devem ser sanitizados antes de entrar no repositório.

## 3 Princípios aplicados

| Princípio | Aplicação proposta |
|---|---|
| Finalidade | Explicar a necessidade de cada dado para o funcionamento. |
| Adequação | Restringir o uso à finalidade informada. |
| Necessidade | Evitar cadastro e campos pessoais desnecessários. |
| Livre acesso | Manter canal para dúvidas, correção e remoção quando aplicável. |
| Qualidade | Registrar contexto, origem e limitações dos relatos. |
| Transparência | Explicar publicação, confiança, moderação e ausência de atendimento garantido. |
| Segurança | Separar segredos, restringir acesso e sanitizar evidências. |
| Prevenção | Verificar vazamentos, upload, abuso e exposição antes da operação. |
| Não discriminação | Não usar dados para classificação prejudicial ou identificação de denunciantes. |
| Responsabilização | Manter decisões, responsáveis, registros e evidências dos controles. |

## 4 Inventário de dados da plataforma

| Dado | Uso | Exposição | Risco | Controle atual |
|---|---|---|---|---|
| Categoria e descrição | Representar problema | Pública | Conteúdo sensível ou acusatório | Validação e moderação |
| Coordenada | Mapa e proximidade | Pública | Associação com residência | Aviso e revisão futura da precisão |
| Fotografia | Evidência visual | Pública quando visível | Rosto, placa ou conteúdo impróprio | JPEG reprocessado e EXIF removido |
| IP transitório | Limite e segurança | Não público | Identificação indireta | Uso em memória e derivação HMAC |
| HMAC do IP | Quota e deduplicação | Não público | Correlação pseudonimizada | Segredo do servidor e banco restrito |
| Datas | Histórico e recência | Parcialmente pública | Correlação temporal | Minimização e política de retenção |

O HMAC continua sendo dado pseudonimizado. Não deve ser chamado de anônimo, publicado ou reutilizado para finalidade incompatível.

## 5 Direitos e transparência

Antes de uma operação controlada, a interface e a política aplicável devem informar:

- quem é responsável pelo serviço e como contatá-lo;
- quais dados são tratados e para quais finalidades;
- que relatos não equivalem a fatos oficialmente verificados;
- como solicitar acesso, correção, contestação ou remoção;
- como funciona a moderação;
- quais informações ficam públicas;
- quais são os prazos de retenção e as limitações do serviço.

O MVP não deve solicitar dados pessoais que não sejam indispensáveis ao fluxo. Dados fictícios devem ser usados na demonstração acadêmica.

## 6 Ameaças e controles

| Ameaça | Consequência | Controle atual | Lacuna antes de produção |
|---|---|---|---|
| Spam automatizado | Mapa inutilizável | Quotas por IP | Redis e proteção adaptativa |
| IP forjado | Evasão ou bloqueio indevido | Proxy explicitamente confiável | Verificação na borda real |
| NAT/IP compartilhado | Falso bloqueio | Janela temporária e mensagem | Canal de revisão e sinais adicionais |
| VPN/IP rotativo | Evasão | Moderação e limites | Proteção distribuída |
| Upload malicioso | Exploração ou conteúdo indevido | Limite, Sharp e JPEG | Antivírus, isolamento e storage externo |
| EXIF/localização | Exposição da origem | Reprocessamento | Teste automatizado contínuo |
| Rosto ou placa | Exposição pessoal | Aviso preventivo | Desfocagem e revisão |
| XSS/injeção | Execução ou alteração de dados | React, Zod e SQL parametrizado | Testes e headers revisados |
| Credencial administrativa | Controle indevido | Scrypt, sessões de 8h, RBAC, bloqueio e auditoria | MFA e revisão de segurança de produção |
| Caixa geográfica excessiva | Negação de serviço | Validação básica | Limites e testes de carga |
| Dependência de mapas | Rastreamento ou indisponibilidade | Provedor configurável | Revisão contratual e de privacidade |

## 7 Segurança de desenvolvimento e implantação

### 7.1 Segredos

- `.env` não deve ser versionado;
- valores de exemplo não podem ser usados em produção;
- segredo HMAC deve ser longo e aleatório; senhas administrativas devem ser individuais e ter ao menos 12 caracteres;
- segredos não podem entrar no bundle React, logs, capturas ou evidências;
- a rotação deve possuir procedimento documentado.

Redefinir senha ou desativar conta pelo owner revoga sessões. A senha temporária deve ser entregue por canal privado e trocada no primeiro acesso. Fora de localhost, usar HTTPS e `ADMIN_COOKIE_SECURE=true`. Eventos são imutáveis pela aplicação e por trigger, mas o administrador do banco conserva poderes; restrinja esse acesso e proteja backups.

### 7.2 Rede

- usar HTTPS fora do ambiente local;
- restringir CORS aos domínios necessários;
- manter banco e API em rede privada quando o Nginx for a borda;
- confiar em `X-Forwarded-For` somente de proxies conhecidos;
- limitar payload, duração, área geográfica e conexões.

### 7.3 Banco e mídia

- usar privilégio mínimo;
- aplicar migrations versionadas;
- fazer backup do banco e do volume de imagens;
- testar restauração;
- impedir listagem pública do diretório de storage;
- eliminar arquivos órfãos e rejeitados conforme política.

### 7.4 Logs e observabilidade

Registrar request ID, rota, status, latência e código de erro. Evitar IP bruto, descrição, coordenada precisa e conteúdo da fotografia nos logs. Monitorar erros 5xx, crescimento do storage, indisponibilidade do banco, excesso de 429 e fila de moderação.

## 8 Retenção proposta

Os prazos abaixo são pontos de decisão, não política aprovada:

| Dado | Proposta inicial | Aprovação necessária |
|---|---|---|
| IP bruto em log | Evitar; quando indispensável, até 7 dias | Responsável e orientação competente |
| HMAC do IP | Até 30 dias para deduplicação | Produto e privacidade |
| Relatos e ocorrências | Enquanto necessários ao propósito e revisão | Política do serviço |
| Fotos | Enquanto necessárias e visíveis; rejeitadas removidas | Moderação e política |
| Auditoria administrativa | Prazo proporcional à responsabilização | Operação e jurídico |
| Evidências técnicas | Até a aprovação acadêmica e prazo institucional | Orientador e unidade |

## 9 Resposta a incidentes

1. Conter o acesso ou a publicação indevida.
2. Preservar evidências técnicas sem ampliar a exposição.
3. Registrar horário, sistemas, dados e responsáveis.
4. Avaliar impacto e pessoas afetadas.
5. Comunicar os responsáveis institucionais.
6. Cumprir as obrigações aplicáveis.
7. Corrigir a causa e verificar a correção.
8. Documentar o aprendizado e revisar controles.

Contatos e responsabilidades devem ser definidos antes de qualquer operação controlada.

## 10 Critérios de prontidão

- [ ] responsáveis, papéis e contatos foram preenchidos;
- [ ] base legal e política de privacidade foram revisadas;
- [ ] a demonstração contém somente eventos fictícios;
- [ ] banco e storage possuem backup e controle de acesso;
- [ ] não há segredos no repositório ou frontend;
- [ ] upload, limites e remoção de EXIF foram verificados;
- [ ] existe processo de correção, contestação e remoção;
- [ ] plano de incidente e moderação foi definido;
- [ ] limitações estão visíveis na interface;
- [ ] resultados do [checklist técnico](checklist-validacao-tecnica.md) foram revisados.

## 11 Pendências

As decisões externas devem ser validadas com o orientador e os responsáveis institucionais antes da entrega.

- definir controlador, operadores e canal de direitos;
- confirmar base legal e prazos com orientação competente;
- aprovar política de moderação e conteúdo sensível;
- definir região de operação e precisão pública por categoria;
- definir processo de exclusão, contestação e incidente;
- `EXECUTAR` as verificações de segurança e privacidade previstas.
