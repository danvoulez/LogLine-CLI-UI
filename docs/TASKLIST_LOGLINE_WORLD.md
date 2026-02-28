# Tasklist Ecossistema logline.world

Proposta de **trilhas com dependências explícitas** e **artefatos verificáveis**, alinhada ao Phase 0, `ECOSYSTEM_PHASE0_APPROVED_V1`, `ECOSYSTEM_GREEN_TASKLIST`, `ROADMAP`, `AUTH_PERMANENT_PLAN` e invariantes em `LOGLINE_ECOSYSTEM_NORMATIVE_BASE`.

**Invariantes (não negociáveis):** UI como adapter; Rust/Control Plane como autoridade; scope canônico (tenant_id, app_id, user_id); ledger idempotente e append-only; sem bypass de checks centrais.

**Onde implementar — regra clara:**  
Toda **lógica de domínio**, **policy**, **ledger**, **pricing**, **middleware chain** (autoridade) e **capabilities** devem ser implementadas **em Rust** no workspace `logline/` (daemon, `logline-core`, `logline-runtime`, crates compartilhados). O CLI é a primeira superfície de validação; a API/UI Next.js é **apenas adapter/proxy** — não contém motor de domínio. Ver `LOGLINE_ECOSYSTEM_NORMATIVE_BASE`: “Business logic MUST have a single authority in Rust runtime/control plane”; “Domain capabilities MUST be defined in shared Rust core crates before transport/interface exposure.”

**Referência aos docs:** `docs/ECOSYSTEM_GREEN_TASKLIST.md` (fases verdes e ordem recomendada); `docs/ROADMAP.md` (Active / Next / Green track). Esta tasklist está rebaseada neles + Phase0 / Normative Base / Auth Permanent / Operating Posture / Architecture / Deployment / Runbook.

**Formato:** Cada trilha tem **Por quê**, **O que fazer** (sequência), **O que não fazer**, **DoD** (verificável) e **Artefatos** (PR, migration, teste, doc, dashboard quando aplicável).

---

## 0) Dependências — mapa que evita retrabalho

Ordem **canônica** (Phase 0 / Green Tasklist):

| # | Trilha | Depende de |
|---|--------|------------|
| 1 | **Identidade e escopo** (tenant_id / app_id / user_id) | — |
| 2 | **Postura Tier A/B/C** + matriz de risco | 1 (boundary + identity) |
| 3 | **Middleware chain** para Tier A (auth → scope → policy → execution → audit) | 1, 2 |
| 4 | **Policy decision contract** (explicável, versionado) | 2, 3 |
| 5 | **Usage ledger canon** (fuel normalizado, idempotente, append-only) | 1 |
| 6 | **Pricing derivation** centralizada e versionada (apps não se auto-precificam) | 5 |

Ou seja: não dá para fazer policy/ledger/pricing “solto”; identity e tier vêm primeiro; middleware depende de classificação; ledger é pré-requisito de pricing. **Toda essa cadeia (identity, policy, ledger, pricing, middleware como autoridade) é implementada em Rust** (`logline/`); a app Next.js chama o daemon ou expõe apenas proxies.

---

## Curto prazo (1–4 semanas) — “fechar o core sem perder velocidade”

### Trilha A) Identidade e Auth — “quem é você + onde você está”

**Por quê:** Phase 0 define que operação protegida só existe depois de resolver scope canônico; escopo vindo do cliente não é confiável (Normative Base: client-provided scope is untrusted until validated).

**Implementação:** Resolução de **scope canônico** (tenant_id, app_id, user_id) e validação de identidade são autoridade; o **daemon em Rust** deve aplicar essa resolução em todas as operações protegidas. A app Next.js pode fazer um gate inicial (ex.: requireAccess com JWT) e repassar; a autoridade final (quem pode fazer o quê em qual scope) fica em Rust.

