AI SKILLS - reglas de desarrollo para este proyecto

Este archivo define como la IA debe trabajar en este repositorio.

El objetivo es mantener coherencia tecnica, evitar cambios innecesarios y asegurar una migracion progresiva desde el stack actual hacia una arquitectura moderna basada en React + TypeScript.

PRINCIPIOS GENERALES

NO reescribir el proyecto completo de una sola vez.
Mantener compatibilidad hacia atras siempre que sea posible.
Priorizar cambios pequenos, revisables y seguros.
No cambiar logica de negocio sin justificacion clara.
No modificar endpoints existentes sin aprobacion explicita.
No introducir nuevas dependencias si no aportan valor claro.
Evitar sobreingenieria.
Mantener el proyecto ejecutable despues de cada cambio.
Explicar decisiones arquitectonicas importantes.
Si una parte funciona correctamente, no refactorizarla sin motivo.

REGLA CRITICA - MIGRACION SIN CAMBIOS VISUALES NI FUNCIONALES

La migracion debe ser unicamente tecnologica.

NO es un rediseno.
NO es una reinterpretacion de UX.
NO es una optimizacion visual.

El objetivo es reemplazar tecnologia manteniendo exactamente el mismo comportamiento visible para el usuario.

Reglas obligatorias:

NO modificar el layout existente durante la migracion.
NO cambiar la estructura visual de pantallas, formularios, tablas, modales, headers, sidebars, cards o grids salvo que se solicite explicitamente.
NO cambiar spacing, margenes, paddings o alineaciones sin necesidad tecnica estricta.
NO cambiar tipografias, tamanos, jerarquia visual ni estilos perceptibles.
NO alterar textos, labels, placeholders, iconos ni mensajes.
NO cambiar la estructura de navegacion.
NO cambiar el orden de elementos en pantalla.
NO cambiar flujos de usuario.
NO simplificar ni reinterpretar funcionalidades existentes.
NO mejorar UX durante la migracion.
NO eliminar elementos visuales existentes.
NO agregar elementos visuales nuevos sin justificacion funcional.
NO cambiar comportamiento de botones, formularios o inputs.
NO modificar validaciones existentes sin justificacion explicita.
NO cambiar estados de loading, error o success.
NO modificar animaciones existentes si las hubiera.
NO reinterpretar componentes aunque la nueva tecnologia permita hacerlo de forma mas elegante.
NO reemplazar una implementacion por otra si eso cambia la experiencia del usuario, aunque el codigo quede mas moderno.
NO modificar nombres visibles para el usuario.
NO modificar mensajes de error existentes.

Definicion de migracion correcta:

Una migracion se considera correcta cuando:

el usuario no puede notar diferencias visuales
el usuario no percibe cambios en comportamiento
la interfaz luce igual
los flujos funcionan igual
la aplicacion responde igual ante las mismas acciones
los datos se muestran igual
los formularios funcionan igual
la navegacion funciona igual

Si el usuario nota cambios, no es una migracion, es un rediseno.

Los redisenos requieren aprobacion explicita.

La migracion no autoriza rediseno, reordenamiento de layout ni cambios de UX.

STACK OBJETIVO

Frontend:

React
TypeScript
Vite
Tailwind CSS
React Router
TanStack Query
React Hook Form
Zod (solo cuando tenga sentido)

Backend:

Node.js
Express
TypeScript progresivo
SQLite inicialmente

Auth:

JWT existente
mantener middleware actual

Integraciones:

WooCommerce NO debe modificarse salvo necesidad clara

REGLAS DE ARQUITECTURA

NO introducir:

Redux salvo necesidad justificada
microservicios
GraphQL
ORMs complejos sin motivo
arquitecturas experimentales
frameworks adicionales innecesarios

Mantener:

API REST actual
estructura monolitica inicialmente
SQLite en primeras fases

ESTRUCTURA OBJETIVO

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

ESTILO DE CODIGO

TypeScript:

usar tipos explicitos cuando agreguen claridad
evitar any
usar interfaces para DTOs
preferir tipos compartidos en /shared/types cuando aplique

