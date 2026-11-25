# Integracion de AgentMemory

## Objetivo

AgentMemory proporciona memoria persistente para asistentes y sesiones de LEGAL-OS. Permite conservar contexto operativo, decisiones de flujo y pendientes sin confundir esa memoria con el conocimiento jurídico canonico.

## Separacion de responsabilidades

| Componente | Responsable | Ejemplo |
|---|---|---|
| AgentMemory | Contexto operativo persistente | Pendiente de verificar una reforma |
| Knowledge Graph | Entidades jurídicas verificadas | Norma, tesis, concepto o obligación |
| Rule Engine | Inferencia a partir de hechos y reglas | Clasificación de despido |
| Explanation Engine | Traza de reglas, hechos y normas | Fundamentación de un resultado |

## Ciclo de vida

1. **Captura:** cada agente crea registros con alcance, clasificación y procedencia.
2. **Validacion:** una conclusión jurídica debe vincularse a evidencia y referencias verificables.
3. **Recuperacion:** el contexto se consulta por alcance, tema, vigencia y clasificación.
4. **Revision:** una conclusión sustituida conserva el registro original mediante `supersedes`.
5. **Depuracion:** los registros vencidos pasan a `obsolete` o `deleted`; no se eliminan silenciosamente si existen obligaciones de auditoría.

## Alcances

- `daily`: acontecimientos y avances de una sesión o jornada.
- `long_term`: preferencias, convenciones y hechos duraderos; requiere confirmación expresa o recurrencia demostrada.
- `scratchpad`: tareas pendientes y asuntos que deben continuar entre sesiones.
- `topic`: conocimiento tematico con enlace por área, expediente o proyecto.

## Politicas de seguridad

- No almacenar secretos, contrasenas o tokens.
- Aplicar clasificación mínima necesaria.
- Restringir datos personales y confidenciales a usuarios autorizados.
- Identificar al origen humano o automático de cada registro.
- Verificar la vigencia de toda referencia jurídica antes de usarla como fundamento.
- Registrar evidencia mediante referencias o hash SHA-256 cuando corresponda.

## Regla de autoridad

AgentMemory tiene autoridad contextual, no normativa. Una memoria puede orientar una investigación o recordar una preferencia, pero no puede:

- declarar vigente una norma sin verificarla;
- atribuir carácter obligatorio a una tesis;
- sustituir una resolución judicial;
- modificar hechos o evidencia;
- modificar reglas legales canonicas.

## Operacion con agent-memory

Para cargas locales de trabajo:

```powershell
agent-memory context --no-search
agent-memory search --query "<tema>" --mode keyword
agent-memory write --content "<avance verificable> #legalos #tema"
agent-memory scratchpad add --text "<pendiente persistente>"
```

El archivo `agent_memory_record.schema.json` define el modelo interoperable de cada registro.