**Tarefas:**
- [ ] **Phase A Auth (Supabase Identity)** — Garantir 100% dos endpoints protegidos aceitando Supabase JWT; manter `AUTH_PROVIDER_MODE=compat` como rollback.
- [ ] **Auth-to-workspace mapping** — Substituir seleção manual/header de workspace por identidade assinada (JWT claims); alinhar com Phase 0.2 (canonical identity scope). `workspace_id` não pode ser só header/localStorage — tem que ser claim ou contexto validado.
- [ ] **Gate de verdade na app layer (gap)** — Rotas de produto (`/api/panels`, `/api/settings`, `/api/chat`, `/api/effective-config`, `/api/llm-gateway`, etc.) não chamam `requireAccess()`; apenas `/api/logline/[...path]` chama. Alinhar: (a) fazer `requireAccess()` virar middleware padrão em rotas de produto, ou (b) mover tudo protegido para catch-all único (`/api/logline/*`) e documentar como regra; atualizar `API_CONTRACTS.md`.
- [ ] **Workspace switcher na UI** — Surface para troca de workspace no header/shell; hooks já emitem `x-workspace-id`; só troca se houver membership/claim válido (hoje só `localStorage.ublx_workspace_id`).

**O que fazer (sequência):** Resolver identidade canônica (tenant_id, app_id, user_id) a partir de JWT/claims; expor troca de workspace na UI; garantir que todos os endpoints protegidos aceitem Supabase JWT; unificar o gate de auth na app (requireAccess em todas as rotas de produto ou roteamento único via /api/logline) e refletir no contrato.

**O que não fazer:** Confiar em `x-workspace-id` sem validar (viola Phase 0.2). Criar atalhos por rota que bypassem o gate (viola Normative Base: sem bypass de checks centrais). Remover modo compat sem rollback documentado. Deixar rotas de produto sem gate de auth na app sem decisão explícita e documentada.

**DoD (verificável):**
- [ ] 100% das rotas protegidas rejeitam sem JWT válido (teste automatizado).
- [ ] Workspace efetivo sempre vem de claim/contexto validado (não só header).
- [ ] Doc de contratos (`API_CONTRACTS.md`) bate com implementação (sem “muitas rotas fazem X” quando não fazem).
- [ ] Rollback com AUTH_PROVIDER_MODE=compat testado.
- [ ] Workspace switcher visível e funcional no shell.

**Artefatos:** PR(s) auth + gate; doc `API_CONTRACTS.md` atualizado; teste de rejeição sem JWT; rollback compat testado.

---

### Trilha B) Guardrails de plataforma — Tier A não nasce “solto”

**Por quê:** Operating Posture define Tier A como identity/policy/billing/irreversível e exige audit forte; política fragmentada em cada handler viola HQ como autoridade.

**Depende de:** Trilha A (identity/scope) para aplicar chain com contexto válido.

**Implementação:** A **middleware chain** (auth → scope → policy → handler → audit) e a **autoridade** de policy/scope são implementadas **em Rust** (daemon / crates). A app Next.js não contém essa chain — apenas repassa ao daemon ou aplica um gate mínimo (ex.: requireAccess) antes de proxy.

**Tarefas:**
- [ ] **1.2 Shared middleware chain (Rust)** — Implementar cadeia padrão `auth → scope → policy → handler → audit` para todos os endpoints Tier A **no daemon/crates** (apenas Tier A; não burocratizar Tier C).
- [ ] **Classificação Tier A/B/C** — Classificar cada rota/ação conforme `LOGLINE_OPERATING_POSTURE`; documentar matriz (tabela simples em doc).
- [ ] **1.1 Rust-authority route rule** — Lint/CI que falha quando lógica de domínio (Rust-owned) aparece em rotas Next.js que deveriam ser apenas proxy (UI deve ser adapter). Reforça: domínio fica em Rust; Next.js só adapta.

**O que fazer:** Implementar middleware chain (auth → scope → policy → handler → audit) para Tier A; classificar todas as rotas/ações em Tier A/B/C e publicar matriz; adicionar check de CI que impeça lógica de domínio em rotas proxy Next.js.

**O que não fazer:** Colocar lógica de negócio Rust-owned em handlers Next.js. “Política” em cada handler (fragmenta HQ). Criar rotas Tier A sem passar pela chain. Classificar rotas sem documentar. Transformar Tier C em audit theater (Operating Posture manda o oposto).

**DoD (verificável):**
- [ ] Toda rota Tier A passa pela chain (teste automatizado).
- [ ] PR com lógica de domínio em rota proxy falha no CI.
- [ ] Matriz Tier A/B/C publicada e revisada.

**Artefatos:** PR middleware + matriz; doc com matriz; teste CI da chain; CI rule para proxy-only.