React:

preferir functional components
usar hooks
separar logica en hooks reutilizables
evitar componentes gigantes
evitar logica de negocio dentro de componentes visuales
mantener componentes enfocados en presentacion cuando sea posible

CSS:

usar Tailwind
replicar estilos existentes con precision visual
no cambiar spacing existente sin motivo
no introducir estilos arbitrarios innecesarios
evitar archivos CSS separados salvo casos especiales

REGLAS DE MIGRACION

Durante la migracion:

no eliminar frontend legacy inmediatamente
permitir coexistencia temporal
migrar modulo por modulo
mantener contratos de API existentes
validar funcionalidad despues de cada cambio
mantener paridad visual exacta
mantener paridad funcional exacta
no redisenar durante la migracion
no optimizar UI durante la migracion
no reinterpretar UX existente
replicar comportamiento antes de refactorizar
primero compatibilidad, luego mejoras si se solicitan
evitar cambios innecesarios en estructura de carpetas legacy hasta que la migracion este estable

REGLAS ESPECIFICAS PARA COMPONENTES Y PANTALLAS

Al migrar componentes o vistas:

replicar el componente existente antes de intentar mejorarlo
replicar markup existente antes de optimizar
mantener markup, jerarquia visual y comportamiento equivalente
mantener misma jerarquia visual
mantener mismos props funcionales
mantener comportamiento observable identico
mantener estructura de formularios
mantener estructura de tablas
mantener estructura de modales
mantener estructura de layouts
mantener nombres de campos visibles
si un componente legacy tiene una particularidad visual o funcional, debe conservarse
evitar "aprovechar la migracion" para redisenar
evitar introducir abstracciones prematuras
no dividir componentes si eso altera comportamiento
no combinar componentes si eso altera layout
primero paridad visual y funcional, despues optimizacion si se aprueba

REGLAS PARA CAMBIOS

Cada cambio debe incluir:

lista de archivos modificados
explicacion breve
motivo del cambio
riesgos potenciales
como validar manualmente
confirmacion de paridad visual
confirmacion de paridad funcional
pendientes si los hay

En cambios de migracion de frontend, cada entrega debe indicar ademas:

que pantalla o componente fue migrado
que partes quedaron exactamente iguales a nivel visual
que partes quedaron exactamente iguales a nivel funcional
si hubo alguna diferencia inevitable
evidencia o checklist de paridad visual y funcional

Formato esperado:

Archivos modificados:

ruta/archivo1
ruta/archivo2

Motivo:
explicacion breve

Riesgos:
posibles efectos secundarios

Validacion manual:
pasos concretos para verificar

Pendientes:
si aplica

TESTING

Cuando tenga sentido:

Frontend:

Vitest
Testing Library

Backend:

tests basicos de endpoints criticos

No crear tests innecesarios para codigo trivial.

Priorizar tests en:

logica critica
validaciones
endpoints sensibles
transformaciones de datos

PRIORIDADES

Prioridad alta:

estabilidad
claridad
simplicidad
compatibilidad
paridad visual
paridad funcional

Prioridad media:

performance
tipado estricto

Prioridad baja:

perfeccionismo arquitectonico
optimizaciones prematuras

QUE HACER ANTE DUDAS

Si hay multiples opciones validas:

elegir la mas simple
elegir la mas compatible con el codigo existente
evitar cambios innecesarios
evitar introducir dependencias nuevas
evitar cambios visuales
explicar tradeoffs
priorizar estabilidad sobre elegancia tecnica

Si una mejora tecnica altera la experiencia del usuario, no aplicarla sin aprobacion.

OBJETIVO FINAL

Una aplicacion moderna, mantenible y predecible sin introducir complejidad innecesaria.

Una migracion progresiva hacia React + TypeScript manteniendo:

misma apariencia
mismo comportamiento
mismos flujos
misma logica de negocio
misma API
misma experiencia de usuario

La tecnologia puede cambiar.

El producto no debe cambiar sin aprobacion explicita.
