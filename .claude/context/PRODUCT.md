# Product context

## Purpose

PitLog is a workshop-management application for mechanics in Argentina. It records customers, vehicles, workshop visits, work items, mileage, and future-service reminders through forms or a Realtime voice assistant.

The primary user is a mechanic working quickly at a desktop or phone. UI copy and assistant speech should be concise, practical, neutral Rioplatense Spanish. Natural voseo is allowed, but avoid slang, lunfardo, and regional filler phrases.

## Core domain

- A customer owns one or more vehicles.
- Every vehicle has exactly one customer in the current schema.
- A service visit belongs to both a vehicle and a customer and may contain multiple work items and notes.
- A work item may generate a reminder by date, mileage, or both.
- Argentine plates are accepted in legacy `ABC 123` and Mercosur `AB 123 CD` forms. Normalize case and spacing at boundaries.
- The current data model is single-workshop. RLS grants authenticated users access to the shared workshop data; true tenant isolation does not exist yet.

## Voice invariants

- Never invent a plate, customer, date, mileage, service, or operation result.
- Read a plate back letter by letter and digit by digit before using it in a tool. Confirm ambiguous names, and always confirm a full name before customer creation. Identifier confirmation and write confirmation are separate turns.
- A confirmed plate miss is not enough to classify a vehicle as new: read it back and search a second time before offering creation.
- Read operations may execute immediately after any required identifier confirmation.
- Write operations require an explicit confirmation such as “sí”, “dale”, “guardalo”, “confirmo”, or “de una”. A request to record work is not itself confirmation.
- In the browser-direct flow, a generic confirmation only authorizes a write when the assistant's immediately preceding turn explicitly asked to persist the summarized data.
- Create or find the customer before creating a vehicle, and pass a real `clienteId`.
- Report write success only when the tool returns an ID with `persistenciaVerificada: true`. Tool errors, missing verification, and partial-write warnings must be presented accurately, never reframed as a completed operation.
- Tool names and transport payloads use Spanish domain names for compatibility with the assistant contract, even though implementation identifiers are otherwise English.

## Main records and statuses

- `customers`: contact information and notes.
- `vehicles`: plate, make, model, year, VIN, engine, current mileage, owner.
- `service_visits`: date, mileage, intake notes, summary, status.
- `service_items`: category, description, parts, next-service date/mileage.
- `service_reminders`: `pending`, `contacted`, `done`, or `snoozed` in the web schema.
- `visit_notes`, `attachments`, `audit_log`, and `profiles` support the broader record model.

The gateway mock uses Spanish-shaped DTOs and a smaller status vocabulary. Treat the browser database schema as persistence truth and adapter DTOs as integration contracts.