---

### Trilha C) Segurança imediata — só o que reduz risco real

**Tarefas:**
- [ ] **Rate limiting** — Em `/api/v1/cli/auth/*`, `/api/v1/founder/*` e rotas de proxy sensíveis; com métricas/observabilidade.
- [ ] **Audit logging** — Para writes em `/api/settings` e transições de modo de auth; com correlation_id/run_id para query.
- [ ] **CI secret scanning** — Política e checks em docs/exemplos para evitar vazamento de segredos; triagem de falsos positivos documentada.

**O que fazer:** Aplicar rate limit em CLI auth, founder e proxies sensíveis; registrar em audit writes de settings e mudanças de modo de auth; adicionar pipeline/check que detecte segredos em docs e exemplos.

**O que não fazer:** Rate limit bloqueante sem métricas/observabilidade. Audit sem retention/correlation_id. Scanning que bloqueie builds por falsos positivos sem triagem.

**DoD (verificável):**
- [ ] Logs/audit consultáveis + correlação por request/run_id.
- [ ] Rate limiting ativo e configurável nos endpoints listados.
- [ ] Secret scanning no CI com política documentada e triagem de falsos positivos.

**Artefatos:** PR rate-limit + audit; migration/seeded config se necessário; doc de política de audit; dashboard ou query de exemplo para audit.

---

### Trilha D) Confiabilidade — não deixar chat “pendurado”

**Por quê:** Runbook e Architecture apontam: quando dá ruim, muitas vezes é upstream/credit/retry, não auth.

**Tarefas:**
- [ ] **Gateway provider reliability** — Garantir pelo menos um backend saudável por modo (local/premium) ou falhar rápido; evitar retries longos quando upstreams estão indisponíveis.
- [ ] **Health/backoff** — Comportamento explícito quando provider/credit falha (evitar hang indefinido no chat); timeout/backoff documentado; UI com mensagem ou fallback em tempo limitado.
- [ ] **Degradação quando daemon indisponível (gap)** — Se o daemon estiver down, todas as rotas de produto retornam 502; definir estratégia: health check no shell, mensagem clara (banner), opcional cache read-only ou estado “degraded”.

**O que fazer:** Garantir pelo menos um backend saudável por modo (local/premium) ou falhar rápido; definir timeout/backoff e feedback claro (UI/mensagem) quando provider ou crédito falha; UI mostrando estado “degraded” quando daemon/gateway está ruim (banner).

**O que não fazer:** Retries indefinidos ou muito longos sem timeout. Silenciar falhas de upstream sem informar o usuário. Ignorar health do gateway na escolha de backend.

**DoD (verificável):**
- [ ] Sem hang indefinido: erro ou fallback em tempo limitado (teste ou checklist manual).
- [ ] Health influencia seleção de backend (mesmo que simples no começo).
- [ ] Daemon down → UI entra em modo read-only ou exibe mensagem clara (degraded mode).
- [ ] Política de retry/backoff documentada e aplicada.

**Artefatos:** PR backoff + timeout; PR banner/modo degraded; doc de comportamento esperado; teste de não-hang (opcional).

---

### Trilha E) Infra e qualidade — schema, E2E, degradação, PWA

**Por quê:** Supabase como system-of-record sugere schema canônico; drift entre Drizzle/bootstrap/migrations gera retrabalho; E2E e degraded mode fecham gaps já listados.

**Tarefas:**
- [ ] **Fonte única de schema (gap)** — Existem `db/schema.ts` (Drizzle), `db/bootstrap.ts` (SQL inline) e `supabase/migrations/*`; risco de drift. Definir fonte canônica (ex.: Supabase migrations) e gerar ou manter o resto em sync; ou documentar processo de atualização conjunta.
- [ ] **Testes E2E (gap)** — Não há suíte E2E (Playwright/Cypress); apenas `test:template-contract` e testes Rust no workspace logline. Introduzir E2E mínima para fluxos críticos: login, criar panel, store (Playwright no CI).
- [ ] **Degradação quando daemon indisponível (gap)** — Se o daemon estiver down, todas as rotas de produto retornam 502; não há cache read-only nem mensagem estruturada. Definir estratégia (ex.: health check no shell, mensagem clara, opcional cache de último estado) e implementar.
- [ ] **PWA / offline (gap)** — Existem `public/sw.js` e `components/pwa/PWARegister.tsx`; validar fluxo completo de install/offline e documentar em GETTING_STARTED ou OPERATIONS; garantir que comportamento offline seja explícito (ex.: “sem daemon, apenas leitura em cache” ou mensagem clara).

