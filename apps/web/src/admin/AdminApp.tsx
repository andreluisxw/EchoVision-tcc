import { useEffect, useState, type FormEvent } from "react";
import {
  Leaf,
  Inbox,
  History,
  Users,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  EyeOff,
} from "lucide-react";
import { CATEGORIES, type Issue } from "@eco/shared";
import { adminApi, type Account } from "./api";
import ResolvedFilter, {
  defaultResolvedSelection,
  validResolvedSelection,
} from "../components/ResolvedFilter";
import "./admin.css";
import CoordinatePreview from './CoordinatePreview';

interface AdminIssue extends Issue {
  visibility: "visible" | "hidden";
}
interface EventRow {
  id: string;
  actor_name: string;
  action: string;
  entity_id: string;
  entity_type: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  justification: string | null;
  created_at: string;
}
interface Detail {
  issue: AdminIssue;
  reports: {
    id: string;
    description: string | null;
    createdAt: string;
    imageUrl: string | null;
    kind: string;
  }[];
  signals: {
    totalReports: number;
    distinctSources: number;
    withPhoto: number;
    firstReportedAt: string;
    lastReportedAt: string;
    possibleAbuse: boolean;
  };
  history: EventRow[];
}
const actions: Record<string, string> = {
  verify: "Verificar",
  unverify: "Desverificar",
  resolve: "Marcar como resolvida",
  reopen: "Reabrir",
  hide: "Ocultar",
  restore: "Restaurar",
  login: "Entrou no painel",
  logout: "Saiu do painel",
  password_changed: "Alterou a própria senha",
  account_created: "Criou conta",
  account_disabled: "Desativou conta",
  account_activated: "Ativou conta",
  password_reset: "Redefiniu senha",
  bootstrap_owner: "Criou primeiro proprietário",
};
const date = (s: string) =>
  s
    ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
const category = (id: string) =>
  CATEGORIES.find((c) => c.id === id)?.label || id;
function Events({ events }: { events: EventRow[] }) {
  return (
    <ol className="admin-events">
      {events.map((e) => (
        <li key={e.id}>
          <strong>{e.actor_name}</strong> · {actions[e.action] || e.action}
          <time>{date(e.created_at)}</time>
          <div>
            {e.entity_type === "issue" ? (
              <a href={`/admin/issues/${e.entity_id}`}>{e.entity_id}</a>
            ) : (
              <span>{e.entity_id}</span>
            )}
          </div>
          {e.before_state &&
            e.after_state &&
            Object.keys(e.after_state)
              .filter(
                (k) =>
                  JSON.stringify(e.before_state?.[k]) !==
                  JSON.stringify(e.after_state?.[k]),
              )
              .map((k) => (
                <p key={k}>
                  {String(e.before_state?.[k] ?? "—")} →{" "}
                  {String(e.after_state?.[k] ?? "—")}
                </p>
              ))}
          {e.justification && <p>{e.justification}</p>}
        </li>
      ))}
      {!events.length && <li>Nenhum evento registrado.</li>}
    </ol>
  );
}
function States({ issue }: { issue: AdminIssue }) {
  return (
    <div className="admin-states">
      <span
        className={
          issue.lifecycleStatus === "resolved" ? "state resolved" : "state"
        }
      >
        {issue.lifecycleStatus === "resolved" ? "✓ Resolvida" : "● Ativa"}
      </span>
      <span className="state">
        {issue.verificationStatus === "verified"
          ? "✓ Verificada"
          : issue.verificationStatus === "corroborated"
            ? "Corroborada"
            : "Não verificada"}
      </span>
      <span
        className={issue.visibility === "hidden" ? "state hidden" : "state"}
      >
        {issue.visibility === "hidden" ? "◉ Oculta" : "Visível"}
      </span>
    </div>
  );
}

