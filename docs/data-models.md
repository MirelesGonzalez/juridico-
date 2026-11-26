# Data Models — Esquemas y ontología

Top-level entities (canonical model):
- LegalNorm
- LegalCase
- LegalConcept
- LegalActor
- LegalEvent
- Obligation

Modelo JSON de ejemplo (LegalNorm)

See: examples/schemas/legal_norm.schema.json

Relaciones (graph layer)

Usar triples RDF-like o property graph:
- (actor:trabajador_y) —[PART_OF]→ (concept:relacion_laboral)
- (event:despido) —[AFFECTS]→ (actor:trabajador_y)
- (norm:mx:lft:art47) —[REGULATES]→ (event:despido)
- (case:scjn:2024:xyz) —[INTERPRETS]→ (norm:mx:lft:art47)

Ontología

Ejemplo: Labor law
- Concept: Relación Laboral
  - Element: Subordinación
  - Element: Salario
  - Element: Prestación personal

Encoding

Soporte OWL-like en JSON para condiciones y efectos legales.

AgentMemory

La memoria persistente se modela como una entidad complementaria de contexto operativo. Su contrato se define en `examples/schemas/agent_memory_record.schema.json`.

Campos principales:

- `id`: identificador estable del registro.
- `scope`: `daily`, `long_term`, `scratchpad` o `topic`.
- `type`: naturaleza del contenido, como `decision`, `finding`, `todo`, `session_note`, `preference` o `reference`.
- `content`: texto concreto y verificable.
- `classification`: `public`, `internal`, `confidential` o `restricted`.
- `provenance`: origen humano, agente, sesión, documento o sistema.
- `status`: `active`, `obsolete`, `revised` o `deleted`.
- `legal_refs`: referencias a entidades jurídicas canonicas.
- `evidence`: fuentes o documentos que respaldan el registro.
- `topics`: etiquetas de búsqueda y clasificación.
- `created_at` y `updated_at`.

Relaciones

- `(memory:record) —[REFERS_TO]→ (norm:mx:...)`
- `(memory:record) —[REFERS_TO]→ (case:...)`
- `(memory:record) —[EVIDENCES]→ (document:...)`
- `(memory:record) —[SUPPORTS]→ (event:...)`
- `(memory:record) —[SUPERSEDES]→ (memory:record)`

La relación `SUPERSEDES` permite sustituir conclusiones operativas sin borrar el historial. La eliminación lógica se representa con `status: deleted`, conservando auditoría.