**O que fazer:** Definir **schema canon** (ex.: Supabase migrations) e processo escrito para manter Drizzle/bootstrap em sync; **E2E mínima** (Playwright): login, criar panel, store; **Daemon down** → UI em modo read-only com mensagem clara; **Offline/PWA:** app deixa explícito o que funciona (cache) e o que não (mutations).

**O que não fazer:** Criar tabelas só em um lado sem atualizar o outro. E2E frágil ou sem manutenção. Prometer cache/offline completo sem escopo definido.

**DoD (verificável):**
- [ ] Schema canon escolhido e processo escrito (sem drift).
- [ ] Playwright rodando 3 fluxos no CI: login, criar panel, store.
- [ ] Daemon down → UI com mensagem clara e comportamento documentado.
- [ ] Offline: doc ou UI explicita o que funciona (cache) e o que não (mutations).

**Artefatos:** Doc de processo de schema; PR Playwright + fluxos; migration(s) se unificar schema; doc GETTING_STARTED ou OPERATIONS para degraded/offline.

---

### Trilha F) Documentação e contrato

**Tarefas:**
- [ ] **Contract governance gate (1.3)** — Schema diff checks + política de compatibilidade; mudanças breaking bloqueadas sem version bump.
- [ ] **API_CONTRACTS vs implementação (gap)** — Documento diz que a maioria das rotas é protegida por `requireAccess()`; na prática só o proxy catch-all `/api/logline/*` usa. Atualizar doc após decisão de auth na app layer.

**O que fazer:** Automatizar checagem de compatibilidade de schema (diff) e exigir version bump para mudanças breaking; após decisão de auth, atualizar API_CONTRACTS com quem aplica proteção em cada rota.

**O que não fazer:** Permitir breaking changes sem versionamento. Deixar documentação de contratos desatualizada após mudança de auth. Bloquear mudanças não-breaking com burocracia excessiva.

**DoD (verificável):**
- [ ] Schema diff check no CI; breaking sem version bump falha.
- [ ] Política de compatibilidade escrita.
- [ ] API_CONTRACTS.md reflete estado real de proteção das rotas.

**Artefatos:** PR CI check; doc de política; atualização de API_CONTRACTS.

---

## Top 10 Deliverables — curto prazo (saída tangível)

Para poder dizer “o curto prazo entregou X”:

| # | Deliverable | Artefato verificável |
|---|-------------|----------------------|
| 1 | Middleware Tier A pronto e em uso | PR merged; teste da chain passando |
| 2 | Matriz Tier A/B/C publicada | Doc com tabela; referenciada no código ou CI |
| 3 | JWT-only em endpoints protegidos (compat rollback testado) | Teste de rejeição sem JWT; rollback documentado |
| 4 | Gate de auth consistente na app layer | Todas as rotas produto com requireAccess ou roteamento único documentado |
| 5 | Schema canon decidido (Supabase migrations ou Drizzle-first, um só) | Doc de processo; sem drift |
| 6 | E2E mínima no CI | Playwright: login, panel, store |
| 7 | Degraded mode quando daemon down | Banner/estado + doc |
| 8 | Retry/backoff e erro “humano” no chat (sem hang) | Timeout aplicado; mensagem ou fallback |
| 9 | Ledger de usage/fuel (append-only + idempotency) — pode iniciar no curto e fechar no médio | Tabela + ingest rejeitando duplicados; teste de idempotência |
| 10 | API_CONTRACTS alinhado com implementação | Doc atualizado e revisado |

---

## Médio prazo (1–3 meses) — metering/policy/billing viram verdade central

### Trilha A) Policy decision contract (3.1)

**Depende de:** Tier A/B/C (2) e middleware chain (3).

**Implementação:** **Em Rust.** O contrato de decisão de policy (allow/deny, reason, policy_version) e a emissão de receipts são lógica de domínio; vivem em crates/daemon. A API/UI apenas expõe o resultado.

