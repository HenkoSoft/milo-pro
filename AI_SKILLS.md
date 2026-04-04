# AI SKILLS — reglas de desarrollo para este proyecto

Este archivo define cómo la IA debe trabajar en este repositorio.

El objetivo es mantener coherencia técnica, evitar cambios innecesarios y asegurar una migración progresiva desde el stack actual hacia una arquitectura moderna basada en React + TypeScript.

---

# PRINCIPIOS GENERALES

1. NO reescribir el proyecto completo de una sola vez.
2. Mantener compatibilidad hacia atrás siempre que sea posible.
3. Priorizar cambios pequeños, revisables y seguros.
4. No cambiar lógica de negocio sin justificación clara.
5. No modificar endpoints existentes sin aprobación explícita.
6. No introducir nuevas dependencias si no aportan valor claro.
7. Evitar sobreingeniería.
8. Mantener el proyecto ejecutable después de cada cambio.
9. Explicar decisiones arquitectónicas importantes.
10. Si una parte funciona correctamente, no refactorizarla sin motivo.

---

# STACK OBJETIVO

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* TanStack Query
* React Hook Form
* Zod (solo cuando tenga sentido)

Backend:

* Node.js
* Express
* TypeScript progresivo
* SQLite inicialmente

Auth:

* JWT existente
* mantener middleware actual

Integraciones:

* WooCommerce NO debe modificarse salvo necesidad clara

---

# REGLAS DE ARQUITECTURA

NO introducir:

* Redux (salvo necesidad justificada)
* microservicios
* GraphQL
* ORMs complejos sin motivo
* arquitecturas experimentales
* frameworks adicionales innecesarios

Mantener:

* API REST actual
* estructura monolítica inicialmente
* SQLite en primeras fases

---

# ESTRUCTURA OBJETIVO

/frontend
/src
/api
/components
/features
/hooks
/layouts
/pages
/routes
/types
/utils

/backend
/src
/routes
/middleware
/services
/db
/types

/shared
/types

---

# ESTILO DE CODIGO

TypeScript:

* usar tipos explícitos cuando agreguen claridad
* evitar any
* usar interfaces para DTOs

React:

* preferir functional components
* usar hooks
* separar lógica en hooks reutilizables
* evitar componentes gigantes

CSS:

* usar Tailwind
* no usar CSS inline innecesario
* evitar archivos CSS separados salvo casos especiales

---

# REGLAS DE MIGRACION

Durante la migración:

1. no eliminar frontend legacy inmediatamente
2. permitir coexistencia temporal
3. migrar módulo por módulo
4. mantener contratos de API existentes
5. validar funcionalidad después de cada cambio

---

# REGLAS PARA CAMBIOS

Cada cambio debe incluir:

* lista de archivos modificados
* explicación breve
* riesgos potenciales
* cómo validar manualmente
* pendientes si los hay

---

# TESTING

Cuando tenga sentido:

Frontend:

* Vitest
* Testing Library

Backend:

* tests básicos de endpoints críticos

No crear tests innecesarios para código trivial.

---

# PRIORIDADES

Prioridad alta:

* estabilidad
* claridad
* simplicidad
* compatibilidad

Prioridad media:

* performance
* tipado estricto

Prioridad baja:

* perfeccionismo arquitectónico

---

# QUE HACER ANTE DUDAS

Si hay múltiples opciones válidas:

1. elegir la más simple
2. elegir la más compatible con el código existente
3. evitar cambios innecesarios
4. explicar tradeoffs

---

# OBJETIVO FINAL

Una aplicación moderna, mantenible y predecible sin introducir complejidad innecesaria.

