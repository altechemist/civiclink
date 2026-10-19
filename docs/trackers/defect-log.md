# Defect Log

Defects are tracked as GitHub issues labelled `type: bug`. This table is the summary for report §7.4. Unresolved defects that affect included scope must **also** appear in report §3.4 Known Limitations.

| ID | Issue | Found by (test / activity) | Related req | Severity | Description | Resolution | Status |
|---|---|---|---|---|---|---|---|
| DEF-01 | — | IT-CFG-02 | FR-21, BR-19 | Major | Creating a department or category whose name slug matched an existing ID silently overwrote the existing record | Create now refuses when the ID already exists; update requires an existing ID | Fixed (19 Oct) |
| DEF-02 | — | E2E-01 (first run) | FR-03, NFR-03 | Critical | Web submissions with an empty optional field (landmark) were rejected: the callable protocol serialises `undefined` as `null`, which the schemas did not accept | `command()` drops top-level nulls before validation; regression test IT-RPT-10 | Fixed (19 Oct) |
