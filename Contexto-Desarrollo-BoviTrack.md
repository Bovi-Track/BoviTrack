# Contexto de desarrollo de BoviTrack

Actualizado: 2026-10-18.

Este documento define el propósito, la arquitectura, los actores y las reglas del proyecto. Los requisitos funcionales, sus porcentajes y pendientes se mantienen en [bitacora.md](bitacora.md).

## 1. Propósito y actores

BoviTrack administra fincas dedicadas al engorde de toros: compras, asignaciones y traslados, pesajes, Ganancia Media Diaria (GMD), sanidad, insumos, tareas, ventas, bajas y trazabilidad. La evaluación de venta determina si conviene vender en el momento de la consulta.

| Actor | Alcance autorizado |
|---|---|
| ADMINISTRADOR | Administra sus fincas, toros, compras, catálogo, tareas, usuarios, ventas, evaluaciones y reportes. Consulta información operativa y financiera. |
| PERSONAL_CAMPO | Opera únicamente en fincas asignadas. Consulta toros, pesajes y sanidad; registra pesajes, aplicaciones sanitarias, movimientos de inventario y bajas; consulta y actualiza sus tareas. No administra cuentas, catálogo ni fincas y no accede a información financiera. |

Un usuario puede tener un rol distinto en cada finca. Toda cuenta activa puede crear sus propias fincas y queda como `ADMINISTRADOR` de ellas; para ingresar en otra finca, su administrador puede agregar la cuenta registrada directamente por correo o generar una invitación por enlace. Ambos mecanismos permiten `ADMINISTRADOR` y `PERSONAL_CAMPO`. La sesión autenticada no concede por sí sola acceso a todas las fincas.

## 2. Arquitectura vigente

- **Frontend:** React, TypeScript y Vite con Tailwind CSS; Cloudflare Pages es el despliegue previsto. El flujo entra por `main.tsx`, monta `AuthProvider`, resuelve rutas en `App.tsx` y, en rutas privadas, usa `AppShell` y `FarmProvider` antes de mostrar cada página. `pages/` coordina pantallas; `components/` reúne piezas reutilizables por dominio; `lib/` contiene servicios de datos y lógica de dominio; `types/` reúne tipos compartidos. El build incluye Service Worker y caché de aplicación; la aceptación offline en Supabase y otros navegadores sigue pendiente.
- **Autenticación:** Supabase Auth administra credenciales, sesión y JWT. `frontend/src/auth/` agrupa proveedor, hook y operaciones de acceso; `AuthProvider` es la fuente del usuario activo y las pantallas llaman al servicio de autenticación. `frontend/src/context/` comparte la finca y sus roles. `frontend/src/offline/` resuelve caché y sincronización.
- **Datos y operaciones:** React usa `supabase-js` para consultas autorizadas y RPC SQL en Supabase. Las reglas de acceso y consistencia deben aplicarse centralmente con RLS, permisos y RPC; los controles visuales solo adaptan la interfaz.
- **Transacciones:** las operaciones que necesitan consistencia entre varios registros o validación de saldo se resuelven mediante RPC. Las funciones privilegiadas deben validar usuario, cuenta activa, rol y finca, y usar referencias calificadas y `search_path` seguro. En inventario, el acceso a las tablas se realiza exclusivamente mediante sus RPC.
- **PDF:** generación en el navegador con `jspdf` y `jspdf-autotable`. La sección de bodega consulta su RPC autorizada antes de generar el documento.
- **FastAPI:** `api/` contiene la base de una API con endpoints de raíz y salud. Se reserva para necesidades concretas que lo justifiquen; no es obligatorio trasladar a FastAPI las operaciones que ya pueden resolverse con Supabase.
- **Esquema:** los scripts de cambios se versionan en `frontend/sql/`. `bd-completa.csv` y `bd-postgres.csv` son exportaciones locales de estructura; no prueban los registros ni el estado remoto actual. Antes de modificar la base, comprobar sus objetos y dependencias vigentes.

El navegador utiliza la clave pública de Supabase y la sesión del usuario. Las credenciales privilegiadas y contraseñas permanecen fuera del repositorio.

## 3. Casos de uso

