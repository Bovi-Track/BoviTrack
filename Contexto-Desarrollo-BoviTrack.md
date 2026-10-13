# Contexto de desarrollo de BoviTrack

Actualizado: 2026-10-12.

Este documento define el propósito, la arquitectura, los actores y las reglas del proyecto. Los requisitos funcionales, sus porcentajes y pendientes se mantienen en [bitacora.md](bitacora.md).

## 1. Propósito y actores

BoviTrack administra fincas dedicadas al engorde de toros: compras, asignaciones y traslados, pesajes, Ganancia Media Diaria (GMD), sanidad, insumos, tareas, ventas, bajas y trazabilidad. La evaluación de venta determina si conviene vender en el momento de la consulta.

| Actor | Alcance autorizado |
|---|---|
| Administrador de Finca | Administra sus fincas, toros, compras, catálogo, tareas, usuarios, ventas, evaluaciones y reportes. Consulta información operativa y financiera. |
| Personal de Campo | Opera únicamente en fincas asignadas. Consulta toros, pesajes y sanidad; registra pesajes, aplicaciones sanitarias, movimientos de inventario y bajas; consulta y actualiza sus tareas. No administra cuentas, catálogo ni fincas y no accede a información financiera. |

Un usuario puede tener un rol distinto en cada finca. La sesión autenticada no concede por sí sola acceso a todas las fincas.

## 2. Arquitectura vigente

- **Frontend:** React, TypeScript y Vite, con Tailwind CSS. Interfaz móvil y de escritorio; Cloudflare Pages es el despliegue previsto. La capacidad PWA/offline todavía debe completarse.
- **Autenticación:** Supabase Auth administra credenciales, sesión y JWT. El cliente compartido está en `frontend/src/lib/supabase.ts`; `AuthProvider` expone el usuario y `FarmContext` la finca y sus roles. El manejo de sesión entre módulos todavía necesita estandarización.
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

Existen flujos online de compras, fincas y miembros, toros, pesajes/GMD, sanidad, tareas y autenticación. Su cobertura y validaciones pendientes están detalladas por requisito en la bitácora.

El catálogo, movimientos e historial de inventario están implementados. Su SQL fue aplicado en Supabase y el flujo administrador se comprobó con sesiones reales, incluyendo persistencia, saldo no negativo, concurrencia y paginación. El PDF de bodega ya utiliza datos reales y fechas inclusivas. Las sesiones reales de personal, cuenta inactiva y no miembro siguen pendientes de aceptación.

La evaluación económica completa de venta, el registro de ventas/bajas y la trazabilidad unificada todavía requieren desarrollo. El periodo de bodega no filtra las otras secciones del PDF.

El siguiente ordenamiento acordado es identificar en el código dónde vive cada requisito, estandarizar sesión y permisos, y completar la capa offline. Es trabajo pendiente; actualizar documentos no implementa esos cambios.

## 5. Operación offline prevista

Solo se permite capturar sin conexión **pesajes, aplicaciones sanitarias, movimientos de inventario y actualizaciones de tareas**. Las funciones administrativas, los reportes y las consultas centrales actualizadas requieren conexión.

El diseño previsto utiliza Service Worker y caché de aplicación/datos para reabrir la PWA sin conexión, y PGlite sobre IndexedDB para los datos operativos y la cola persistente. Actualmente solo hay una cola de pesajes en `localStorage`; no existe aún la capa offline completa.

Cada operación debe conservar su usuario, finca, identificador único y estado pendiente. Al recuperar conexión o reabrir la aplicación, se sincroniza con Supabase mediante una operación central que valide sesión, permisos y datos, y procese ese identificador de forma idempotente. Una operación ya procesada debe confirmarse sin duplicarla.

La captura local solo se marca sincronizada después de recibir confirmación central. Los fallos conservan la operación para reintentar; una sesión inválida exige autenticación antes de sincronizar. Al cerrar completamente sesión se limpian sus datos locales, sin mezclarlos con los de otro usuario.

## 6. Reglas de negocio

- Cada acceso y escritura debe respetar cuenta activa, rol y finca autorizada. Los roles desconocidos no conceden permisos administrativos.
- Se reconocen explícitamente `ADMINISTRADOR` / `Administrador de Finca` y `PERSONAL_CAMPO` / `Personal de Campo`. Existen comprobaciones antiguas con nombres distintos entre módulos que deben unificarse.
- Correo, identificador interno del toro y DIIO/SENASA deben ser únicos cuando se registran. Actualmente el alta general permite DIIO vacío y compras lo exige; conservar esa distinción hasta acordar un cambio.
- Un toro pertenece a una sola finca activa a la vez. Asignaciones, retiros y traslados deben conservar finca de origen, destino y fecha; no se sustituye el historial por un cambio directo de pertenencia.
- Los pesajes son positivos y corresponden a toro y responsable válidos. La GMD se calcula como diferencia de peso dividida por los días entre pesajes; no se almacena como una copia independiente.
- La evaluación de venta exige al menos **8 pesajes válidos en 56 días**. Usa peso actual, GMD reciente, costos acumulados, mantenimiento diario y precio esperado/kg. No realiza proyecciones futuras; el criterio económico y la ventana reciente todavía deben concretarse.
- La compra conserva factura, origen, fechas y toros adquiridos. El costo inicial por toro es peso × precio/kg más transporte proporcional, con reparto exacto de centavos.
- Los movimientos de inventario usan cantidades positivas; entradas y ajustes positivos suman, salidas, consumos y ajustes negativos restan. El saldo se calcula desde movimientos y no puede quedar negativo al registrar una operación.
- Los movimientos confirmados de inventario son inmutables y se corrigen con ajustes. Con historial, no se cambia la unidad ni categoría de un insumo. Desactivar conserva saldo e historial y bloquea nuevos movimientos.
- Una venta o baja solo se registra sobre un toro activo que no haya sido vendido o dado de baja. El evento y el cambio de estado deben confirmarse en una transacción y conservar trazabilidad.
- Desactivar fincas, toros, insumos o usuarios no elimina su historial. Los registros necesarios para trazabilidad no deben borrarse físicamente.
- Una tarea pertenece a una finca y solo se asigna a un usuario válido con acceso. El administrador la gestiona; el personal actualiza las tareas autorizadas. Los cambios deben conservar historial.
- Los PDF se generan para administradores y fincas autorizadas. Cada ámbito debe respetar el periodo solicitado; actualmente esa selección está completa únicamente en bodega.

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
