# Defect Log

Defects are tracked as GitHub issues labelled `type: bug`. This table is the summary for report §7.4. Unresolved defects that affect included scope must **also** appear in report §3.4 Known Limitations.

| ID | Issue | Found by (test / activity) | Related req | Severity | Description | Resolution | Status |
|---|---|---|---|---|---|---|---|
| DEF-01 | — | IT-CFG-02 | FR-21, BR-19 | Major | Creating a department or category whose name slug matched an existing ID silently overwrote the existing record | Create now refuses when the ID already exists; update requires an existing ID | Fixed (19 Oct) |
| DEF-02 | — | E2E-01 (first run) | FR-03, NFR-03 | Critical | Web submissions with an empty optional field (landmark) were rejected: the callable protocol serialises `undefined` as `null`, which the schemas did not accept | `command()` drops top-level nulls before validation; regression test IT-RPT-10 | Fixed (19 Oct) |
| DEF-03 | — | NFT-08 (axe-core) | NFR-08 | Minor | Tab counters (4.34:1), sidebar section headings (2.63:1) and input placeholders were below the WCAG AA contrast ratio of 4.5:1 | Darker text tokens (slate-600 / slate-500) | Fixed (19 Oct) |
| DEF-04 | — | CI typecheck on a clean checkout | NFR-12 | Critical | `.gitignore` entry `lib/` excluded `functions/src/lib` and `apps/web/src/lib` from the repository; a fresh clone did not build | Ignore narrowed to `/functions/lib/` (build output); CI builds from a clean clone on every push | Fixed (19 Oct) |
| DEF-05 | — | E2E-10 | FR-31 | Major | The profile form initialised its fields before the profile had loaded, so the name could be empty and saving failed validation | Editor renders only after the profile loads | Fixed (19 Oct) |