| ID | Caso de uso | Actor |
|---|---|---|
| UC-01 | Registrar compra de ganado y costo inicial. | Administrador |
| UC-02 | Consultar trazabilidad completa del toro. | Administrador / Personal |
| UC-03 | Gestionar fincas, pertenencia y traslados de toros. | Administrador |
| UC-04 | Crear, consultar, modificar y desactivar toros. | Administrador |
| UC-05 | Registrar pesajes válidos. | Administrador / Personal |
| UC-06 | Consultar evolución de peso y GMD. | Administrador / Personal |
| UC-07 | Registrar sanidad, próximas aplicaciones y alertas. | Administrador / Personal |
| UC-08 | Gestionar catálogo de insumos. | Administrador |
| UC-09 | Registrar movimientos y consultar existencias e historial. | Administrador / Personal |
| UC-10 | Evaluar si conviene vender ahora. | Administrador |
| UC-11 | Gestionar tareas; el personal consulta y actualiza las suyas. | Administrador / Personal |
| UC-12 | Registrar venta, rentabilidad y cambio de estado. | Administrador |
| UC-13 | Registrar baja o mortalidad conservando historial. | Administrador / Personal |
| UC-14 | Iniciar/cerrar sesión, recuperar contraseña y aplicar permisos. | Administrador / Personal |
| UC-15 | Administrar cuentas del personal y sus roles. | Administrador |

Los 30 requisitos funcionales asociados a estos casos y los transversales RF-TR-01/02/03 se consultan en [bitacora.md](bitacora.md). Una pantalla existente no implica que el caso esté terminado.

## 4. Estado actual y trabajo siguiente

Existen flujos online de compras, fincas y miembros, toros, pesajes/GMD, sanidad, tareas, evaluación económica, ventas, bajas y autenticación. Su cobertura y validaciones pendientes están detalladas por requisito en la bitácora.

El catálogo, movimientos e historial de inventario están implementados. Su SQL fue aplicado en Supabase y el flujo administrador se comprobó con sesiones reales, incluyendo persistencia, saldo no negativo, concurrencia y paginación. El PDF de bodega ya utiliza datos reales y fechas inclusivas. Personal real y rechazo de acceso sin membresía ya están comprobados; la cuenta inactiva real sigue pendiente.

La evaluación económica y el registro de ventas/rentabilidad están implementados y validados. Las bajas se registran desde la ficha del toro con fecha y causa, conservando el historial; administrador y personal reales ya comprobaron el flujo en Chromium contra Supabase. El personal no recibe importes y el administrador puede completar la pérdida pendiente. Falta aceptar una cuenta inactiva real para bajas. La trazabilidad unificada todavía requiere desarrollo. El periodo de bodega no filtra las otras secciones del PDF.

La primera pasada de ordenamiento separó los servicios por dominio y añadió comentarios de requisitos en las funciones de entrada y descripciones en los helpers. La sesión se concentra en `AuthProvider`; los formularios liberan su estado de envío ante respuestas y excepciones, y el resultado inicial de Auth no puede sobrescribir un evento de sesión más reciente. El SQL de UC-14 ya fue aplicado en Supabase. Verifica cuentas activas y roles por finca; administrador real comprobado en 39 controles HTTP/Chromium, incluidos login, consultas, PDF, rechazos de acceso y cierre, sin escrituras de negocio. La aceptación adicional con PERSONAL_CAMPO real pasó 89 controles, incluyendo roles distintos por finca, capturas offline y revocación/restauración de membresía. Quedan pendientes cuenta inactiva real e inspección administrativa completa. La sesión revalida el perfil al entrar, recuperar conexión, enfocar y cada 30 segundos; una invalidación conserva las capturas pendientes. La capa offline compartida está implementada con IndexedDB y su SQL ya está aplicado en Supabase. La aceptación con administrador y personal reales pasó en Chromium; cuenta inactiva real y Safari/Firefox siguen pendientes.

## 5. Operación offline

Solo se permite capturar sin conexión **pesajes, aplicaciones sanitarias, movimientos de inventario y actualizaciones de tareas**. Las funciones administrativas, los reportes y las consultas centrales actualizadas requieren conexión.

