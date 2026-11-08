from pathlib import Path


EXPORTABLE_STEMS = {
    "adequacao-manual-ads",
    "checklist-validacao-tecnica",
    "defesa-e-entrega",
    "documentacao-tecnica",
    "entrega-ads-2026-11-11",
    "etica-lgpd-e-seguranca",
    "painel-administrativo-2026-11-09",
    "projeto-software-ads",
    "readme",
    "tcc-relatorio-completo",
    "testes-e-avaliacao",
    "validacao-tecnica-2026-11-09",
}


def is_exportable_source(path: Path) -> bool:
    return path.stem.lower() in EXPORTABLE_STEMS
