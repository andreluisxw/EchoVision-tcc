export function resolvedRange(
  query: Record<string, string | undefined>,
): { from: string; to: string } | null {
  if (
    query.includeResolved !== undefined &&
    !["true", "false"].includes(query.includeResolved)
  )
    throw Object.assign(new Error("Filtro inválido."), { statusCode: 400 });
  if (query.includeResolved !== "true") return null;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const from = query.resolvedFrom || yesterday.toISOString().slice(0, 10);
  const to = query.resolvedTo || today;
  const valid = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (!valid(from) || !valid(to) || days < 1 || days > 90)
    throw Object.assign(
      new Error("Informe um intervalo válido de até 90 dias."),
      { statusCode: 400 },
    );
  return { from, to };
}