**Tarefas:**
- [ ] **3.1 Policy decision contract (Rust)** — Payload de decisão de policy (`allow/deny`, reason, policy version) definido e implementado **em Rust** (core/daemon); todos os actions Tier A produzem registros explicáveis; reason codes documentados.

**O que fazer:** Definir contrato de decisão de policy (allow/deny, reason, policy version) e aplicá-lo em ações Tier A; toda ação Tier A emite policy.decision + receipt.

**O que não fazer:** Deixar ações Tier A sem registro de decisão explicável; reason codes não documentados.

**DoD (verificável):**
- [ ] Toda ação Tier A emite policy.decision + receipt.
- [ ] Reason codes documentados.

**Artefatos:** PR contrato + integração; doc de reason codes; teste de emissão de decision.

---

### Trilha B) Usage ledger canon (3.2) + Fuel normalizado

**Depende de:** Identidade/escopo (1) para tenant_id/app_id/user_id no evento.

**Implementação:** **Em Rust.** O ledger é lógica de domínio e autoridade de ingestão/validação; schema pode ser aplicado via migration (Postgres), mas a **API de ingest, validação e regras de idempotência** ficam em Rust (daemon/crates). Apps/Next.js apenas enviam eventos para o endpoint do daemon; não decidem aceitar/rejeitar.

**Tarefas:**
- [ ] **3.2 Usage ledger canon (Rust + DB)** — Criar schema imutável de eventos de fuel (event_id, idempotency_key, tenant_id, app_id, user_id, units, unit_type, occurred_at, source); **ingestão e validação em Rust** (daemon/crates): rejeita malformados e não idempotentes; tabela append-only (migration Postgres).

**O que fazer:** Tabela de ledger append-only com event_id e idempotency_key; ingest rejeita duplicados por idempotency; campos core do Phase 0; ligação clara tenant/app/user (scope canônico).

**O que não fazer:** Permitir UPDATE/DELETE no ledger (nem via app). Permitir mutação ou deleção no ledger. Ingest que aceite eventos malformados ou duplicados.

**DoD (verificável):**
- [ ] Ledger não permite UPDATE/DELETE (nem via app).
- [ ] Replay idempotente provado com teste.
- [ ] Ingest rejeita eventos malformados ou duplicados por idempotency_key.

**Artefatos:** Migration da tabela; API de ingest; teste de idempotência; doc do schema.

---

### Trilha C) Pricing derivation engine (3.3)

**Depende de:** Usage ledger (5).

**Implementação:** **Em Rust.** O motor de pricing (derivação de custo a partir de ledger + pricing_version) é lógica de domínio centralizada; implementado em Rust (crates/daemon). Apps emitem apenas fuel; nunca calculam preço para o cliente.

**Tarefas:**
- [ ] **3.3 Pricing derivation engine (Rust)** — Motor centralizado de preços **em Rust** (crates/daemon); billing reproduzível a partir de ledger + `pricing_version`; apps não se auto-precificam (Phase 0.4).

**O que fazer:** Implementar motor de pricing centralizado que derive billing de ledger + pricing_version; apps emitem apenas fuel; invoice line item referencia eventos no ledger + pricing_version.

**O que não fazer:** Deixar apps calcularem preço para o cliente. Billing sem referência a usage events e pricing_version. Duplicar lógica de pricing em mais de um serviço.

**DoD (verificável):**
- [ ] Invoice line item referencia eventos no ledger + pricing_version.
- [ ] Qualquer linha de invoice rastreável a eventos no ledger e a uma pricing_version.
- [ ] Nenhum app calcula preço final para o cliente.

**Artefatos:** PR motor de pricing; doc de pricing_version; teste de derivação.

---

### Trilha D) Auth permanente (Phases B–E)

**Por quê:** AUTH_PERMANENT_PLAN; user-owned keys é milestone de segurança, não “só” feature.

**Tarefas:**
- [ ] **Phase B — Mandatory tenant onboarding** — Nenhum usuário opera sem membership em tenant; allowlist + hook `before_user_created`.
- [ ] **Phase C — App role strictness** — Enforçar `member` vs `app_admin` em toda rota e query; RLS alinhado com API.
- [ ] **Phase D — User-owned keys** — Modelo de chaves por usuário; `user_provider_keys` com encryption-at-rest; remover shared provider keys como padrão.
- [ ] **Phase E — CLI QR login** — `logline auth login --qr` estável; challenge/approve/status; sessão CLI escopada.