export default function AdminApp() {
  const [account, setAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [path, setPath] = useState(location.pathname),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<AdminIssue[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<Detail | null>(null),
    [events, setEvents] = useState<EventRow[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState(""),
    [cat, setCat] = useState(""),
    [verification, setVerification] = useState(""),
    [visibility, setVisibility] = useState(""),
    [lifecycle, setLifecycle] = useState(""),
    [resolved, setResolved] = useState(defaultResolvedSelection);
  const [pending, setPending] = useState<{
      title: string;
      run: (justification: string) => Promise<unknown>;
    } | null>(null),
    [justification, setJustification] = useState(""),
    [temporary, setTemporary] = useState("");
  function navigate(to: string) {
    history.pushState({}, "", to);
    setPath(to);
    setError("");
    setDetail(null);
    setPage(1);
  }
  useEffect(() => {
    setRows([]);
    setTotal(0);
    setDetail(null);
    setEvents([]);
    setAccounts([]);
    setTemporary("");
    setPending(null);
    setJustification("");
  }, [account?.id]);
  useEffect(() => {
    const pop = () => {
      setPath(location.pathname);
      setDetail(null);
    };
    const expired = () => {
      setAccount(null);
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("admin-session-expired", expired);
    adminApi<{ account: Account }>("/session")
      .then((r) => setAccount(r.account))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("admin-session-expired", expired);
    };
  }, []);
  useEffect(() => {
    if (!account || account.mustChangePassword) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const load = async () => {
      if (path === "/admin/accounts") {
        if (account.role !== "owner")
          throw new Error("Acesso exclusivo do proprietário.");
        const result=await adminApi<{accounts:Account[]}>("/accounts",undefined,"GET",controller.signal);
        if(!controller.signal.aborted)setAccounts(result.accounts);
      } else if (path === "/admin/history") {
        const result=await adminApi<{events:EventRow[]}>(`/history?page=${page}`,undefined,"GET",controller.signal);
        if(!controller.signal.aborted)setEvents(result.events);
      } else if (path.startsWith("/admin/issues/")) {
        const result=await adminApi<Detail>(
            `/issues/${encodeURIComponent(path.split("/")[3])}`,
            undefined,
            "GET",
            controller.signal,
          );
        if(!controller.signal.aborted)setDetail(result);
      } else {
        if (!validResolvedSelection(resolved)) return;
        const q = new URLSearchParams({
          page: String(page),
          search,
          category: cat,
          verificationStatus: verification,
          visibility,
          lifecycleStatus: lifecycle,
          includeResolved: String(resolved.includeResolved),
          resolvedFrom: resolved.resolvedFrom,
          resolvedTo: resolved.resolvedTo,
        });
        const r = await adminApi<{ issues: AdminIssue[]; total: number }>(
          `/issues?${q}`,
          undefined,
          "GET",
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setRows(r.issues);
          setTotal(r.total);
        }
      }
    };
    load()
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    account,
    path,
    page,
    search,
    cat,
    verification,
    visibility,
    lifecycle,
    resolved,
    revision,
  ]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await adminApi<{ account: Account }>("/login", {
        email: f.get("email"),
        password: f.get("password"),
      });
      setAccount(r.account);
      navigate("/admin");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (f.get("password") !== f.get("confirmation"))
        throw new Error("As senhas não coincidem.");
      await adminApi("/password", {
        currentPassword: f.get("currentPassword"),
        password: f.get("password"),
      });
      setAccount(null);
      navigate("/admin/login");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      await pending.run(justification.trim());
      setPending(null);
      setJustification("");
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
      setRevision((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  function ask(title: string, run: (why: string) => Promise<unknown>) {
    setJustification("");
    setPending({ title, run });
  }
  if (!account)
    return (
      <main className="admin-login">
        <a href="/" className="admin-back">
          <ArrowLeft size={16} /> Voltar ao mapa
        </a>
        <form onSubmit={login}>
          <div className="admin-logo">
            <Leaf /> raiz.
          </div>
          <small>ÁREA ADMINISTRATIVA</small>
          <h1>Entrar no painel</h1>
          <p>Use sua conta individual para moderar ocorrências.</p>
          <label>
            E-mail
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
          <button disabled={busy || loading}>
            {busy ? "Entrando…" : loading ? "Verificando sessão…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  if (account.mustChangePassword)
    return (
      <main className="admin-login">
        <form onSubmit={changePassword}>
          <div className="admin-logo">
            <Leaf /> raiz.
          </div>
          <h1>Defina sua senha</h1>
          <p>
            Troque a senha temporária antes de continuar. Você entrará novamente
            depois.
          </p>
          <label>
            Senha temporária
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            Nova senha
            <input
              name="password"
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirme a nova senha
            <input
              name="confirmation"
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={busy}>Salvar senha</button>
          <button
            type="button"
            onClick={() =>
              adminApi("/logout", {}).finally(() => setAccount(null))
            }
          >
            Sair
          </button>
        </form>
      </main>
    );
  if (path === "/admin/accounts" && account.role !== "owner")
    return (
      <main className="admin-main">
        <strong>{account.name}</strong>
        <p role="alert">Acesso exclusivo do proprietário.</p>
        <button onClick={() => navigate("/admin")}>Voltar à moderação</button>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-logo" href="/">
          {" "}
          <Leaf /> raiz.
        </a>
        <small>ADMINISTRAÇÃO</small>
        <nav aria-label="Administração">
          {[
            ["/admin", "Moderação", Inbox],
            ["/admin/history", "Histórico", History],
            ...(account.role === "owner"
              ? [["/admin/accounts", "Contas", Users]]
              : []),
          ].map(([url, label, Icon]) => {
            const I = Icon as typeof Inbox;
            return (
              <button
                key={String(url)}
                className={path === url ? "selected" : ""}
                onClick={() => navigate(String(url))}
              >
                <I size={18} />
                {String(label)}
              </button>
            );
          })}
        </nav>
        <div className="admin-identity">
          <strong>{account.name}</strong>
          <span>{account.role === "owner" ? "Proprietário" : "Moderador"}</span>
          <small>{account.email}</small>
          <button
            onClick={async () => {
              try {
                await adminApi("/logout", {});
              } finally {
                setAccount(null);
                navigate("/admin/login");
              }
            }}
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header>
          <small>ÁREA RESTRITA · HORÁRIO DE SÃO PAULO</small>
          <h1>
            {path === "/admin/accounts"
              ? "Contas administrativas"
              : path === "/admin/history"
                ? "Histórico de ações"
                : detail
                  ? "Detalhe da ocorrência"
                  : "Fila de moderação"}
          </h1>
          <p>Decisões individuais, justificadas e rastreáveis.</p>
        </header>
        {error && (
          <div className="admin-error" role="alert">
            {error}
            <button
              onClick={() => {
                setError("");
                setRevision((v) => v + 1);
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {loading && <p role="status">Carregando…</p>}
        {path === "/admin/accounts" ? (
          <>
            <form
              className="admin-panel admin-account-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const body = {
                  name: f.get("name"),
                  email: f.get("email"),
                  role: f.get("role"),
                };
                ask("Criar conta administrativa", async (why) => {
                  const r = await adminApi<{ temporaryPassword: string }>(
                    "/accounts",
                    { ...body, justification: why },
                  );
                  setTemporary(r.temporaryPassword);
                });
              }}
            >
              <h2>Nova conta</h2>
              <label>
                Nome
                <input name="name" minLength={2} maxLength={100} required />
              </label>
              <label>
                E-mail
                <input name="email" type="email" required />
              </label>
              <label>
                Papel
                <select name="role">
                  <option value="moderator">Moderador</option>
                  <option value="owner">Proprietário</option>
                </select>
              </label>
              <button>Criar conta</button>
            </form>
            {temporary && (
              <div className="admin-panel admin-secret" role="status">
                <strong>Senha temporária — exibida uma única vez</strong>
                <code>{temporary}</code>
                <p>
                  Entregue esta senha ao administrador por um canal privado.
                </p>
                <button onClick={() => setTemporary("")}>
                  Já guardei, ocultar
                </button>
              </div>
            )}
            <div className="admin-panel">
              {accounts.map((a) => (
                <article className="admin-account" key={a.id}>
                  <div>
                    <strong>{a.name}</strong>
                    <p>
                      {a.email} ·{" "}
                      {a.role === "owner" ? "Proprietário" : "Moderador"} ·{" "}
                      {a.active ? "Ativa" : "Desativada"}
                    </p>
                  </div>
                  <div className="admin-actions">
                    <button
                      onClick={() =>
                        ask(`Redefinir senha de ${a.name}`, async (why) => {
                          const r = await adminApi<{
                            temporaryPassword: string;
                          }>(`/accounts/${a.id}/reset-password`, {
                            justification: why,
                          });
                          setTemporary(r.temporaryPassword);
                        })
                      }
                    >
                      Redefinir senha
                    </button>
                    <button
                      onClick={() =>
                        ask(
                          `${a.active ? "Desativar" : "Ativar"} ${a.name}`,
                          (why) =>
                            adminApi(
                              `/accounts/${a.id}`,
                              { active: !a.active, justification: why },
                              "PATCH",
                            ),
                        )
                      }
                    >
                      {a.active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : path === "/admin/history" ? (
          <section className="admin-panel">
            <Events events={events} />
            <div className="admin-pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Anterior
              </button>
              <span>Página {page}</span>
              <button
                disabled={events.length < 25}
                onClick={() => setPage((v) => v + 1)}
              >
                Próxima
              </button>
            </div>
          </section>
        ) : path.startsWith("/admin/issues/") ? (
          detail && (
            <>
              <button className="admin-back" onClick={() => navigate("/admin")}>
                <ArrowLeft size={16} /> Voltar à fila
              </button>
              <section className="admin-panel">
                <h2>{category(detail.issue.category)}</h2>
                <p>{detail.issue.description || "Sem descrição adicional."}</p>
                <p className="admin-muted">
                  {detail.issue.id} · <CoordinatePreview latitude={detail.issue.latitude} longitude={detail.issue.longitude}/>
                </p>
                <States issue={detail.issue} />
                <div className="admin-actions">
                  {[
                    detail.issue.verificationStatus === "verified"
                      ? "unverify"
                      : "verify",
                    detail.issue.lifecycleStatus === "resolved"
                      ? "reopen"
                      : "resolve",
                    detail.issue.visibility === "hidden" ? "restore" : "hide",
                  ].map((action) => (
                    <button
                      key={action}
                      onClick={() =>
                        ask(actions[action], (why) =>
                          adminApi(`/issues/${detail.issue.id}/actions`, {
                            action,
                            justification: why,
                          }),
                        )
                      }
                    >
                      {action === "resolve" ? (
                        <CheckCircle2 size={16} />
                      ) : action === "hide" ? (
                        <EyeOff size={16} />
                      ) : (
                        <ShieldCheck size={16} />
                      )}{" "}
                      {actions[action]}
                    </button>
                  ))}
                </div>
                <div className="admin-signals">
                  <span>
                    <strong>{detail.signals.totalReports}</strong> relatos
                  </span>
                  <span>
                    <strong>{detail.signals.distinctSources}</strong> fontes
                    técnicas distintas
                  </span>
                  <span>
                    <strong>{detail.signals.withPhoto}</strong> com foto
                  </span>
                </div>
                <p>
                  Primeiro relato: {date(detail.signals.firstReportedAt)} ·
                  Último: {date(detail.signals.lastReportedAt)}
                </p>
                {detail.signals.possibleAbuse && (
                  <p className="admin-warning">
                    Possível concentração de relatos de uma mesma fonte. Analise
                    o contexto antes de decidir.
                  </p>
                )}
              </section>
              <div className="admin-detail-grid">
                <section className="admin-panel">
                  <h2>Relatos associados</h2>
                  {detail.reports.map((r) => (
                    <article className="admin-report" key={r.id}>
                      <time>
                        {date(r.createdAt)} ·{" "}
                        {r.kind === "confirmation"
                          ? "Confirmação"
                          : "Relato inicial"}
                      </time>
                      <p>{r.description || "Sem descrição adicional."}</p>
                      {r.imageUrl && (
                        <a href={r.imageUrl} target="_blank" rel="noreferrer">
                          <img src={r.imageUrl} alt="Foto do relato" />
                        </a>
                      )}
                    </article>
                  ))}
                  {!detail.reports.length && <p>Nenhum relato associado.</p>}
                </section>
                <section className="admin-panel">
                  <h2>Histórico imutável</h2>
                  <Events events={detail.history} />
                </section>
              </div>
            </>
          )
        ) : (
          <>
            <section className="admin-panel admin-filters">
              <label>
                Buscar
                <input
                  placeholder="Código ou descrição"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Categoria
                <select
                  value={cat}
                  onChange={(e) => {
                    setCat(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Confiança
                <select
                  value={verification}
                  onChange={(e) => {
                    setVerification(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  <option value="unverified">Não verificada</option>
                  <option value="corroborated">Corroborada</option>
                  <option value="verified">Verificada</option>
                </select>
              </label>
              <label>
                Visibilidade
                <select
                  value={visibility}
                  onChange={(e) => {
                    setVisibility(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  <option value="visible">Visível</option>
                  <option value="hidden">Oculta</option>
                </select>
              </label>
              <label>
                Ciclo de vida
                <select
                  value={lifecycle}
                  onChange={(e) => {
                    setLifecycle(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="active">Ativa</option>
                  <option value="resolved">Resolvida</option>
                </select>
              </label>
              <ResolvedFilter
                value={resolved}
                onChange={(v) => {
                  setResolved(v);
                  setPage(1);
                }}
              />
            </section>
            <section className="admin-panel">
              <div className="admin-list-title">
                <h2>Ocorrências</h2>
                <span>{total} resultados</span>
              </div>
              {rows.map((issue) => (
                <button
                  className="admin-issue-row"
                  key={issue.id}
                  onClick={() => navigate(`/admin/issues/${issue.id}`)}
                >
                  <div>
                    <strong>{category(issue.category)}</strong>
                    <p>{issue.description || "Sem descrição"}</p>
                    <small>
                      {issue.reportsCount} relatos ·{" "}
                      {date(issue.lastReportedAt)}
                    </small>
                  </div>
                  <States issue={issue} />
                  <span aria-hidden="true">→</span>
                </button>
              ))}
              {!loading && !rows.length && (
                <p>Nenhuma ocorrência corresponde aos filtros.</p>
              )}
              <div className="admin-pagination">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Anterior
                </button>
                <span>Página {page}</span>
                <button
                  disabled={page * 25 >= total}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Próxima
                </button>
              </div>
            </section>
          </>
        )}
      </main>
      {pending && (
        <div className="admin-overlay">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-title"
          >
            <form onSubmit={confirm}>
              <h2 id="action-title">{pending.title}</h2>
              <p>A ação será registrada com seu nome, data e justificativa.</p>
              <label>
                Justificativa
                <textarea
                  autoFocus
                  required
                  minLength={3}
                  maxLength={1000}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <div className="admin-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPending(null)}
                >
                  Cancelar
                </button>
                <button disabled={busy || justification.trim().length < 3}>
                  {busy ? "Salvando…" : "Confirmar ação"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
