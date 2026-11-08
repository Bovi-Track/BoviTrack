# Informe técnico de BoviTrack

| | |
|---|---|
| **Proyecto** | BoviTrack |
| **Repositorio** | https://github.com/Bovi-Track/BoviTrack (rama `main`) |
| **Base documental** | `Contexto-Desarrollo-BoviTrack.md` y `bitacora.md` (actualizados al 2026-10-18), más inspección del código fuente |
| **Tipo de sistema** | Aplicación web progresiva (PWA) para gestión de engorde de toros |

---

## Tabla de contenido

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Alcance funcional](#2-alcance-funcional)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura](#4-arquitectura)
5. [Estructura del repositorio](#5-estructura-del-repositorio)
6. [Frontend](#6-frontend)
7. [Autenticación y autorización](#7-autenticación-y-autorización)
8. [Capa de datos (Supabase / PostgreSQL)](#8-capa-de-datos-supabase--postgresql)
9. [Operación offline](#9-operación-offline)
10. [Reglas de negocio implementadas](#10-reglas-de-negocio-implementadas)
11. [Generación de PDF](#11-generación-de-pdf)
12. [API FastAPI](#12-api-fastapi)
13. [Seguridad](#13-seguridad)
14. [Requisitos no funcionales](#14-requisitos-no-funcionales)
15. [Pruebas y validación](#15-pruebas-y-validación)
16. [Despliegue y configuración](#16-despliegue-y-configuración)
17. [Estado de avance](#17-estado-de-avance)
18. [Observaciones técnicas y riesgos](#18-observaciones-técnicas-y-riesgos)
19. [Fuera de alcance](#19-fuera-de-alcance)
20. [Recomendaciones](#20-recomendaciones)

---

## 1. Resumen ejecutivo

BoviTrack administra fincas dedicadas al engorde de toros: compras, asignaciones y traslados, pesajes, Ganancia Media Diaria (GMD), sanidad, insumos, tareas, ventas, bajas y trazabilidad. Incorpora una evaluación económica que indica si conviene vender un animal en el momento de la consulta.

La solución sigue un enfoque **frontend-céntrico con backend gestionado**:

- **React + TypeScript + Vite** como cliente PWA, con despliegue previsto en Cloudflare Pages.
- **Supabase** (Auth, PostgreSQL, RLS y funciones RPC) como backend principal.
- **FastAPI** como base mínima reservada para necesidades futuras puntuales. **Importante: FastAPI existe en el repositorio (`api/`) pero actualmente NO se utiliza.** Ninguna parte del frontend la invoca; toda la lógica de negocio y los datos se resuelven con Supabase.
- **Capa offline propia** con Service Worker e IndexedDB para cuatro tipos de captura en campo.

La regla arquitectónica central es que **las reglas de acceso y consistencia se aplican en el servidor** (RLS, permisos y RPC); los controles de la interfaz solo adaptan lo que se muestra.

Según la bitácora, la gran mayoría de los requisitos funcionales figuran en **100 %** de avance. Las excepciones son RF-UC14-02 (recuperación de contraseña, 90 %) y RF-TR-01 (captura offline, 95 %).

---

## 2. Alcance funcional

### 2.1 Actores

| Actor | Alcance |
|---|---|
| `ADMINISTRADOR` | Administra sus fincas, toros, compras, catálogo, tareas, usuarios, ventas, evaluaciones y reportes; accede a información financiera. |
| `PERSONAL_CAMPO` | Opera solo en fincas asignadas: consulta toros, pesajes y sanidad; registra pesajes, aplicaciones sanitarias, movimientos de inventario y bajas; consulta y actualiza sus tareas. Sin acceso financiero ni administrativo. |

Un usuario puede tener un **rol distinto en cada finca**. Toda cuenta activa puede crear fincas propias y queda como `ADMINISTRADOR` de ellas. El ingreso a otras fincas se hace por alta directa por correo o por invitación mediante enlace.

### 2.2 Casos de uso

| ID | Caso de uso | Actor |
|---|---|---|
| UC-01 | Registrar compra de ganado y costo inicial | Administrador |
| UC-02 | Consultar trazabilidad completa del toro | Administrador / Personal |
| UC-03 | Gestionar fincas, pertenencia y traslados | Administrador |
| UC-04 | Crear, consultar, modificar y desactivar toros | Administrador |
| UC-05 | Registrar pesajes válidos | Administrador / Personal |
| UC-06 | Consultar evolución de peso y GMD | Administrador / Personal |
| UC-07 | Registrar sanidad, próximas aplicaciones y alertas | Administrador / Personal |
| UC-08 | Gestionar catálogo de insumos | Administrador |
| UC-09 | Registrar movimientos y consultar existencias e historial | Administrador / Personal |
| UC-10 | Evaluar si conviene vender ahora | Administrador |
| UC-11 | Gestionar tareas (el personal consulta y actualiza las suyas) | Administrador / Personal |
| UC-12 | Registrar venta, rentabilidad y cambio de estado | Administrador |
| UC-13 | Registrar baja o mortalidad conservando historial | Administrador / Personal |
| UC-14 | Iniciar/cerrar sesión, recuperar contraseña y aplicar permisos | Administrador / Personal |
| UC-15 | Administrar cuentas del personal y sus roles | Administrador |

Los requisitos funcionales (RF-UCxx-yy y RF-TR-01/02/03) se mantienen en `bitacora.md`.

---

## 3. Stack tecnológico

| Capa | Tecnología | Versión declarada |
|---|---|---|
| Framework UI | React | ^19.2.8 |
| Lenguaje | TypeScript | ~6.0.2 |
| Bundler | Vite (+ `@vitejs/plugin-react`) | ^8.2.2 |
| Estilos | Tailwind CSS (`@tailwindcss/vite`) | ^4.3.3 |
| Enrutamiento | react-router-dom | ^7.18.3 |
| Iconografía | lucide-react | ^1.44.0 |
| Cliente backend | @supabase/supabase-js | ^2.116.0 |
| PDF | jspdf + jspdf-autotable | ^4.2.1 / ^5.0.8 |
| Lint | ESLint + typescript-eslint + react-hooks + react-refresh | ^10.9.0 |
| Backend principal | Supabase (Auth, PostgreSQL 17, RLS, RPC) | `major_version = 17` |
| API auxiliar (**sin uso actual**) | FastAPI (`fastapi[standard]`), Python ≥ 3.12, gestionado con `uv`. Solo andamio: no es consumida por el frontend | >=0.141.1 |
| Offline | Service Worker + IndexedDB nativo | — |
| Despliegue previsto | Cloudflare Pages (front) · contenedor Docker (API) | — |

Scripts del frontend: `dev` (Vite), `build` (`tsc -b && vite build`), `lint` (ESLint) y `preview`.

---

## 4. Arquitectura

### 4.1 Vista general

```
┌──────────────────────────────────────────────┐
│  Navegador (PWA)                             │
│  React + TS + Tailwind                       │
│  ├─ AuthProvider  ──► sesión / perfil        │
│  ├─ FarmProvider  ──► finca activa + rol     │
│  ├─ pages/ · components/ · lib/ · types/     │
│  ├─ offline/ (IndexedDB: cache + cola)       │
│  └─ Service Worker (archivos del build)      │
└───────────────┬──────────────────────────────┘
                │ HTTPS (clave pública + JWT)
                ▼
┌──────────────────────────────────────────────┐
│  Supabase                                    │
│  ├─ Auth (credenciales, sesión, JWT)         │
│  ├─ PostgREST: consultas autorizadas (RLS)   │
│  ├─ RPC SQL (SECURITY DEFINER, transacciones)│
│  └─ PostgreSQL 17                            │
└──────────────────────────────────────────────┘

      (reservado, SIN USO)  FastAPI: GET /  ·  GET /health
      Ningún componente del sistema la llama actualmente.
```

### 4.2 Decisiones de diseño

- **Lógica en la base de datos.** Las operaciones que requieren consistencia entre varios registros o validación de saldo se resuelven con RPC transaccionales. No se traslada a FastAPI lo que Supabase ya resuelve. **En consecuencia, FastAPI no forma parte del flujo real del sistema hoy.**
- **Seguridad en el servidor.** El navegador usa solo la clave pública de Supabase y el JWT del usuario. Los controles visuales (por ejemplo ocultar la pestaña *Finca*) son cosmética; la autorización real está en RLS, permisos y RPC.
- **Inventario por RPC exclusiva.** El acceso a las tablas de inventario se realiza únicamente mediante sus RPC.
- **Sin interceptación global de HTTP.** La capa offline conecta los servicios existentes con caché y sincronizador (`offline/runtime.ts`), sin interceptar todas las peticiones.
- **IndexedDB directo, sin PGlite.** Se eligió por simplicidad.
- **GMD derivada, no almacenada.** Se calcula a partir de los pesajes para evitar copias inconsistentes.
- **Historial inmutable.** Desactivar en lugar de borrar; los eventos confirmados se corrigen con nuevos eventos.

---

## 5. Estructura del repositorio

```
BoviTrack/
├── README.md                          (mínimo: solo título)
├── Contexto-Desarrollo-BoviTrack.md   Propósito, arquitectura, reglas
├── bitacora.md                        Requisitos funcionales y avance
├── package.json                       Dependencias en raíz (supabase CLI, vite, etc.)
├── skills-lock.json                   Skills de agente (supabase, postgres best practices)
├── api/                               Base FastAPI
│   ├── app/main.py                    GET /  y  GET /health
│   ├── Dockerfile · pyproject.toml · uv.lock
├── supabase/
│   └── config.toml                    Configuración local de Supabase
└── frontend/
    ├── index.html · vite.config.ts · service-worker.js
    ├── public/                        manifest.webmanifest, _redirects, iconos
    ├── sql/                           Scripts de cambios y verificación (versionados)
    └── src/
        ├── main.tsx · App.tsx
        ├── auth/                      AuthProvider, useAuth, service, access
        ├── context/                   FarmContext, useFarm
        ├── pages/                     Pantallas (rutas)
        ├── components/                auth/ · bovines/ · dashboard/ · farms/
        ├── lib/                       Servicios de datos y lógica de dominio
        ├── offline/                   store, runtime, project, identity, types, UI
        └── types/                     Tipos compartidos por dominio
```

---

## 6. Frontend

### 6.1 Flujo de arranque

`main.tsx` → monta `AuthProvider` → `App.tsx` resuelve rutas → en rutas privadas, `RequireAuth` exige sesión → `AppShell` monta `FarmProvider` (con `key` por usuario) → cada página.

### 6.2 Rutas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | Redirige a `/inicio` | Público |
| `/iniciar-sesion` | `LoginPage` | Público |
| `/registro` | `RegisterPage` | Público |
| `/olvidar-contrasena` | `ForgotPasswordPage` | Público |
| `/restablecer-contrasena` | `ResetPasswordPage` | Público |
| `/unirse` | `JoinFarmPage` (aceptar invitación) | Público |
| `/inicio` | `HomePage` | Autenticado |
| `/toros` | `BullsPage` | Autenticado |
| `/pesajes` | `WeighingsPage` | Autenticado |
| `/tareas` | `TasksPage` | Autenticado |
| `/inventario` | `InventoryPage` | Autenticado (según rol en finca) |
| `/ajustes` | `SettingsPage` | Autenticado |
| `/finca` | `FarmManagePage` | Solo `ADMINISTRADOR` |
| `/compras` | `PurchasesPage` | Solo `ADMINISTRADOR` |
| `/reporte` | `ReportPage` | Solo `ADMINISTRADOR` |
| `/ventas` | `SalesPage` | Solo `ADMINISTRADOR` |

`FarmScreen` (dentro de `AppShell`) bloquea `/finca`, `/compras`, `/reporte` y `/ventas` si el rol activo no es `admin`, y reinicia el árbol de pantalla cuando cambia la finca o el rol (`key = finca:rol`) para descartar estado de otra finca.

### 6.3 Organización del código

| Carpeta | Responsabilidad |
|---|---|
| `pages/` | Coordinan pantallas |
| `components/` | Piezas reutilizables por dominio (`auth`, `bovines`, `dashboard`, `farms`) |
| `lib/` | Servicios de datos y lógica de dominio (`bovines`, `weighings`, `gmd`, `sanitary`, `inventory`, `purchases`, `sales`, `disposals`, `tasks`, `farms`, `report`, `dashboard`, `bovine-movements`, `bovine-traceability`, `dates`, `passwordPolicy`, `pending-invite`, `supabase`) |
| `types/` | Tipos compartidos (`inventory`, `sanitary`, `purchases`, `dashboard`, `bovine-movements`, `bovine-traceability`) |
| `auth/` | Proveedor, hook y operaciones de acceso |
| `context/` | Finca activa y roles |
| `offline/` | Caché y sincronización |

### 6.4 Convenciones observadas

- Las funciones de entrada llevan **comentarios con el ID del requisito** (`// RF-UC14-03: …`) y los helpers describen su operación.
- Los roles de la base (`ADMINISTRADOR`, `PERSONAL_CAMPO`) se mapean internamente a `admin` / `campo` para presentación y caché; no son roles adicionales de la base.
- Los formularios liberan su estado de envío ante respuestas y excepciones.

### 6.5 Interfaz

Navegación móvil inferior (`BottomNav`) con seis entradas (la de *Finca* solo para administradores). Componentes de soporte: `Modal`, `Toast`, `SegmentButton`, `OfflineStatus`. La interfaz es adaptable a móvil, tableta y escritorio. El manifest declara `display: standalone`, `start_url: /inicio`, `theme_color #234938` y `background_color #faf7f0`.

---

## 7. Autenticación y autorización

### 7.1 Autenticación

- **Supabase Auth** gestiona credenciales, sesión y JWT.
- Configuración local relevante (`supabase/config.toml`): `jwt_expiry = 3600`, rotación de refresh token habilitada, registro habilitado, inicios anónimos deshabilitados, longitud mínima de contraseña 8 y requisito de minúsculas, mayúsculas, dígitos y símbolos; `site_url = https://bovitrack.pages.dev`.
- La política de contraseña del cliente (`lib/passwordPolicy.ts`) exige 8–72 caracteres con minúscula, mayúscula, número y símbolo.
- Inicio de sesión por **correo o nombre de usuario** (resolución vía RPC `correo_por_username`).
- `AuthProvider` es la **única fuente del usuario activo**; el resultado inicial de Auth no puede sobrescribir un evento de sesión más reciente.
- La sesión **revalida el perfil** al entrar, al recuperar conexión, al enfocar la app y cada 30 segundos (RPC `verificar_cuenta_activa`). Una invalidación conserva las capturas offline pendientes.
- No se permite un primer inicio de sesión sin conexión. Se respeta la opción *Recordarme*.

### 7.2 Autorización

Modelo de tres niveles:

1. **Cuenta activa** (validada por RPC).
2. **Membresía en la finca** con su rol.
3. **Rol** (`ADMINISTRADOR` / `PERSONAL_CAMPO`); los roles desconocidos no conceden permisos administrativos.

El script `uc14_control_acceso.sql` consolida los nombres de rol anteriores conservando membresías e invitaciones, restringe su recreación y fue aplicado en Supabase. Una sesión autenticada **no concede por sí sola acceso a todas las fincas**.

### 7.3 Gestión de equipo (UC-15)

Alta directa por correo (RPC `agregar_miembro_finca`), invitación por enlace (`crear_invitacion_finca` / `aceptar_invitacion_finca`), cambio de rol por finca y retiro (`eliminar_miembro_finca`). Se rechaza la autodemoción del administrador. La invitación pendiente se conserva en el cliente (`lib/pending-invite.ts`) hasta tener sesión.

---

## 8. Capa de datos (Supabase / PostgreSQL)

### 8.1 Acceso

- Lecturas y escrituras autorizadas con `supabase-js`.
- Operaciones transaccionales y críticas mediante **RPC SQL**.
- Las funciones privilegiadas validan usuario, cuenta activa, rol y finca; usan referencias calificadas y `search_path` seguro.

### 8.2 RPC utilizadas por el cliente

| Dominio | RPC |
|---|---|
| Cuenta / acceso | `verificar_cuenta_activa`, `correo_por_username`, `obtener_roles`, `obtener_fincas_usuario` |
| Fincas y equipo | `crear_finca`, `actualizar_finca`, `obtener_miembros_finca`, `agregar_miembro_finca`, `eliminar_miembro_finca`, `crear_invitacion_finca`, `aceptar_invitacion_finca` |
| Toros | `obtener_bovinos_finca`, `registrar_bovinos`, `actualizar_bovino`, `registrar_movimiento_bovino`, `obtener_movimientos_bovinos`, `obtener_trazabilidad_bovino` |
| Compras | `registrar_compra_subasta`, `obtener_costos_bovinos_finca` |
| Pesajes | `obtener_pesajes_finca` (registro vía `procesar_operacion_offline` / servicio de pesajes) |
| Sanidad | `obtener_registros_sanitarios_finca`, `eliminar_registro_sanitario` |
| Ventas | `registrar_venta`, `obtener_ventas_finca` |
| Bajas | `registrar_baja`, `obtener_bajas_bovino`, `obtener_perdida_baja`, `completar_perdida_baja` |
| Tareas | `crear_tarea_finca`, `actualizar_tarea_finca`, `obtener_tareas_finca`, `obtener_historial_tarea` |
| Offline | `procesar_operacion_offline` |
| Reportes | `autorizar_reporte_finca` |

Otras funciones definidas en los scripts SQL: `registrar_pesaje`, `registrar_aplicacion_sanitaria`, `marcar_tarea_estado`, `es_miembro_finca`, `obtener_inventario_finca`, `guardar_insumo`, `desactivar_insumo`, `registrar_movimiento_inventario`, `obtener_movimientos_insumo`, `obtener_reporte_inventario`. En el esquema `private` existe la función de trigger `validar_edicion_bovino`.

### 8.3 Scripts SQL versionados (`frontend/sql/`)

| Script | Propósito |
|---|---|
| `uc01_registrar_compra_subasta.sql` | Compra de ganado y costo inicial |
| `uc02_trazabilidad_bovino.sql` | Cronología unificada del toro |
| `uc03_movimientos_bovinos.sql` | Retiro, asignación y traslado (aplicar **después de UC-13**) |
| `uc04_uc05_bovinos_pesajes.sql` | Toros y pesajes |
| `uc08_uc09_inventario.sql` | Catálogo, movimientos e historial de inventario |
| `uc08_nombres_unicos.sql` | Unicidad de nombres de insumos |
| `uc12_registrar_venta.sql` | Ventas y rentabilidad |
| `uc13_registrar_baja.sql` | Bajas y pérdida |
| `uc14_control_acceso.sql` | Roles canónicos, cuentas activas, permisos |
| `uc14_agregar_miembro_ambos_roles.sql` | Alta de miembros con ambos roles |
| `rf_uc11_editar_tareas.sql` | Edición e historial de tareas |
| `rf_tr02_offline.sql` | Procesamiento idempotente de operaciones offline |
| `uc_bovino_diio_opcional.sql` | DIIO opcional en el alta general |
| `*_verificacion.sql` / `*_inspeccion.sql` | Consultas de verificación e inspección del estado aplicado |

### 8.4 Esquema

`bd-completa.csv` y `bd-postgres.csv` son exportaciones **locales** de estructura y **no prueban** los registros ni el estado remoto actual (no están incluidas en el repositorio inspeccionado). Antes de modificar la base debe comprobarse el estado vigente de sus objetos y dependencias.

---

## 9. Operación offline

### 9.1 Alcance

Solo se permite capturar sin conexión: **pesajes, aplicaciones sanitarias, movimientos de inventario y actualizaciones de tareas**. Todo lo demás requiere conexión.

### 9.2 Componentes

| Componente | Función |
|---|---|
| **Service Worker** (`service-worker.js` → `sw.js`) | Precachea el build (`index.html`, manifest, favicon y assets `.js/.css/.png/.svg/.woff2`). La versión de caché se deriva de un hash SHA-256 de los archivos y de la plantilla. Solo atiende peticiones `GET` del mismo origen; no almacena respuestas de Supabase. La navegación cae a `/index.html` sin red. |
| **IndexedDB** (`bovitrack-offline`, v1) | Dos almacenes: `cache` (clave `[user_id, key]`, datos operativos autorizados) y `queue` (clave autoincremental `sequence`, índices por `userId` e `id` único). |
| **Runtime** (`offline/runtime.ts`) | Conecta los servicios existentes con la caché y el sincronizador, sin interceptar HTTP globalmente. |
| **Proyección** (`offline/project.ts`) | Calcula el estado optimista local de cada operación. |
| **Estado en UI** (`OfflineStatus.tsx`) | Muestra conexión, pendientes y rechazos. |

El plugin de Vite `bovitrack-offline-app` genera el Service Worker en el `generateBundle`, inyectando versión y lista de archivos. En modo desarrollo (`npm run dev`) el Service Worker **no** se instala.

### 9.3 Modelo de operación

```ts
type OperationKind  = 'weighing' | 'sanitary' | 'inventory' | 'task'
type OperationState = 'pending' | 'rejected'

type OfflineOperation = {
  sequence?: number
  id: string            // identificador único (idempotencia)
  userId: string
  farmId: string
  kind: OperationKind
  payload: Record<string, unknown>
  optimistic: unknown   // resultado provisional mostrado en UI
  state: OperationState
  error: string | null
  createdAt: string
}
```

### 9.4 Sincronización

- Se dispara al recuperar conexión, al abrir/enfocar la app y con reintentos mientras está abierta, desde cualquier pantalla.
- La RPC **`procesar_operacion_offline`** valida cuenta, rol, finca y datos, y registra la operación y su confirmación **en una transacción**. Un reintento devuelve la confirmación original (**idempotencia**).
- `rf_tr02_offline.sql` aplica RLS en la tabla privada de confirmaciones y revoca permisos directos.
- **Fallo de red** → la operación sigue pendiente. **Rechazo del servidor** → queda visible y **bloquea la cola** hasta resolverse. **Sesión inválida** → solicita autenticación sin borrar capturas.
- No se permite cerrar sesión con capturas sin resolver; al cerrar sesión se limpian las copias del usuario.
- Los **saldos offline son provisionales**; Supabase puede rechazar movimientos por cambios concurrentes.
- Una captura offline nueva asociada a una finca anterior (tras un traslado) se rechaza al sincronizar.
- La cola antigua de pesajes en `localStorage` se conserva sin enviarse (no identifica propietario) y requiere revisión manual.

---

## 10. Reglas de negocio implementadas

### 10.1 Toros y movimientos

- Unicidad de correo, identificador interno del toro y DIIO/SENASA. El alta general permite DIIO vacío; **compras lo exige** (distinción mantenida deliberadamente).
- Un toro pertenece a **una sola finca activa** a la vez; asignaciones, retiros y traslados conservan origen, destino y fecha.
- Retirar → `INACTIVO` (conserva última finca). Asignar → `ACTIVO`. Trasladar → cambia finca de un `ACTIVO` y mantiene el estado. Se exige administración y finca activa en origen y destino.
- Estado y finca **solo cambian por flujos transaccionales**; los datos básicos se editan desde la ficha. Un trigger (`validar_edicion_bovino`) y la RPC `actualizar_bovino` protegen esa restricción.
- Fecha de movimiento: no futura, no anterior al ingreso ni al último movimiento. El servidor comprueba el origen esperado y **bloquea el toro** para impedir traslados concurrentes incompatibles.
- La finca actual ve todos los movimientos; una finca anterior solo los eventos donde participó.

### 10.2 Pesajes y GMD

- Peso positivo, con toro y responsable válidos.
- `GMD = (peso final − peso inicial) / días entre pesajes`; no se almacena. Intervalos de cero días se omiten. Unidad: kg/día.
- Gráficas: curva de peso con escala horizontal proporcional a los días reales, y GMD por intervalo consecutivo ubicada en el punto medio.

### 10.3 Compras

El costo inicial por toro es `peso × precio/kg + flete proporcional`, con aritmética en **centavos enteros** y reparto exacto de centavos, coincidente con el redondeo decimal de PostgreSQL. La compra conserva factura, origen, fechas y toros; la operación es atómica (una colisión de DIIO no deja datos parciales).

### 10.4 Evaluación de venta

- Requiere **≥ 8 fechas distintas con pesajes positivos dentro de los últimos 56 días**, incluyendo hoy.
- Usa peso actual, GMD de esa ventana, costos acumulados, mantenimiento diario y precio esperado/kg (estos dos últimos, entradas del administrador).
- Rentable hoy si `precio esperado × peso actual ≥ compra + flete + mantenimiento acumulado`. Punto de equilibrio = `costo acumulado / peso actual`.
- Sin proyecciones futuras ni imputación de costos sanitarios/inventario por toro (no existe vínculo histórico).

### 10.5 Inventario

- Cantidades positivas; `ENTRADA` y `AJUSTE_POSITIVO` suman; `SALIDA`, `CONSUMO` y `AJUSTE_NEGATIVO` restan. Categorías: `ALIMENTO`, `SUPLEMENTO`, `MEDICAMENTO`, `VACUNA`.
- El saldo se **calcula desde movimientos** y no puede quedar negativo.
- Movimientos confirmados **inmutables** (se corrigen con ajustes). Con historial, no se cambia unidad ni categoría. Desactivar conserva saldo/historial y bloquea nuevos movimientos.

### 10.6 Ventas y bajas

- Solo sobre toros **activos** no vendidos ni dados de baja; evento y cambio de estado en **una transacción**.
- `VENDIDO` y `BAJA` son **estados terminales**: sin reactivación ni intercambio.
- Rentabilidad = `ingreso bruto − compra − flete − mantenimiento desde ingreso`. Con costos ausentes queda no disponible.
- Pérdida por baja = `compra + flete + mantenimiento diario × días desde ingreso hasta la baja`. Sin datos suficientes queda `NULL` (nunca cero); el administrador puede completarla (`completar_perdida_baja`) y un importe confirmado no se sobrescribe. **El personal no solicita ni recibe importes.** Las bajas requieren conexión y no entran en la cola offline.

### 10.7 Tareas

Pertenecen a una finca y se asignan solo a usuarios con acceso. El personal consulta y actualiza únicamente las suyas (incluidas las copias locales); las tareas sin responsable quedan bajo administración. Los cambios conservan historial.

### 10.8 Desactivación

Fincas, toros, insumos y usuarios se **desactivan**; los registros necesarios para trazabilidad no se borran físicamente.

---

## 11. Generación de PDF

- Se genera **en el navegador** con `jspdf` y `jspdf-autotable` (`lib/report.ts`, `pages/ReportPage.tsx`).
- Secciones seleccionables: **Reporte semanal**, **Resumen de la finca**, **Inventario de toros**, **Historial de pesajes** e **Inventario de bodega** (solo administradores).
- Incluye además, según el periodo: pesajes/GMD, ventas cerradas (ingreso bruto, costos, rentabilidad) y sanidad (producto, dosis, fecha, próxima aplicación, responsable).
- Periodo **inclusivo** (Desde/Hasta) aplicado a pesajes/GMD, ventas, sanidad e inventario; se rechazan fechas invertidas.
- Toda descarga **revalida el acceso** con la RPC `autorizar_reporte_finca` (UC-14), y la bodega consulta además `obtener_reporte_inventario`.
- Si falta información, **no se descarga un reporte incompleto**.
- Nota: el periodo de bodega no filtra las otras secciones del PDF.

---

## 12. API FastAPI

> **FastAPI NO se utiliza actualmente en BoviTrack.** La carpeta `api/` es solo un andamio inicial. El frontend no realiza ninguna llamada a esta API (no hay referencias a su URL, a `localhost:8000` ni a variables de entorno que la apunten) y todo el acceso a datos y las operaciones de negocio pasan directamente por Supabase (consultas con RLS y RPC). Para el funcionamiento de la aplicación, esta API es prescindible.

`api/` contiene una base mínima:

| Endpoint | Respuesta |
|---|---|
| `GET /` | `{"message": "BoviTrack API"}` |
| `GET /health` | `{"status": "ok"}` |

- Python ≥ 3.12, `fastapi[standard]`, gestión con `uv`.
- `Dockerfile` basado en `ghcr.io/astral-sh/uv:python3.12-trixie-slim`, expone el puerto 8000 y ejecuta `uvicorn` con `PORT` configurable.
- **No es obligatorio** migrar a FastAPI las operaciones ya resueltas con Supabase; se reserva para necesidades concretas que aún no han surgido.
- **Estado real:** sin consumidores, sin endpoints de negocio, sin autenticación ni conexión a base de datos. Por eso tampoco forma parte del despliegue funcional ni de las pruebas reportadas.

---

## 13. Seguridad

| Aspecto | Implementación |
|---|---|
| Autenticación | Supabase Auth con JWT de 1 h y rotación de refresh token |
| Autorización | RLS + permisos + RPC que validan usuario activo, rol y finca |
| Clave en cliente | Solo la clave pública de Supabase; credenciales privilegiadas y contraseñas fuera del repositorio |
| Funciones privilegiadas | Validación de identidad, referencias calificadas, `search_path` seguro |
| Tabla de operaciones offline | RLS habilitado y permisos directos revocados |
| Inventario | Acceso a tablas exclusivamente por RPC |
| Datos financieros | Ocultos al personal en UI **y** en las RPC (el personal no recibe importes) |
| Acceso directo | `PATCH` directo para cambiar estado o finca de un toro es rechazado |
| Transporte | HTTPS/TLS (RN-SP-01) |
| Aislamiento offline | Caché y cola indexadas por usuario; limpieza al cerrar sesión |
| Roles | Solo `ADMINISTRADOR` y `PERSONAL_CAMPO`; roles desconocidos sin privilegios |
| Redirecciones Auth | Lista blanca de URL (`bovitrack.pages.dev`, `localhost:5173`, `127.0.0.1:5173`) |

---

## 14. Requisitos no funcionales

Son **objetivos de aceptación**; su presencia no implica que estén comprobados.

| ID | Prioridad | Requisito |
|---|---|---|
| RN-RE-01 | Alta | Capturas locales responden en ≤ 2 s |
| RN-RE-02 | Media | La evaluación de venta se recalcula al solicitarla o modificar sus datos |
| RN-UX-01 | Alta | Registrar pesaje o aplicación sanitaria en móvil < 3 min en promedio |
| RN-UX-02 | Alta | Alto contraste, tipografía legible y controles adecuados para luz solar |
| RN-UX-03 | Media | Iconografía clara y confirmaciones visuales |
| RN-DA-01 | Alta | PWA con las cuatro capturas offline; el resto requiere internet |
| RN-DA-02 | Media | Disponibilidad objetivo 99,5 % (sin garantía contractual del plan gratuito) |
| RN-CP-01 | Alta | Compatibilidad con Chrome, Safari, Firefox y Edge modernos, móvil y escritorio |
| RN-CP-02 | Alta | Interfaz adaptable a smartphone, tableta y escritorio |
| RN-SP-01 | Alta | Comunicación con la nube por HTTPS/TLS |

---

## 15. Pruebas y validación

### 15.1 Estrategia reportada

La bitácora documenta una validación **por requisito**, combinando:

- **Pruebas unitarias** (por ejemplo, reparto de centavos del flete y cálculo de rentabilidad).
- **Verificaciones SQL** (`*_verificacion.sql`) y comprobaciones sobre PostgreSQL local/temporal (permisos, concurrencia, reversión, inactivos, fechas).
- **Pruebas de navegador con Supabase simulado** (Chromium).
- **Pruebas contra Supabase real** con cuentas reales de administrador y personal, usando **fincas QA aisladas** que se desactivan al terminar conservando su historial.
- Chequeos HTTP directos (rechazos 403 / `42501`, `PATCH` directo, no miembro).
- `build` y `lint` reportados como correctos.

### 15.2 Scripts de prueba referenciados

| Script | Objetivo | Resultado reportado |
|---|---|---|
| `frontend/tests/offline-browser.py` | Prueba de navegador offline | — |
| `frontend/tests/offline-sql.py` | Prueba SQL del flujo offline | — |
| `frontend/tests/offline-live.py` | Offline contra Supabase real (administrador) | 49 comprobaciones aprobadas |
| `frontend/tests/field-live.py` | Campo contra Supabase real (personal) | 89 comprobaciones aprobadas |

Otras cifras reportadas: UC-14 administrador, 39 controles HTTP/Chromium; UC-03, 32 comprobaciones PostgreSQL y 55 HTTP/Chromium; UC-13, 30 comprobaciones PostgreSQL y 55 HTTP/Chromium.

> **Nota:** el directorio `frontend/tests/` **no está presente** en el repositorio todavía no se pueden documentar.

### 15.3 Pendientes de validación

- **Cuenta inactiva real**: confirmada manualmente por el usuario para varios flujos; persiste como pendiente en algunas referencias del documento de contexto (inconsistencia documental, ver sección 18).
- **Recuperación de contraseña** completa (correo, enlace y cambio) en Supabase.
- **Revisión manual de la cola antigua** de pesajes sin propietario.

---

## 16. Despliegue y configuración

| Componente | Destino previsto / configuración |
|---|---|
| Frontend | Cloudflare Pages (`https://bovitrack.pages.dev`). `public/_redirects` contiene `/* /index.html 200` para enrutamiento SPA. |
| Backend de datos | Proyecto Supabase. Local: API 54321, DB 54322, Studio 54323, SMTP local 54324 (`supabase/config.toml`). |
| API auxiliar (**sin uso actual**) | Contenedor Docker (`api/Dockerfile`), puerto `${PORT:-8000}`. No es necesario desplegarla para que el sistema funcione. |
| Variables de entorno | `vite.config.ts` usa `envDir` en la raíz del repositorio (`projectRoot`). El cliente requiere URL y clave pública de Supabase; **no deben versionarse credenciales privilegiadas**. |
| Orden de scripts SQL | Aplicar los scripts de `frontend/sql/` verificando dependencias; `uc03_movimientos_bovinos.sql` debe aplicarse después de UC-13. |

### Puesta en marcha local (inferida)

```bash
# Frontend
cd frontend
npm install
npm run dev        # desarrollo (sin Service Worker)
npm run build      # tsc -b && vite build (genera sw.js)
npm run preview    # prueba del build de producción (con Service Worker)
npm run lint

# API (opcional)
cd api
uv sync
uv run uvicorn app.main:app --reload
```

---

## 17. Estado de avance

Resumen de la bitácora (actualizada al 2026-10-18):

| Grupo | Requisitos | Avance |
|---|---|---|
| Compras (UC-01) | RF-UC01-01, 01-02 | 100 % |
| Trazabilidad (UC-02) | RF-UC02-01 | 100 % |
| Fincas y movimientos (UC-03) | RF-UC03-01, 03-02 | 100 % |
| Toros (UC-04) | RF-UC04-01 | 100 % |
| Pesajes y GMD (UC-05/06) | RF-UC05-01, 06-01, 06-02 | 100 % |
| Sanidad (UC-07) | RF-UC07-01, 07-02 | 100 % |
| Inventario (UC-08/09) | RF-UC08-01, 09-01, 09-02 | 100 % |
| Evaluación de venta (UC-10) | RF-UC10-01, 10-02, 10-03 | 100 % |
| Tareas (UC-11) | RF-UC11-01, 11-02 | 100 % |
| Ventas (UC-12) | RF-UC12-01, 12-02 | 100 % |
| Bajas (UC-13) | RF-UC13-01 | 100 % |
| Acceso (UC-14) | RF-UC14-01, 14-03 | 100 % |
| Recuperar contraseña | RF-UC14-02 | **90 %** |
| Equipo (UC-15) | RF-UC15-01, 15-02 | 100 % |
| Offline: captura | RF-TR-01 | **95 %** |
| Offline: sincronización | RF-TR-02 | 100 % |
| PDF por periodo | RF-TR-03 | 100 % |

Los porcentajes son estimaciones; **100 % significa implementado y validado**. Una pantalla existente no implica que el caso de uso esté terminado.

---

## 18. Observaciones técnicas y riesgos

Hallazgos de la inspección del repositorio y la documentación:

1. **FastAPI presente pero sin uso.** La carpeta `api/` solo expone `/` y `/health` y ningún componente la consume. Genera la impresión de un backend propio que en realidad no existe: el backend efectivo es Supabase. Debe decidirse si se mantiene como reserva (documentándolo claramente) o se retira para evitar confusión y mantenimiento innecesario.
2. **Documentación de entrada pobre.** El `README.md` raíz contiene solo el título y `frontend/README.md` es la plantilla por defecto de Vite. No hay guía de instalación, variables de entorno ni despliegue.
3. **`package.json` raíz inconsistente.** Declara `react`, `react-dom`, `vite`, `lucide-react` y `supabase` (CLI) pero no `react-router-dom`, `jspdf` ni Tailwind; esas dependencias están en `frontend/package.json`. Conviene aclarar su propósito (probablemente para la CLI de Supabase) o eliminar duplicados con versiones distintas.
4. **Artefactos referenciados pero ausentes.** `frontend/tests/*`, `bd-completa.csv`, `bd-postgres.csv` y los scripts base de definición de tablas no están en el repositorio inspeccionado; las pruebas y el esquema base no son reproducibles desde el repositorio. `supabase/config.toml` apunta a un `seed.sql` que tampoco existe en `supabase/`.
5. **Esquema sin migraciones formales.** Los cambios se guardan como scripts sueltos en `frontend/sql/` con un orden de aplicación manual (por ejemplo UC-03 depende de UC-13). Considerar migraciones versionadas en `supabase/migrations/`.
6. **Inconsistencia documental sobre "cuenta inactiva real".** El documento de contexto la menciona como pendiente, mientras la bitácora indica que el usuario ya la confirmó en la mayoría de requisitos. Debe unificarse.
7. **Offline sin cobertura total de navegadores en el documento de contexto.** El contexto indica Safari/Firefox pendientes, pero la bitácora (RF-TR-01) los reporta como probados y aceptados. Documentar el estado vigente.
8. **Dependencia fuerte de RPC.** La lógica crítica reside en PostgreSQL: mejora la consistencia, pero exige disciplina de versionado, pruebas SQL automatizadas y control de cambios sobre funciones `SECURITY DEFINER`.
9. **Service Worker acotado.** Cachea solo el build y la navegación; los datos dependen de IndexedDB. Una actualización de la app espera a que se cierren las pestañas anteriores; documentar este comportamiento para soporte.
10. **PDF del lado del cliente.** Reportes grandes dependen de la memoria del dispositivo; el periodo de bodega no filtra las demás secciones del PDF.
11. **Disponibilidad.** El objetivo de 99,5 % no tiene garantía contractual en el plan gratuito de la plataforma.
12. **Versiones muy recientes.** El stack usa versiones mayores recientes (React 19, TypeScript 6, Vite 8, Tailwind 4, ESLint 10); conviene fijar y vigilar compatibilidad entre plugins.
13. **Costos no atribuibles.** La evaluación de venta y la pérdida excluyen costos sanitarios y de inventario por toro porque no existe un vínculo histórico por animal; limita la exactitud del margen.

---

## 19. Fuera de alcance

- IA, aprendizaje automático y predicciones de precios o pesos futuros.
- Captura automática desde básculas, sensores o IoT.
- Facturación electrónica ante Hacienda y comercio/subastas de ganado en línea.
- Integración directa con la API de SENASA o Trazar-Agro.
- Aplicaciones nativas separadas y conexiones SQL directas desde el navegador.
- Captura offline de funciones administrativas o generación de reportes.

Una ampliación de alcance o un cambio de arquitectura requiere acuerdo previo.

---

## 20. Recomendaciones

**Prioridad alta**

1. Completar el `README.md` raíz con requisitos, variables de entorno, instalación, orden de scripts SQL y despliegue.
2. Incluir en el repositorio las pruebas (`frontend/tests/`) y el esquema base, o documentar cómo obtenerlos, para hacer reproducible la validación.
3. Migrar los scripts de `frontend/sql/` a `supabase/migrations/` con orden explícito, y agregar el `seed.sql` o retirar su referencia.
4. Cerrar los pendientes funcionales: prueba completa de recuperación de contraseña (RF-UC14-02) y revisión de la cola antigua de pesajes (RF-TR-01).

**Prioridad media**

5. Integrar `lint`, `build` y las pruebas SQL en CI antes del despliegue a Cloudflare Pages.
6. Unificar la documentación (`Contexto` vs `bitacora`) en los puntos señalados y limpiar el `package.json` raíz.
7. Definir una estrategia de monitoreo para el objetivo de disponibilidad y de errores en producción.
8. Aplicar el periodo del reporte también a las secciones de bodega y restantes del PDF de forma consistente.

**Prioridad baja**

9. Decidir sobre FastAPI, que hoy **no se usa**: mantenerla solo si se justifica con un caso concreto (por ejemplo, reportes pesados o integraciones) y documentarlo; de lo contrario, retirarla del alcance inmediato.
10. Evaluar un vínculo histórico de costos sanitarios/inventario por toro para refinar la rentabilidad, previo acuerdo de alcance.

---

*Informe elaborado a partir de la inspección del repositorio (código fuente, configuración y scripts SQL) y de los documentos `Contexto-Desarrollo-BoviTrack.md` y `bitacora.md`.*