**O que fazer:** Garantir que todo usuário tenha tenant membership (allowlist + hook before_user_created); aplicar member vs app_admin em todas as rotas e RLS; armazenar chaves por usuário em user_provider_keys com encryption-at-rest; entregar fluxo CLI QR completo e estável.

**O que não fazer:** Permitir uso sem tenant. Dar a members permissão de write ou private_read. Guardar chaves shared como padrão. Expor raw key no frontend.

**DoD (verificável):**
- [ ] Novos usuários só existem com membership em tenant.
- [ ] Rotas e RLS consistentes com member/app_admin.
- [ ] Default é user-owned key; shared descontinuado para novos apps.
- [ ] QR login funciona e emite sessão CLI escopada.

**Artefatos:** Migrations; PRs por fase; testes de role e onboarding; doc de fluxos.

---

### Trilha E) Protocolo e erros (2.1–2.3)

**Tarefas:**
- [ ] **2.1 Unified ingress envelope** — Envelope normalizado de request para API/MCP/WebSocket/Webhooks/SSE; todos os canais emitem formato interno compartilhado.
- [ ] **2.2 Replay e idempotency** — Padrão de idempotency key e comportamento replay-safe para mutações.
- [ ] **2.3 External error model** — Schema canônico de erro com trace/correlation IDs; integrações externas podem reagir por tipo de erro.

**O que fazer:** Normalizar envelope de request em todos os canais (API, MCP, WebSocket, Webhooks, SSE); padronizar idempotency key e comportamento replay-safe em mutações; publicar schema de erro com trace/correlation IDs e tipos acionáveis.

**O que não fazer:** Deixar canais com formatos incompatíveis. Permitir mutações não replay-safe em Tier A. Erros sem identificador de correlação.

**DoD (verificável):**
- [ ] Todos os canais emitem envelope interno compartilhado.
- [ ] Mutações sensíveis aceitam idempotency key e são determinísticas em replay.
- [ ] Erros externos têm schema documentado e tipo/correlation ID.

**Artefatos:** PR envelope + error model; doc de schema; testes de idempotência e erro.

---

### Trilha F) Observabilidade (4.1–4.2)

**Tarefas:**
- [ ] **4.1 Tiered telemetry** — Modelo de telemetria alinhado a Tier A/B/C; ações de alto risco com receipts completos; fluxos de baixo risco leves.
- [ ] **4.2 Conflict handling MVP** — Taxonomia de conflitos + campos mínimos de reconciliation receipt; evidência divergente preservada sem deleção.

**O que fazer:** Alinhar telemetria aos tiers (A: receipts completos; B/C: leve); definir taxonomia de conflitos e campos mínimos de receipt de reconciliação; nunca apagar evidência divergente, apenas resolver com receipt.

**O que não fazer:** Sobrecarregar fluxos Tier C com audit pesado. Deletar ou sobrescrever evidência em conflito. Introduzir conflito handling sem preservar histórico.

**DoD (verificável):**
- [ ] Matriz de telemetria por tier documentada e em uso.
- [ ] Conflitos classificados e receipts com campos mínimos definidos.
- [ ] Resolução de conflito gera receipt e mantém evidência original.

**Artefatos:** Doc de matriz de telemetria; PR conflict handling; dashboard ou query para receipts (quando aplicável).

---

## Longo prazo (3–12 meses) — plataforma externa + founder ops

Objetivo: plataforma externa pronta, governança leve e evolução sustentável.

### Trilha A) Auth e founder

**Tarefas:**
- [ ] **Phase F — Founder signed intents** — Operações protegidas exigem capability `founder` + intent assinada verificada; auditoria imutável.
- [ ] **Phase G — Hardening e full cutover** — Session rotation/revocation, device kill switch, SLOs de auth; remoção dos paths de compatibilidade antigos.
- [ ] **Encryption de user_provider_keys** — Criptografia em camada de aplicação com suporte a rotação de chaves (security backlog).

**O que fazer:** Exigir founder + intent assinada verificada em operações protegidas; implementar rotation/revocation de sessão e device kill switch; remover paths de compatibilidade antigos; criptografar user_provider_keys em aplicação com rotação de chaves.