La implementación utiliza Service Worker para los archivos del build e IndexedDB directo para dos almacenes: datos operativos y cola de capturas. Se eligió IndexedDB para mantener la solución simple; no se utiliza PGlite. `frontend/src/offline/runtime.ts` conecta los servicios existentes con la caché y el sincronizador compartido, sin interceptar globalmente las peticiones HTTP.

Se debe abrir la aplicación con conexión y esperar la preparación de datos de la finca seleccionada antes de salir al campo. La identidad previamente autenticada permite reabrir esos datos offline; se respeta Recordarme. No se permite un primer inicio de sesión sin conexión. El Service Worker se instala en builds de producción, no en `npm run dev`.

Cada captura conserva usuario, finca, identificador único y estado pendiente o rechazado. El sincronizador funciona desde todas las pantallas al recuperar conexión, al abrir/enfocar la aplicación y mediante reintentos mientras está abierta. La RPC `procesar_operacion_offline` valida cuenta, rol, finca y datos, y registra la operación y su confirmación en una transacción. Un reintento devuelve la confirmación original. `frontend/sql/rf_tr02_offline.sql` ya fue aplicado, con RLS en la tabla privada y permisos directos revocados.

El guardado local se distingue de la confirmación central. Los fallos de red conservan el pendiente; los rechazos quedan visibles para revisión y bloquean la cola hasta resolverlos. Una sesión inválida solicita autenticación sin borrar las capturas. Se impide cerrar sesión con capturas sin resolver; al cerrarla se limpian las copias del usuario. Los saldos offline son provisionales: Supabase puede rechazar movimientos por cambios concurrentes.

La cola antigua de pesajes en `localStorage` se conserva sin enviarla automáticamente, porque no identifica a su propietario. Debe revisarse manualmente. Las pruebas locales están en `frontend/tests/offline-browser.py` y `frontend/tests/offline-sql.py`; `frontend/tests/offline-live.py` prueba contra Supabase real. Pasaron 49 comprobaciones con administrador, incluyendo las cuatro capturas, reconexión, reintentos, concurrencia, sesión inválida y contenido del PDF. La prueba usa una finca QA aislada y conserva su historial al desactivarla. `frontend/tests/field-live.py` pasó 89 comprobaciones adicionales con personal real, las cuatro capturas, reapertura offline, reintentos, roles por finca y revocación/restauración de acceso. No miembro también comprobado; quedan cuenta inactiva real y Safari/Firefox. Ambas pruebas usan datos QA aislados y conservan el historial al desactivarlos.

## 6. Reglas de negocio

