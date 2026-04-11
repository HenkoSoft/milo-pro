# SKILLS.md

Guía de implementación visual para mantener consistencia en todo el proyecto.

Este archivo define reglas de UI para desarrolladores y agentes de IA.

Objetivo:

evitar inconsistencias visuales
evitar invenciones de estilos innecesarias
mantener coherencia entre pantallas
reutilizar patrones existentes

Regla principal:

si ya existe un patrón visual en el proyecto, debe reutilizarse


--------------------------------------------------
TIPOGRAFÍA
--------------------------------------------------

Fuente principal:

Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif


Pesos permitidos:

400
500
600
700


Escala tipográfica:

xs   12px
sm   14px
base 16px
lg   18px
xl   20px
2xl  24px
3xl  30px


Line height:

tight   1.2
normal  1.5
relaxed 1.65


Reglas:

no usar nuevas tipografías
no usar tamaños arbitrarios
no modificar jerarquía tipográfica sin motivo funcional
mantener consistencia en títulos y textos


--------------------------------------------------
COLORES
--------------------------------------------------

primary        #2563EB
primary-hover  #1D4ED8

secondary      #64748B

background     #FFFFFF
surface        #F8FAFC

border         #E2E8F0


Texto:

text-primary   #0F172A
text-secondary #475569
text-muted     #94A3B8

text-on-primary #FFFFFF


Estados:

success #16A34A
warning #D97706
danger  #DC2626
info    #0284C7


Reglas:

no inventar nuevos colores
no usar hex inline si existe token equivalente
usar colores semánticos
no usar colores parecidos como reemplazo


--------------------------------------------------
ESPACIADO
--------------------------------------------------

Escala permitida:

4px
8px
12px
16px
20px
24px
32px
40px
48px


Reglas:

evitar spacing arbitrario
no usar valores como 13px o 22px sin necesidad
mantener ritmo vertical consistente


--------------------------------------------------
BORDES
--------------------------------------------------

Border radius:

sm 4px
md 8px
lg 12px


Reglas:

usar radios consistentes
no inventar radios nuevos
no usar bordes decorativos innecesarios


--------------------------------------------------
SOMBRAS
--------------------------------------------------

Niveles permitidos:

shadow-sm
shadow
shadow-md


Reglas:

no usar sombras fuertes innecesarias
mantener consistencia en modales, cards y dropdowns


--------------------------------------------------
LAYOUT
--------------------------------------------------

mantener consistencia de márgenes
mantener alineaciones existentes
no mover acciones principales sin motivo
mantener jerarquía visual consistente


--------------------------------------------------
BOTONES
--------------------------------------------------

Variantes permitidas:

primary
secondary
ghost
danger


Tamaños permitidos:

sm
md
lg


Estados:

default
hover
active
disabled
loading


Reglas:

no crear nuevas variantes sin aprobación
mantener padding consistente
mantener altura consistente
mantener peso tipográfico consistente
no cambiar jerarquía visual existente


--------------------------------------------------
INPUTS
--------------------------------------------------

Tipos:

text
number
email
password
select
textarea


Reglas:

mantener altura consistente
mantener padding consistente
mantener estilo de focus consistente
mantener mensajes de error consistentes
no modificar placeholders sin motivo funcional


--------------------------------------------------
FORMULARIOS
--------------------------------------------------

mantener estructura existente
mantener jerarquía:

label
input
error

mantener validaciones existentes
mantener orden de campos


--------------------------------------------------
TABLAS
--------------------------------------------------

mantener padding consistente
mantener alineaciones existentes
mantener orden de columnas
mantener jerarquía visual

acciones por fila:

mantener orden
mantener iconos
mantener labels


no reinterpretar layout de tabla


--------------------------------------------------
CARDS
--------------------------------------------------

mantener padding consistente
mantener jerarquía visual
no agregar decoración innecesaria


--------------------------------------------------
MODALES
--------------------------------------------------

mantener tamaño consistente
mantener padding consistente
mantener jerarquía visual

acciones:

primaria a la derecha
secundaria a la izquierda

no cambiar comportamiento de cierre


--------------------------------------------------
ESTADOS UI
--------------------------------------------------

loading:

mantener patrón consistente


error:

mantener estilo consistente


empty states:

mantener tono consistente


--------------------------------------------------
ICONOS
--------------------------------------------------

usar librería existente
mantener tamaño consistente
no mezclar estilos de iconos
no introducir nuevas librerías sin necesidad


--------------------------------------------------
TAILWIND
--------------------------------------------------

preferir clases estándar

evitar:

px-[13px]
text-[15px]
mt-[22px]


usar escala definida

si un patrón se repite:
crear componente reutilizable simple


--------------------------------------------------
REUTILIZACIÓN DE COMPONENTES
--------------------------------------------------

antes de crear un componente nuevo:

buscar si existe uno similar

si existe:
reutilizar

no crear múltiples versiones del mismo componente


incorrecto:

PrimaryButton
MainButton
BlueButton


correcto:

Button variant="primary"


--------------------------------------------------
CONSISTENCIA ENTRE FEATURES
--------------------------------------------------

componentes similares deben verse iguales


ejemplo:

tablas similares → mismo padding
formularios similares → misma estructura
modales similares → mismo layout


no reinterpretar visualmente componentes similares


--------------------------------------------------
REGLAS PARA IA Y CODEX
--------------------------------------------------

no inventar estilos nuevos
no introducir nuevas variantes visuales
no reinterpretar diseño existente
no cambiar tamaños sin motivo funcional
no ajustar spacing sin motivo
no cambiar colores levemente
no usar valores arbitrarios
no introducir nuevas librerías visuales
no reemplazar componentes existentes sin motivo
no mejorar visualmente sin solicitud explícita


si falta información visual:

usar patrón existente en el proyecto


si existen múltiples opciones válidas:

elegir la más simple
elegir la más consistente


consistencia > creatividad


--------------------------------------------------
REGLA FINAL
--------------------------------------------------

la interfaz debe sentirse diseñada por una sola persona

no por múltiples interpretaciones acumuladas

cada cambio debe mantener coherencia con el resto del sistema

si un cambio introduce inconsistencia visual, debe ajustarse