**O que não fazer:** Executar ações protegidas sem signature válida. Manter compat sem data de sunset. Expor chave em claro ou sem rotação.

**DoD (verificável):**
- [ ] Todas as operações protegidas exigem founder + intent verificada e audit.
- [ ] Sessões e devices revogáveis; SLOs de auth definidos.
- [ ] Modo compat removido.
- [ ] Chaves de usuário criptografadas e rotacionáveis.

**Artefatos:** PRs Phase F/G; migration/rotacionamento de keys; testes de founder flow; doc de SLOs e revocation.

---

### Trilha B) Produto e preços

**Tarefas:**
- [ ] **Centralized pricing engine em produção** — Serviços só reportam uso (app_name, mode, tokens, day); pricing service calcula custo billable; single source of truth (ROADMAP “Next”).

**O que fazer:** Manter serviços apenas emitindo uso normalizado; centralizar cálculo de custo billable no pricing service; garantir uma única fonte de verdade para preços em produção.

**O que não fazer:** Permitir que apps ou serviços auto-precificem clientes. Duplicar lógica de pricing em mais de um serviço.

**DoD (verificável):**
- [ ] Serviços emitem apenas eventos de uso (app_name, mode, tokens, day).
- [ ] Pricing service em produção e usado para billing.
- [ ] Nenhum app calcula preço final para o cliente.

**Artefatos:** PR pricing em prod; doc de operação; dashboard de billing (quando aplicável).

---

### Trilha C) Plataforma externa

**Tarefas:**
- [ ] **5.1 Public contract docs** — Documentação externa de API/eventos com versioning e regras de migração; integração sem conhecimento tribal.
- [ ] **5.2 Sandbox onboarding** — Self-serve sandbox para identidade, uso e preview de billing; parceiros conseguem onboarding sem intervenção manual.

**O que fazer:** Publicar documentação externa de API/eventos com versionamento e regras de migração; oferecer sandbox self-serve para identidade, uso e preview de billing para parceiros.

**O que não fazer:** Expor contratos sem versionamento. Exigir conhecimento tribal para integrar. Sandbox que dependa de passo manual de engenharia.

**DoD (verificável):**
- [ ] Docs públicas de API/eventos com versão e política de migração.
- [ ] Parceiro completa onboarding no sandbox sem ticket manual.
- [ ] Integração possível apenas com documentação pública.

**Artefatos:** Doc pública versionada; PR sandbox flow; testes de onboarding self-serve.

---

### Trilha D) SLO e incidentes

**Tarefas:**
- [ ] **4.3 SLO e alert prioritization** — Targets de SLO para auth/policy/metering/billing; paging e dashboards para superfícies críticas.
- [ ] **Runbooks e homeostasis** — Preservar evidência em conflito; contenção e correção explícita em vez de mutação silenciosa (LOGLINE_ECOSYSTEM_NORMATIVE_BASE).

**O que fazer:** Definir e monitorar SLOs para auth, policy, metering, billing; ter paging e dashboards para superfícies críticas; documentar runbooks; em conflito preservar evidência e corrigir de forma explícita.

**O que não fazer:** Mutar ou apagar evidência para “resolver” conflito. Operar superfícies críticas sem SLO. Correção silenciosa sem registro.

**DoD (verificável):**
- [ ] SLOs definidos e dashboards/alertas ativos.
- [ ] Runbooks publicados para incidentes.
- [ ] Conflitos tratados com preservação de evidência e correção documentada.

**Artefatos:** Doc de SLOs; dashboards e alertas; runbooks publicados.

---

### Trilha E) Governança contínua

**Tarefas:**
- [ ] **6.1 Quarterly invariant review** — Revisão de invariantes, exceções e drift; relatório aprovado com decisões keep/change.
- [ ] **6.2 Minimal ceremony rule** — Overhead de processo deve justificar redução de risco de forma mensurável.
- [ ] **Federated conflict protocol** — Automação avançada (hoje deferido em LOGLINE_ECOSYSTEM_NORMATIVE_BASE).
- [ ] **Multi-context reconciliation UX** — UX avançada para reconciliação multi-contexto (deferido).

