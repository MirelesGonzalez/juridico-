# Architecture — Visión técnica

Resumen de la capa técnica y organización del sistema.

System Overview

┌─────────────────────────────┐
│        Applications         │  ← apps/
├─────────────────────────────┤
│     Legal API / SDK Layer   │
├─────────────────────────────┤
│     Rule Engine (v2 core)   │
├─────────────────────────────┤
│   Knowledge Graph + Store   │  ← knowledge/
├─────────────────────────────┤
│   Templates + Generators    │  ← templates/
├─────────────────────────────┤
│   Ingestion / ETL Pipelines │  ← scripts/
└─────────────────────────────┘

Storage & Indexing

- Raw storage: versioned JSON
- Query layer: Graph DB (Neo4j / RDF triple store)
- Indexing: Elastic / OpenSearch
- Versioning: Git + semantic versioning

Integration points

- Poder Judicial / APIs gubernamentales
- Firmas electrónicas
- Correo, calendarios y sistemas contables
- Memoria persistente del agente (AgentMemory)

Memory integration

La memoria operativa del agente se integra como una capa auxiliar de contexto, no como fuente primaria de derecho.

- Daily memory: registro histórico de trabajo, decisiones, errores y comprobaciones.
- Long-term memory: únicamente preferencias y hechos operativos duraderos; no contiene información legal presumida como vigente.
- Scratchpad: pendientes y tareas que deben conservarse entre sesiones.
- Topic memory: conocimientos transversales ligados a expedientes, áreas jurídicas o proyectos.

Every memory record must include:

- `scope`: diario, largo plazo, scratchpad o tema.
- `classification`: pública, interna, confidencial o reservada.
- `provenance`: sesión, usuario, agente o fuente documental.
- `status`: activa, obsoleta, revisada o eliminada.
- `created_at` and `updated_at`.
- `legal_refs`: referencias a normas o jurisprudencia conocidas.
- `evidence`: documentos, archivos o resultados que sustentan el registro.

No memory record can override a canonical LegalNorm, LegalCase, or current jurisdictional source. A memory record of legal conclusions is provisional until it is validated and attached to verifiable evidence. Memory entries must never contain passwords, API keys, personal data without legal basis, or privileged information outside the permitted scope.

Operational concerns

- Seguridad y cumplimiento (auditoría, trazabilidad)
- Alta disponibilidad y backups
- Gestión de usuarios/roles y permisos

Next steps

- Implementar capa de grafo y esquema CANONICAL
- Diseñar API de evaluación y consulta (/v1)
- Crear prototipo mínimo del motor de reglas (v2)