- Cada acceso y escritura debe respetar cuenta activa, rol y finca autorizada. Los roles desconocidos no conceden permisos administrativos.
- Los nombres de rol acordados son únicamente `ADMINISTRADOR` y `PERSONAL_CAMPO`. `frontend/sql/uc14_control_acceso.sql` consolida los nombres anteriores conservando membresías e invitaciones y restringe su recreación; ya fue aplicado en Supabase y los dos nombres canónicos están comprobados por HTTP. El frontend mantiene `admin`/`campo` como valores internos de presentación y caché, no como roles adicionales de la base.
- Correo, identificador interno del toro y DIIO/SENASA deben ser únicos cuando se registran. Actualmente el alta general permite DIIO vacío y compras lo exige; conservar esa distinción hasta acordar un cambio.
- Un toro pertenece a una sola finca activa a la vez. Asignaciones, retiros y traslados deben conservar finca de origen, destino y fecha; no se sustituye el historial por un cambio directo de pertenencia.
- Los pesajes son positivos y corresponden a toro y responsable válidos. La GMD se calcula como diferencia de peso dividida por los días entre pesajes; no se almacena como una copia independiente.
- La evaluación de venta exige al menos **8 fechas distintas con pesajes positivos dentro de los últimos 56 días**, incluyendo hoy. Usa peso actual, GMD de esa ventana, costos acumulados, mantenimiento diario y precio esperado/kg. Es rentable hoy si el ingreso esperado cubre compra, flete y mantenimiento desde ingreso. El administrador introduce mantenimiento diario y precio esperado; no se realizan proyecciones futuras ni se imputan costos sanitarios o de inventario sin vínculo histórico por toro.
- La compra conserva factura, origen, fechas y toros adquiridos. El costo inicial por toro es peso × precio/kg más transporte proporcional, con reparto exacto de centavos.
- Los movimientos de inventario usan cantidades positivas; entradas y ajustes positivos suman, salidas, consumos y ajustes negativos restan. El saldo se calcula desde movimientos y no puede quedar negativo al registrar una operación.
- Los movimientos confirmados de inventario son inmutables y se corrigen con ajustes. Con historial, no se cambia la unidad ni categoría de un insumo. Desactivar conserva saldo e historial y bloquea nuevos movimientos.
- Una venta o baja solo se registra sobre un toro activo que no haya sido vendido o dado de baja. El evento y el cambio de estado deben confirmarse en una transacción y conservar trazabilidad.
- Mortalidad y otras bajas usan únicamente el estado `BAJA`, con su causa. `VENDIDO` y `BAJA` cierran la operación del toro: no se permite reactivarlo ni intercambiar esos estados; su ficha e historial se conservan.
- La pérdida de una baja es compra + flete asignado + mantenimiento diario × días desde ingreso hasta la baja. Solo el administrador aporta y consulta importes; el personal registra fecha y causa. Sin mantenimiento o costos suficientes, la pérdida queda pendiente (`NULL`), sin convertir datos ausentes en cero. El administrador puede completar el cálculo y se conservan los costos utilizados, la fecha y su responsable; un importe final confirmado no se sobrescribe. Las bajas requieren conexión y no entran en la cola offline.
- Desactivar fincas, toros, insumos o usuarios no elimina su historial. Los registros necesarios para trazabilidad no deben borrarse físicamente.
- Una tarea pertenece a una finca y solo se asigna a un usuario válido con acceso. El personal consulta y actualiza únicamente las tareas asignadas a su cuenta, incluidas las copias locales; las tareas sin responsable quedan bajo administración. El administrador gestiona las tareas y los cambios deben conservar historial.
- Los PDF se generan para administradores y fincas autorizadas. Todas las descargas revalidan el acceso mediante la RPC de UC-14, también sin bodega; esta RPC ya está aplicada en Supabase y ambas descargas de PDF se comprobaron con administrador real. Cada ámbito debe respetar el periodo solicitado; actualmente esa selección está completa únicamente en bodega.

## 7. Requisitos no funcionales

Son objetivos de aceptación; su presencia aquí no significa que estén comprobados.

| ID | Prioridad | Requisito |
|---|---|---|
| RN-RE-01 | Alta | Las capturas almacenadas localmente responden en un máximo de 2 segundos. |
| RN-RE-02 | Media | La evaluación de venta se recalcula y muestra el resultado al solicitarla o modificar sus datos. |
| RN-UX-01 | Alta | Registrar un pesaje o aplicación sanitaria en móvil toma, en promedio, menos de 3 minutos. |
| RN-UX-02 | Alta | Alto contraste, tipografía legible y controles adecuados para luz solar directa. |
| RN-UX-03 | Media | Iconografía clara y confirmaciones visuales como alternativa a alertas sonoras. |
| RN-DA-01 | Alta | La PWA permite las cuatro capturas offline indicadas; las demás operaciones requieren internet. |
| RN-DA-02 | Media | Disponibilidad objetivo de 99,5 %, excluyendo mantenimientos; sujeta a monitoreo, sin garantía contractual del plan gratuito. |
| RN-CP-01 | Alta | Compatible con versiones modernas de Chrome, Safari, Firefox y Edge en móvil y escritorio. |
| RN-CP-02 | Alta | Interfaz adaptable a smartphones, tablets y monitores de escritorio. |
| RN-SP-01 | Alta | Comunicación con los servicios en la nube mediante HTTPS/TLS. |

## 8. Fuera de alcance

- IA, aprendizaje automático y predicciones de precios o pesos futuros.
- Captura automática desde básculas, sensores o IoT.
- Facturación electrónica ante Hacienda y comercio/subastas de ganado en línea.
- Integración directa con API de SENASA o Trazar-Agro.
- Aplicaciones nativas separadas y conexiones SQL directas desde el navegador.
- Captura offline de funciones administrativas o generación de reportes.

El desarrollo debe atender los IDs de la bitácora y conservar estas reglas. Una ampliación de alcance o cambio de arquitectura requiere acuerdo previo.