**O que fazer:** Realizar revisão trimestral de invariantes, exceções e drift com relatório aprovado; garantir que novo processo obrigatório tenha justificativa de risco mensurável; evoluir protocolo de conflito e UX de reconciliação quando priorizado.

**O que não fazer:** Adicionar cerimônia sem rationale de redução de risco. Ignorar drift nos invariantes. Tratar governança como burocracia fixa sem revisão.

**DoD (verificável):**
- [ ] Relatório trimestral aprovado com decisões keep/change.
- [ ] Regra de minimal ceremony documentada e aplicada.
- [ ] Itens deferidos com critérios claros para reativar.

**Artefatos:** Relatório trimestral; doc de regra de ceremony; critérios de reativação para itens deferidos.

---

### Trilha F) UX e cliente (gaps)

**Tarefas:**
- [ ] **PWA / offline (gap)** — Existem `public/sw.js` e `components/pwa/PWARegister.tsx`; validar fluxo completo de install/offline e documentar em GETTING_STARTED ou OPERATIONS; garantir que comportamento offline seja explícito (ex.: “sem daemon, apenas leitura em cache” ou mensagem clara).

**O que fazer:** Validar fluxo de install e comportamento offline do PWA; documentar em GETTING_STARTED ou OPERATIONS; deixar explícito o que funciona offline (ex.: leitura em cache) e o que não (ex.: sem daemon).

**O que não fazer:** Prometer experiência offline completa sem definir escopo. Deixar PWA sem documentação de limites. Esconder estado offline do usuário.

**DoD (verificável):**
- [ ] Install e uso offline testados e documentados.
- [ ] Comportamento esperado (cache/daemon) descrito para o usuário.
- [ ] Mensagem ou estado claro quando offline/daemon indisponível.

**Artefatos:** Doc GETTING_STARTED ou OPERATIONS; testes de install/offline; mensagens de estado na UI.

---

## Resumo por horizonte

| Horizonte | Foco | Dependência principal |
|-----------|------|------------------------|
| **Curto** | Identity, gate, Tier A/B/C, middleware, segurança, confiabilidade, schema, E2E, degraded, contratos | — |
| **Médio** | Policy contract, usage ledger, pricing engine, auth permanente (B–E), protocolo, observabilidade | Curto (identity + tier + middleware) |
| **Longo** | Founder intents, cutover, encryption, pricing em prod, sandbox, SLO, governança, PWA | Médio |

---

## Gaps identificados (resumo)

| Categoria | Gap |
|-----------|-----|
| **Auth** | Só `/api/logline/*` chama `requireAccess`; rotas produto são proxy sem gate na app. |
| **Docs** | `API_CONTRACTS.md` desatualizado em relação a quem aplica auth. |
| **Schema** | Nenhuma tabela usage/fuel/ledger; múltiplas fontes de schema. |
| **Testes** | Sem E2E; apenas template-contract + Rust unit. |
| **Resiliência** | Daemon down → 502; sem fallback nem mensagem estruturada. |
| **PWA** | sw.js e PWARegister existem; fluxo offline não documentado. |

---

## Referências

- `docs/ECOSYSTEM_PHASE0_APPROVED_V1.md` — Decisões Phase 0 e ordem de execução.
- `docs/ECOSYSTEM_GREEN_TASKLIST.md` — Fases verdes e ordem recomendada.
- `docs/ROADMAP.md` — Active / Next / Green track.
- `docs/AUTH_PERMANENT_PLAN.md` — Fases A–G e execution board.
- `docs/ARCHITECTURE.md` — Camadas e constraints atuais.
- `docs/SECURITY.md` — Regras de segredos e backlog de segurança.
- `docs/LOGLINE_ECOSYSTEM_NORMATIVE_BASE.md` — Invariantes MUST e testable checks.
- `docs/LOGLINE_OPERATING_POSTURE.md` — Tier A/B/C e red lines.

**Implementação em Rust:** Workspace `logline/` (daemon `logline-daemon`, crates `logline-core`, `logline-runtime`, `logline-auth`, `logline-api`, etc.). Toda lógica de domínio, policy, ledger, pricing e middleware como autoridade vive ali; Next.js é adapter/proxy apenas.

---

Para **board em formato tickets** (título + descrição + critérios copiar/colar), ver `docs/TASKLIST_BOARD.md`.
