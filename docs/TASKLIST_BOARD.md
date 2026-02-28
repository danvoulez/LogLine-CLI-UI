# Board — Tasklist logline.world (Linear-style)

Épicos e tasks ordenadas por dependência, com **DoD checklists** copiar/colar para tickets. Cada ticket pode ser criado com: **Título**, **Descrição** (por quê + o que fazer), **Critérios de aceite** (DoD).

---

## Épico 1: Curto prazo — Core (1–4 semanas)

### 1.1 Identidade e Auth

**Ticket: JWT-first em endpoints protegidos**
- **Título:** JWT-first em endpoints protegidos (Phase A)
- **Descrição:** Aceitar Supabase JWT como base em todos os endpoints protegidos; manter AUTH_PROVIDER_MODE=compat como rollback. Phase 0: operação protegida só após scope canônico; client scope é untrusted.
- **Critérios de aceite (DoD):**
  - [ ] 100% das rotas protegidas rejeitam requisição sem JWT válido (teste automatizado)
  - [ ] Rollback com AUTH_PROVIDER_MODE=compat testado e documentado
  - [ ] Doc de contratos atualizado

**Ticket: Auth-to-workspace mapping**
- **Título:** Auth-to-workspace mapping (workspace de claim/contexto)
- **Descrição:** workspace_id não pode ser só header/localStorage; tem que vir de claim ou contexto validado. Depende de JWT-first.
- **Critérios de aceite (DoD):**
  - [ ] Workspace efetivo sempre resolvido de claim/contexto validado (não só x-workspace-id)
  - [ ] Sem confiar em x-workspace-id sem validação

