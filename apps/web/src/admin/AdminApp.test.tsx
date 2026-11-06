// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import AdminApp from "./AdminApp";
import ResolvedFilter, {
  defaultResolvedSelection,
  validResolvedSelection,
} from "../components/ResolvedFilter";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  history.replaceState({}, "", "/admin");
});
test("moderador não renderiza tela de contas mesmo por URL direta", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      account: {
        id: "2",
        name: "Mod",
        role: "moderator",
        email: "m@example.test",
        mustChangePassword: false,
      },
    }),
  } as Response);
  history.replaceState({}, "", "/admin/accounts");
  render(<AdminApp />);
  await screen.findByText("Mod");
  expect(screen.queryByText("Nova conta")).toBeNull();
});
test("histórico identifica a ocorrência afetada", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input) =>
      ({
        ok: true,
        json: async () =>
          String(input).endsWith("/session")
            ? {
                account: {
                  id: "1",
                  name: "Ana",
                  role: "owner",
                  mustChangePassword: false,
                },
              }
            : {
                events: [
                  {
                    id: "event",
                    actor_name: "Ana",
                    action: "resolve",
                    entity_type: "issue",
                    entity_id: "issue-alvo",
                    created_at: "2026-11-09T12:00:00Z",
                    justification: "Concluído",
                    before_state: { lifecycle_status: "active" },
                    after_state: { lifecycle_status: "resolved" },
                  },
                ],
              },
      }) as Response,
  );
  history.replaceState({}, "", "/admin/history");
  render(<AdminApp />);
  await screen.findByText("issue-alvo");
  expect(screen.getByText("active → resolved")).toBeTruthy();
});
test("filtro inicia ocultando resolvidas e apresenta datas quando habilitado", () => {
  const value = defaultResolvedSelection();
  expect(value.includeResolved).toBe(false);
  const change = vi.fn();
  const view = render(<ResolvedFilter value={value} onChange={change} />);
  expect(screen.queryByLabelText("Resolvida de")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(change).toHaveBeenCalledWith({ ...value, includeResolved: true });
  view.rerender(
    <ResolvedFilter
      value={{ ...value, includeResolved: true }}
      onChange={change}
    />,
  );
  expect(screen.getByLabelText("Resolvida de")).toBeTruthy();
  expect(
    validResolvedSelection({
      ...value,
      includeResolved: true,
      resolvedFrom: "2026-01-01",
      resolvedTo: "2026-04-01",
    }),
  ).toBe(false);
});
test("sem sessão mostra login", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: "Sessão expirada" }),
  } as Response);
  render(<AdminApp />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy(),
  );
  expect(screen.getByLabelText("E-mail")).toBeTruthy();
});
test("senha temporária restringe interface à troca de senha", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      account: {
        id: "1",
        name: "Ana",
        role: "moderator",
        email: "a@example.test",
        mustChangePassword: true,
      },
    }),
  } as Response);
  render(<AdminApp />);
  await screen.findByText("Defina sua senha");
  expect(screen.queryByText("Fila de moderação")).toBeNull();
});
test("moderador vê fila mas não gestão de contas; modal exige justificativa", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input) =>
      ({
        ok: true,
        json: async () =>
          String(input).endsWith("/session")
            ? {
                account: {
                  id: "1",
                  name: "Ana",
                  role: "moderator",
                  email: "a@example.test",
                  mustChangePassword: false,
                },
              }
            : String(input).includes("/issues/")
              ? {
                  issue: {
                    id: "test",
                    category: "lixo",
                    latitude: -23,
                    longitude: -46,
                    verificationStatus: "unverified",
                    lifecycleStatus: "active",
                    visibility: "visible",
                  },
                  reports: [],
                  signals: {
                    totalReports: 1,
                    distinctSources: 1,
                    withPhoto: 0,
                  },
                  history: [],
                }
              : { issues: [], total: 0 },
      }) as Response,
  );
  history.replaceState({}, "", "/admin/issues/test");
  render(<AdminApp />);
  await screen.findByText("Lixo irregular");
  expect(screen.queryByRole("button", { name: "Contas" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Marcar como resolvida" }),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Confirmar ação",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("Justificativa"), {
    target: { value: "Manutenção concluída" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Confirmar ação",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
