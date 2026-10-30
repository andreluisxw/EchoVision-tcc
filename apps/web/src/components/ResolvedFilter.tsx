import './ResolvedFilter.css';

export interface ResolvedSelection {
  includeResolved: boolean;
  resolvedFrom: string;
  resolvedTo: string;
}
export function defaultResolvedSelection(): ResolvedSelection {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return {
    includeResolved: false,
    resolvedFrom: yesterday.toISOString().slice(0, 10),
    resolvedTo: today,
  };
}
export function validResolvedSelection(v: ResolvedSelection) {
  const days =
    (Date.parse(v.resolvedTo) - Date.parse(v.resolvedFrom)) / 86400000 + 1;
  return (
    !v.includeResolved || (Number.isFinite(days) && days >= 1 && days <= 90)
  );
}
export default function ResolvedFilter({
  value,
  onChange,
}: {
  value: ResolvedSelection;
  onChange: (v: ResolvedSelection) => void;
}) {
  return (
    <div className="resolved-filter">
      <label>
        <input
          type="checkbox"
          checked={value.includeResolved}
          onChange={(e) =>
            onChange({ ...value, includeResolved: e.target.checked })
          }
        />{" "}
        Exibir resolvidas
      </label>
      {value.includeResolved && (
        <div className="resolved-dates">
          <label>
            Resolvida de
            <input
              aria-label="Resolvida de"
              type="date"
              value={value.resolvedFrom}
              onChange={(e) =>
                onChange({ ...value, resolvedFrom: e.target.value })
              }
            />
          </label>
          <label>
            Até
            <input
              aria-label="Resolvida até"
              type="date"
              value={value.resolvedTo}
              onChange={(e) =>
                onChange({ ...value, resolvedTo: e.target.value })
              }
            />
          </label>
          <small>Datas inclusivas · São Paulo · até 90 dias</small>
        </div>
      )}
      {!validResolvedSelection(value) && (
        <p role="alert">Selecione um intervalo de até 90 dias.</p>
      )}
    </div>
  );
}