**Ticket: Gate de auth consistente na app layer**
- **Título:** Gate de auth consistente na app layer
- **Descrição:** (a) requireAccess() como middleware padrão em rotas de produto, ou (b) mover tudo protegido para catch-all /api/logline/* e documentar. Evitar bypass de checks centrais.
- **Critérios de aceite (DoD):**
  - [ ] Todas as rotas de produto passam pelo gate (requireAccess ou roteamento único)
  - [ ] API_CONTRACTS.md reflete quem aplica proteção em cada rota
  - [ ] Nenhum atalho por rota que bypassa o gate

**Ticket: Workspace switcher UI**
- **Título:** Workspace switcher na UI
- **Descrição:** UX de troca de workspace no header/shell; só troca se houver membership/claim válido. Hooks já emitem x-workspace-id.
- **Critérios de aceite (DoD):**
  - [ ] Workspace switcher visível e funcional no shell
  - [ ] Troca só permitida com membership/claim válido

---

### 1.2 Guardrails de plataforma (depende de 1.1)

**Ticket: Matriz Tier A/B/C**
- **Título:** Classificação e matriz Tier A/B/C
- **Descrição:** Classificar rotas/ações em Tier A/B/C conforme LOGLINE_OPERATING_POSTURE; publicar matriz em doc.
- **Critérios de aceite (DoD):**
  - [ ] Matriz publicada (tabela em doc)
  - [ ] Toda rota/ação classificada

**Ticket: Middleware chain Tier A**
- **Título:** Middleware chain para Tier A (auth → scope → policy → handler → audit)
- **Descrição:** Implementar cadeia padrão apenas para Tier A; não burocratizar Tier C.
- **Critérios de aceite (DoD):**
  - [ ] Toda rota Tier A passa pela chain
  - [ ] Teste automatizado da chain para Tier A

**Ticket: CI Rust-authority route rule**
- **Título:** CI: falhar quando rota Next.js tiver lógica de domínio (proxy-only)
- **Descrição:** Lint/CI que acusa quando rota Next.js vira motor de domínio; UI deve ser adapter.
- **Critérios de aceite (DoD):**
  - [ ] PR com lógica de domínio em rota proxy falha no CI
  - [ ] Regra documentada

---

### 1.3 Segurança imediata

**Ticket: Rate limiting**
- **Título:** Rate limiting em auth, founder, proxies
- **Descrição:** Rate limiting em /api/v1/cli/auth/*, /api/v1/founder/* e rotas de proxy sensíveis; com métricas.
- **Critérios de aceite (DoD):**
  - [ ] Rate limiting ativo e configurável nos endpoints listados
  - [ ] Métricas/observabilidade disponíveis

**Ticket: Audit logging**
- **Título:** Audit logging para settings e modo de auth
- **Descrição:** Registrar em audit writes de /api/settings e mudanças de modo de auth; correlation_id/run_id para query.
- **Critérios de aceite (DoD):**
  - [ ] Eventos de audit escritos e consultáveis
  - [ ] Correlação por request/run_id

**Ticket: Secret scanning CI**
- **Título:** Secret scanning no CI (docs/exemplos)
- **Descrição:** Pipeline/check que detecte segredos em docs e exemplos; política documentada e triagem de falsos positivos.
- **Critérios de aceite (DoD):**
  - [ ] Secret scanning no CI
  - [ ] Política documentada e triagem de falsos positivos

---

### 1.4 Confiabilidade

**Ticket: Timeout/backoff e falha rápida**
- **Título:** Timeout/backoff e falha rápida (chat e gateway)
- **Descrição:** Política de retry/backoff; falha rápida quando não há upstream saudável; sem hang indefinido.
- **Critérios de aceite (DoD):**
  - [ ] Chat e fluxos críticos não ficam em hang indefinido; erro ou fallback em tempo limitado
  - [ ] Health influencia seleção de backend quando disponível
  - [ ] Política documentada

**Ticket: Degraded mode (daemon down)**
- **Título:** Degraded mode quando daemon indisponível
- **Descrição:** UI com banner/mensagem clara quando daemon down; opcional read-only ou cache. Documentar comportamento.
- **Critérios de aceite (DoD):**
  - [ ] Daemon down → UI exibe mensagem clara (banner/estado degraded)
  - [ ] Comportamento documentado (GETTING_STARTED ou OPERATIONS)

---

### 1.5 Infra e qualidade

**Ticket: Schema canon e processo**
- **Título:** Fonte única de schema (Schema canon)
- **Descrição:** Definir fonte canônica (ex.: Supabase migrations) e processo para manter Drizzle/bootstrap em sync; documentar.
- **Critérios de aceite (DoD):**
  - [ ] Schema canon escolhido e processo escrito
  - [ ] Sem drift entre fontes (ou processo de atualização conjunta documentado)

**Ticket: E2E mínima (Playwright)**
- **Título:** E2E mínima no CI (Playwright)
- **Descrição:** Três fluxos: login, criar panel, store. Rodar no CI.
- **Critérios de aceite (DoD):**
  - [ ] Playwright rodando 3 fluxos no CI: login, criar panel, store
  - [ ] Fluxos estáveis e mantidos

**Ticket: PWA/offline escopado**
- **Título:** PWA/offline escopado e documentado
- **Descrição:** Validar install e comportamento offline; documentar o que funciona (cache) e o que não (mutations).
- **Critérios de aceite (DoD):**
  - [ ] Install e uso offline testados e documentados
  - [ ] App deixa explícito o que funciona offline e o que não

---

### 1.6 Documentação e contrato

**Ticket: Contract governance gate**
- **Título:** Schema diff check e política de compatibilidade
- **Descrição:** CI com schema diff; breaking sem version bump falha; política de compatibilidade escrita.
- **Critérios de aceite (DoD):**
  - [ ] Schema diff check no CI; breaking sem version bump falha
  - [ ] Política de compatibilidade escrita

**Ticket: API_CONTRACTS alinhado**
- **Título:** API_CONTRACTS.md alinhado com implementação
- **Descrição:** Após decisão de auth/gate, atualizar doc com quem aplica proteção em cada rota.
- **Critérios de aceite (DoD):**
  - [ ] API_CONTRACTS.md reflete estado real de proteção das rotas
  - [ ] Revisado com implementação

---

## Épico 2: Médio prazo — Policy, Ledger, Pricing, Auth permanente (1–3 meses)

### 2.1 Policy decision contract (depende de 1.2)

**Ticket: Policy decision contract (3.1)**
- **Título:** Policy decision contract (allow/deny, reason, policy_version)
- **Descrição:** Payload padrão de decisão para ações Tier A; toda ação Tier A emite policy.decision + receipt.
- **Critérios de aceite (DoD):**
  - [ ] Toda ação Tier A emite policy.decision + receipt
  - [ ] Reason codes documentados

---

### 2.2 Usage ledger canon (depende de 1.1)

**Ticket: Tabela e API usage ledger (3.2)**
- **Título:** Usage ledger canon — tabela append-only + ingest idempotente
- **Descrição:** Tabela com event_id, idempotency_key, tenant_id, app_id, user_id, units, unit_type, occurred_at, source; ingest rejeita duplicados; sem UPDATE/DELETE.
- **Critérios de aceite (DoD):**
  - [ ] Ledger não permite UPDATE/DELETE (nem via app)
  - [ ] Replay idempotente provado com teste
  - [ ] Ingest rejeita eventos malformados ou duplicados por idempotency_key

---

### 2.3 Pricing derivation engine (depende de 2.2)

**Ticket: Pricing derivation engine (3.3)**
- **Título:** Motor de pricing centralizado e versionado
- **Descrição:** Billing reproduzível a partir de ledger + pricing_version; apps não se auto-precificam.
- **Critérios de aceite (DoD):**
  - [ ] Invoice line item referencia eventos no ledger + pricing_version
  - [ ] Nenhum app calcula preço final para o cliente

---

### 2.4 Auth permanente (Phases B–E)

**Ticket: Phase B — Mandatory tenant onboarding**
- **Título:** Phase B: Mandatory tenant onboarding
- **Descrição:** Nenhum usuário opera sem tenant membership; allowlist + hook before_user_created.
- **Critérios de aceite (DoD):**
  - [ ] Novos usuários só existem com membership em tenant
  - [ ] Não permitir uso sem tenant

**Ticket: Phase C — App role strictness**
- **Título:** Phase C: App role strictness (member vs app_admin)
- **Descrição:** Enforçar member vs app_admin em toda rota e query; RLS alinhado com API.
- **Critérios de aceite (DoD):**
  - [ ] Rotas e RLS consistentes com member/app_admin
  - [ ] Members não têm write nem private_read

**Ticket: Phase D — User-owned keys**
- **Título:** Phase D: User-owned keys (milestone de segurança)
- **Descrição:** user_provider_keys com encryption-at-rest; remover shared provider keys como padrão.
- **Critérios de aceite (DoD):**
  - [ ] Default é user-owned key; shared descontinuado para novos apps
  - [ ] Raw key nunca exposta no frontend

**Ticket: Phase E — CLI QR login**
- **Título:** Phase E: CLI QR login
- **Descrição:** logline auth login --qr estável; challenge/approve/status; sessão CLI escopada.
- **Critérios de aceite (DoD):**
  - [ ] QR login funciona e emite sessão CLI escopada
  - [ ] Fluxo documentado

---

## Épico 3: Longo prazo — Plataforma externa + founder ops (3–12 meses)

Tickets resumidos (DoD e descrição expandida conforme TASKLIST_LOGLINE_WORLD.md):

- **Phase F — Founder signed intents:** Operações protegidas exigem founder + intent assinada; auditoria imutável.
- **Phase G — Hardening e full cutover:** Session rotation/revocation, device kill switch, SLOs de auth; remoção de compat.
- **Encryption user_provider_keys:** Criptografia em camada de aplicação + rotação.
- **Centralized pricing em produção:** Serviços só emitem uso; pricing service calcula billable.
- **Public contract docs + Sandbox onboarding:** Docs externas versionadas; sandbox self-serve.
- **SLO e alert prioritization + Runbooks:** SLOs para auth/policy/metering/billing; runbooks e homeostasis.
- **Governança trimestral + Minimal ceremony:** Revisão de invariantes; processo só com rationale de risco.
- **PWA/offline:** Comportamento explícito documentado e testado.

---

## Ordem sugerida de implementação (por dependência)

1. 1.1 Identidade e Auth (todos os tickets em sequência)
2. 1.2 Guardrails (matriz → middleware → CI)
3. 1.3 Segurança imediata
4. 1.4 Confiabilidade
5. 1.5 Infra e qualidade
6. 1.6 Documentação e contrato
7. 2.1 Policy decision contract
8. 2.2 Usage ledger canon
9. 2.3 Pricing derivation engine
10. 2.4 Auth permanente (B → C → D → E)
11. Épico 3 conforme prioridade de produto

---

**Uso:** Copiar título + descrição + critérios de aceite para Linear/Jira/Notion; marcar checkboxes no próprio ticket ao concluir cada item do DoD.
