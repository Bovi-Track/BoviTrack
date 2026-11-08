# Informe de pruebas

## BoviTrack

| Campo | Contenido |
| --- | --- |
| Título | Informe de pruebas de BoviTrack |
| Identificador | ITP-BOVITRACK-001 |
| Versión | 1.0 |
| Fecha | 8 de noviembre de 2026 |
| Proyecto | BoviTrack |
| Organización | Tecnológico de Costa Rica |
| Asignatura | Proyecto de Ingeniería de Software |
| Profesora | Alicia Marcela Salazar Hernández |
| Autores | Jimmy Feng Liu, Francisco Kuo Liu, Santiago Chaves Garbanzo |
| Plan aplicado | PTP-BOVITRACK-001, versión 1.1 |
| Documento base | ERS de BoviTrack, actualizada el 31 de octubre de 2026 |
| Conclusión de este ciclo | Informe cerrado. El producto no se declara aceptado respecto de la sección 3.1 del plan. |

Este informe registra lo que sí se ejecutó. No reescribe los resultados esperados del plan y no marca como superado un caso cuyo oráculo no se comprobó.

## 1. Conclusión

La suite automatizada pasó completa el 8 de noviembre de 2026: 81 pruebas del frontend y 2 de la API. Esa corrida cierra los oráculos de cálculo, de fechas, de saldo local, de cola y de varias reglas de interfaz.

La bitácora de requisitos, actualizada el 18 de octubre de 2026, aporta evidencia de sistema en Chromium contra Supabase para la mayoría de los requisitos funcionales. Esa evidencia usa fincas y cuentas de control de calidad, no la línea base del plan (`admin.norte@bovitrack.test`, BT-001, Finca Norte). Por eso esos casos quedan **observados en el requisito**, no reejecutados como fila del plan.

De las 110 filas del plan, 57 quedaron superadas, 47 observadas en Supabase con datos de control de calidad, 2 con desviación de texto y 4 bloqueadas. No hay aceptación del producto porque las filas observadas no se repitieron con la línea base del plan. Siguen abiertos los tiempos de CP-NFR-01 y CP-NFR-02, y el recorrido de CP-NFR-03 en Edge, Chrome y los tres tamaños de pantalla. Safari no está instalado en este Windows. La cola antigua de Firefox, en [bovitrack.pages.dev](https://bovitrack.pages.dev), devolvió `null`.

## 2. Entorno de lo ejecutado en este ciclo

| Dato | Valor registrado |
| --- | --- |
| Fecha de la suite | 8 de noviembre de 2026 |
| Comando | `npm test` en la raíz del repositorio |
| Resultado | 13 archivos de frontend, 81 pruebas, todas en verde. Después, 2 pruebas de API, ambas en verde. |
| Herramientas | Vitest 5.1.0, happy-dom, Python 3.12.6, FastAPI 0.115.11 |
| Sistema de la corrida | Windows 10 |
| Revisión del repositorio | `b7188db` |
| Zona horaria de la máquina | UTC−6, sin horario de verano, compatible con la fecha local de Costa Rica para la prueba de las 18:05 |
| Despliegue | [https://bovitrack.pages.dev](https://bovitrack.pages.dev). HTTP responde 301 hacia HTTPS. HTTPS responde 200. El servicio de datos es `https://gtrtomxqbahtsbdntcfn.supabase.co`. |
| Navegadores en este equipo | Firefox 159.0.1, usado en la revisión de la cola. Chrome 157.0.8103.38 y Edge 157.0.4341.42 están instalados y no se usaron para recorrer la PWA en este ciclo. Safari no está instalado. |
| Datos de la bitácora | Fincas QA y cuentas reales de administrador y de personal. Fecha de esa bitácora: 18 de octubre de 2026. |

## 3. Cómo leer el estado

| Estado | Significado |
| --- | --- |
| Superado | La suite del 8 de noviembre comprobó el oráculo de esa fila en el alcance que indica el resultado real. |
| Observado | La bitácora registró el requisito en Supabase y Chromium con otros datos. La fila del plan no se volvió a ejecutar. |
| Desviación | Hay un resultado, y el texto o la política no coinciden con la frase citada por el plan. |
| Bloqueado | Este ciclo no pudo ejecutar el oráculo. La causa queda escrita en la fila. |

Un caso superado en el cliente no certifica la transacción de PostgreSQL ni el rechazo por `auth.uid()`.

## 4. Resultados por caso

### 4.1 Autenticación y roles

| ID | Estado | Resultado real | Evidencia |
| --- | --- | --- | --- |
| CP-AUTH-01 | Observado | Administrador y personal iniciaron y cerraron sesión reales. La suite solo comprueba que, sin sesión, una ruta privada vuelve al inicio de sesión. | Bitácora RF-UC14-01. `cp-acceso-interfaz.test.tsx` |
| CP-AUTH-02 | Desviación | El cliente muestra «Correo, usuario o contraseña incorrectos». El plan cita «Credenciales incorrectas». No se repitió el usuario `nadie@bovitrack.test` contra Supabase. | DEF-01. `cp-roles-auth.test.ts` |
| CP-AUTH-03 | Superado | `abc12` no se acepta. La política vigente pide 8 caracteres, mayúscula, minúscula, número y símbolo. Ese mínimo cumple «al menos 6». | `passwordPolicy.ts`, `cp-roles-auth.test.ts` |
| CP-AUTH-04 | Observado | Una cuenta inactiva real fue rechazada. La sesión se revalida al entrar, al reconectar, al enfocar y cada 30 segundos. | Bitácora RF-UC14-01 |
| CP-AUTH-05 | Superado | El 8 de noviembre de 2026 Supabase envió el correo a `francisco.kuoliu@gmail.com`. El enlace devolvió una sesión de recuperación para esa cuenta, la contraseña se actualizó y el ingreso con la nueva respondió 200. Otra contraseña fue rechazada. El sitio publicado ya incluye la corrección que conserva el enlace y abre `/restablecer-contrasena` antes de que el enrutador borre la sesión. | Solicitud `recover` 200. `PUT /auth/v1/user` 200. `grant_type=password` 200 y 400. Paquete publicado `index-dO1Hcsqg.js`. |
| CP-AUTH-06 | Observado | El cierre de sesión se bloquea mientras hay capturas pendientes. | Bitácora RF-UC14-01 |
| CP-AUTH-07 | Superado | Cambiar de usuario local no borra la cola del anterior. La bitácora confirma que la reautenticación conserva capturas. No se contó en el servidor el pesaje de 480 kg de la fila. | `cp-cola-local.test.ts`. Bitácora RF-UC14-01 |
| CP-ROL-01 | Superado | Personal de Campo no entra a compras, ventas, reporte ni finca, y el menú oculta Finca. El rechazo financiero del servidor y la trazabilidad sin importes están en la bitácora. | `cp-acceso-interfaz.test.tsx`. Bitácora RF-UC14-03 y RF-UC02-01 |
| CP-ROL-02 | Observado | Los PDF quedaron reservados al administrador, también frente a una solicitud directa. | Bitácora RF-TR-03 y RF-UC14-03 |
| CP-ROL-03 | Observado | Consultas directas, columnas sensibles, RLS y grants no entregaron finanzas al personal. | Bitácora RF-UC14-03 |
| CP-ROL-04 | Observado | Al retirar la membresía, la captura no entra al servidor, se conserva y, si se restaura el permiso, el mismo identificador se envía una vez. | Bitácora RF-UC05-01 y RF-TR-02 |
| CP-ROL-05 | Observado | Sin membresía, interfaz y servidor rechazaron lectura, alta y movimientos. | Bitácora RF-UC08-01 y RF-UC14-03 |
| CP-ROL-06 | Observado | La misma cuenta tuvo roles distintos en dos fincas y el rol no se arrastró. La suite solo comprueba que el administrador abre la ruta de ventas. | Bitácora RF-UC14-03. `cp-acceso-interfaz.test.tsx` |
| CP-USR-01 | Observado | El administrador agregó un miembro por correo y el listado mostró la membresía de esa finca. | Bitácora RF-UC15-01 |
| CP-USR-02 | Observado | El retiro quitó solo la membresía de la finca administrada. La cuenta y las otras fincas siguieron activas. | Bitácora RF-UC15-01 |
| CP-USR-03 | Observado | El cambio de rol se revirtió y no modificó los roles de las demás fincas. | Bitácora RF-UC15-02 |
| CP-USR-04 | Observado | La autodemoción del administrador fue rechazada. | Bitácora RF-UC15-02 |
| CP-USR-05 | Observado | Personal de Campo no cambió roles por pantalla ni por RPC. | Bitácora RF-UC15-02 |
| CP-USR-06 | Superado | El cliente solo reconoce ADMINISTRADOR y PERSONAL_CAMPO. Un rol distinto queda como no reconocido. | `cp-roles-auth.test.ts` |

### 4.2 Compra, trazabilidad, fincas y toros

| ID | Estado | Resultado real | Evidencia |
| --- | --- | --- | --- |
| CP-COM-01 | Superado | Flete ₡45.000 sobre 420 kg y 380 kg a ₡1.850/kg: partes ₡23.625 y ₡21.375; costos iniciales ₡800.625 y ₡724.375. La suma del flete cierra. | `cp-compra.test.ts` |
| CP-COM-02 | Superado | Tres animales de 300 kg y flete ₡100,00: partes de 3333, 3333 y 3334 céntimos. La suma es ₡100,00. | `cp-compra.test.ts` |
| CP-COM-03 | Superado | El duplicado se informa como identificador o DIIO ya existente. En Supabase, una colisión real no dejó bovinos, pesajes ni asignaciones parciales. | `cp-compra.test.ts`. Bitácora RF-UC01-01 |
| CP-COM-04 | Superado | Un flete explícito de cero deja transporte 0 y costo inicial igual al peso por el precio. | `cp-compra.test.ts` |
| CP-COM-05 | Observado | La compra rechazada por identificador repetido no dejó filas parciales. | Bitácora RF-UC01-01 |
| CP-COM-06 | Superado | Sin conexión, la compra termina con error de internet y no entra a la cola. | `cp-operaciones-en-linea.test.ts` |
| CP-TRAZ-01 | Observado | La ficha real mostró compra, asignaciones, pesajes, sanidad, venta y baja en orden, sin inventar eventos. La suite solo comprueba que la consulta exige internet. | Bitácora RF-UC02-01. `cp-operaciones-en-linea.test.ts` |
| CP-TRAZ-02 | Observado | Personal de Campo vio la cronología sin campos financieros. | Bitácora RF-UC02-01 |
| CP-TRAZ-03 | Observado | No se reconstruyeron eventos que no existían en el expediente. | Bitácora RF-UC02-01 |
| CP-FINC-01 | Observado | Alta, consulta, edición y desactivación de finca quedaron persistidas. Desactivar una finca con un toro activo fue rechazado y ambos siguieron activos. La consulta de movimientos exige internet. | Bitácora RF-UC03-01. `cp-operaciones-en-linea.test.ts` |
| CP-FINC-02 | Observado | Nombre y ubicación editados se conservaron. La finca de prueba volvió a su estado, con historial. | Bitácora RF-UC03-01 |
| CP-FINC-03 | Observado | El alta general crea la asignación inicial y no duplica una compra. | Bitácora RF-UC03-02 |
| CP-FINC-04 | Observado | El retiro deja el toro inactivo en la última finca y conserva costos, pesajes y sanidad. | Bitácora RF-UC03-02 |
| CP-FINC-05 | Observado | El traslado exige administración en ambas fincas, conserva el estado activo y no deja dos asignaciones vigentes. | Bitácora RF-UC03-02 |
| CP-FINC-06 | Superado | Sin conexión, el traslado no se encola. En línea, el traslado real fue aceptado para el administrador y rechazado sin permiso. | `cp-operaciones-en-linea.test.ts`. Bitácora RF-UC03-02 |
| CP-BOV-01 | Observado | Alta, consulta y edición de identificador, nombre, raza y color persistieron. La desactivación conservó el expediente. La suite solo exige internet para el alta. | Bitácora RF-UC04-01 |
| CP-BOV-02 | Observado | El formulario no cambia estado ni finca. Un PATCH directo de estado o finca fue rechazado sin modificar el toro. | Bitácora RF-UC04-01 |
| CP-BOV-03 | Superado | Las etiquetas distinguen Vendido y Baja. La bitácora confirma que no hay reactivación ni intercambio entre esos estados. | `cp-reportes-dominio.test.ts`. Bitácora RF-UC04-01 |
| CP-BOV-04 | Observado | Personal de Campo no pudo dar de alta ni editar toros. | Bitácora RF-UC04-01 |
| CP-BOV-05 | Observado | Identificador o DIIO repetido rechaza el alta y no deja ficha parcial. | Bitácora RF-UC01-01 y RF-UC04-01 |
| CP-BOV-06 | Observado | Un toro activo queda en una sola finca. La segunda asignación sin traslado se rechaza. | Bitácora RF-UC03-02 |

### 4.3 Pesajes, GMD, sanidad, insumos e inventario

| ID | Estado | Resultado real | Evidencia |
| --- | --- | --- | --- |
| CP-PES-01 | Superado | Un pesaje de 485 kg queda en la cola a nombre del usuario de la sesión. En Supabase, administrador y personal persistieron pesajes con el responsable autenticado. El texto de éxito de la fila no se contrastó en pantalla en este ciclo. | `cp-captura-local.test.ts`. Bitácora RF-UC05-01 |
| CP-PES-02 | Desviación | Peso 0 y peso −10 se rechazan y no se guardan. El texto del cliente es de peso positivo y fecha válida, no «Error: El peso ingresado está fuera de rango». | DEF-02. `cp-pesajes-inventario.test.ts` |
| CP-PES-03 | Observado | Un pesaje fuera de la finca autorizada fue rechazado. Revocar la membresía impide la captura. | Bitácora RF-UC05-01 |
| CP-PES-04 | Observado | El responsable guardado es el usuario autenticado. | Bitácora RF-UC05-01 |
| CP-PES-05 | Superado | El mismo identificador no entra dos veces a la cola ni al historial local. En Supabase, el reintento y la respuesta perdida no duplicaron la fila. | `cp-pesajes-inventario.test.ts`, `cp-cola-local.test.ts`. Bitácora RF-UC05-01 y RF-TR-02 |
| CP-GMD-01 | Superado | De 400 kg el 2026-09-01 a 456 kg el 2026-09-29: 28 días y 2,00 kg/día. El punto medio dibujado en la gráfica no se midió con estas fechas; la bitácora vio la escala con otros intervalos. | `cp-gmd.test.ts`. Bitácora RF-UC06-02 |
| CP-GMD-02 | Superado | Dos capturas del mismo día no producen GMD. No hay división entre cero. | `cp-gmd.test.ts` |
| CP-GMD-03 | Superado | Un solo pesaje no calcula GMD. | `cp-gmd.test.ts` |
| CP-GMD-04 | Superado | Intervalos de 7 y 28 días conservan su GMD y la razón de duración es 4. La bitácora confirmó escala irregular en pantalla con intervalos de 2 y 10 días. | `cp-gmd.test.ts`. Bitácora RF-UC06-02 |
| CP-GMD-05 | Superado | La serie de un toro no incorpora los pesos de otro. | `cp-gmd.test.ts` |
| CP-SAN-01 | Superado | Las cuatro categorías se encolan con producto, dosis, fecha y usuario. En Supabase, personal real registró las cuatro y el borrado directo quedó protegido. | `cp-captura-local.test.ts`. Bitácora RF-UC07-01 |
| CP-SAN-02 | Superado | Una próxima aplicación igual o anterior a la fecha aplicada se rechaza antes de encolar. | `cp-captura-local.test.ts` |
| CP-SAN-03 | Observado | Producto inexistente y cuenta inactiva fueron rechazados en la RPC y en la sincronización. | Bitácora RF-UC07-01 |
| CP-SAN-04 | Superado | A las 18:05 la fecha operativa sigue siendo el día local, no el día siguiente en UTC. La pantalla de alertas con dos próximas aplicaciones no se abrió en este ciclo. La bitácora vio 13 alertas del día, ordenadas, con personal real. | `cp-offline-sanidad.test.ts`. Bitácora RF-UC07-02 |
| CP-INS-01 | Observado | Alta, consulta y desactivación del catálogo quedaron para el administrador. Personal de Campo recibió 403/42501. Sin conexión, el alta no se encola. | Bitácora RF-UC08-01. `cp-operaciones-en-linea.test.ts` |
| CP-INS-02 | Superado | El nombre duplicado se rechaza aunque el insumo anterior esté inactivo. La carrera de dos altas simultáneas de «Coquito Norte» no se lanzó en este ciclo. | `cp-pesajes-inventario.test.ts` |
| CP-INS-03 | Observado | Personal de Campo no creó ni desactivó insumos, y el catálogo de la finca de prueba quedó intacto. | Bitácora RF-UC08-01 |
| CP-INS-04 | Observado | El mismo nombre puede existir en otra finca. El rechazo por membresía no mezcló catálogos. | Bitácora RF-UC08-01 y RF-UC14-03 |
| CP-INV-01 | Superado | Entrada, consumo, salida y ajuste dejan el saldo previsto. Un consumo de 30 sobre 100 proyecta 70 y una sola operación. | `cp-pesajes-inventario.test.ts`, `cp-captura-local.test.ts` |
| CP-INV-02 | Superado | Cantidad no positiva se rechaza. Un consumo mayor que el stock no se encola. | `cp-pesajes-inventario.test.ts`, `cp-captura-local.test.ts` |
| CP-INV-03 | Superado | La misma proyección no descuenta dos veces. En Supabase, dos consumos concurrentes y el reintento dejaron un solo descuento. | `cp-pesajes-inventario.test.ts`. Bitácora RF-UC09-01 |
| CP-INV-04 | Superado | Un reporte cuyo saldo no cuadra con los movimientos se rechaza. | `cp-reportes-dominio.test.ts` |
| CP-INV-05 | Superado | Un movimiento de otra finca no cambia el saldo local. | `cp-pesajes-inventario.test.ts` |
| CP-INV-06 | Observado | Existencias, historial y paginación fueron consultados por personal autorizado y negados a quien no es miembro o está inactivo. | Bitácora RF-UC09-02 |

### 4.4 Evaluación, tareas, venta, baja y PDF

| ID | Estado | Resultado real | Evidencia |
| --- | --- | --- | --- |
| CP-VEN-01 | Superado | Siete fechas, incluida la de consulta, no alcanzan las ocho. | `cp-evaluacion-venta.test.ts` |
| CP-VEN-02 | Superado | Dos capturas del mismo día cuentan como una fecha. | `cp-evaluacion-venta.test.ts` |
| CP-VEN-03 | Superado | Un pesaje anterior a la ventana no cuenta. El día exacto, 56 días antes (2026-09-05 para una consulta del 2026-10-31), sí entra. | `cp-evaluacion-venta.test.ts` |
| CP-VEN-04 | Superado | Con las ocho fechas, 70 días desde el ingreso, costo diario ₡1.500 y precio ₡2.200/kg: GMD 1,00 kg/día, acumulado ₡945.000, ingreso ₡1.144.000 y margen ₡199.000. | `cp-evaluacion-venta.test.ts` |
| CP-VEN-05 | Superado | Con ₡1.700/kg el margen es −₡61.000. La venta de hoy no es rentable. | `cp-evaluacion-venta.test.ts` |
| CP-VEN-06 | Superado | Precio o costo diario vacíos no se toman como cero. Sin costos de compra no se fabrica una rentabilidad en cero. El acumulado no suma inventario ni sanidad. | `cp-evaluacion-venta.test.ts` |
| CP-VEN-07 | Superado | Un toro que no está activo no recibe sugerencia de venta. | `cp-evaluacion-venta.test.ts` |
| CP-TAR-01 | Observado | Edición, reasignación e historial de una tarea real se guardaron y se restauraron. Sin conexión, editar datos o leer el historial exige internet. | Bitácora RF-UC11-01. `cp-operaciones-en-linea.test.ts` |
| CP-TAR-02 | Observado | Personal de Campo no crea ni reasigna tareas. | Bitácora RF-UC11-01 y RF-UC11-02 |
| CP-TAR-03 | Superado | Personal de Campo solo ve las tareas cuyo asignado es él. | `cp-captura-local.test.ts` |
| CP-TAR-04 | Superado | El administrador ve las tareas de la finca. El personal no ve las ajenas ni las sin asignar. | `cp-captura-local.test.ts`. Bitácora RF-UC11-02 |
| CP-TAR-05 | Superado | El cambio de estado se proyecta una sola vez. En Supabase, la sincronización del estado no se duplicó. | `cp-offline-sanidad.test.ts`. Bitácora RF-UC11-02 |
| CP-VTA-01 | Superado | Venta del 2026-10-31, 520 kg a ₡2.200, 91 días y costo diario ₡1.500: mantenimiento ₡136.500 y rentabilidad ₡167.500. En Supabase la venta y el estado VENDIDO se guardaron en una transacción, con otros importes. | `cp-venta.test.ts`. Bitácora RF-UC12-02 |
| CP-VTA-02 | Superado | Un costo diario escrito en cero es válido y no resta mantenimiento. | `cp-venta.test.ts` |
| CP-VTA-03 | Superado | El costo diario vacío no se interpreta como cero: la vista previa no se arma. | `cp-venta.test.ts` |
| CP-VTA-04 | Superado | Sin costos de compra, el ingreso bruto se calcula y la rentabilidad queda no disponible. | `cp-venta.test.ts` |
| CP-VTA-05 | Observado | La RPC rechazó una segunda salida y no dejó venta y baja del mismo toro. | Bitácora RF-UC12-02 y RF-UC13-01 |
| CP-VTA-06 | Superado | Un peso de salida no positivo no arma la venta. | `cp-venta.test.ts` |
| CP-VTA-07 | Superado | Sin conexión, la venta no se encola. | `cp-operaciones-en-linea.test.ts` |
| CP-BAJ-01 | Observado | La baja guarda fecha, causa y estado BAJA. La pérdida usa compra, flete y mantenimiento; si falta la compra, el importe queda desconocido y el administrador puede completarlo. | Bitácora RF-UC13-01 |
| CP-BAJ-02 | Observado | Completar la pérdida pendiente exige conexión. El personal no recibe ese importe. | Bitácora RF-UC13-01. `cp-operaciones-en-linea.test.ts` |
| CP-BAJ-03 | Observado | Personal de Campo registró la baja sin importes. El administrador conservó la pérdida. Más de dos decimales se rechazó sin cambios parciales. | Bitácora RF-UC13-01 |
| CP-BAJ-04 | Observado | Vendido y baja son terminales. Una segunda salida fue rechazada. | Bitácora RF-UC04-01 y RF-UC13-01 |
| CP-BAJ-05 | Superado | Sin conexión, la baja no se encola. | `cp-operaciones-en-linea.test.ts` |
| CP-REP-01 | Superado | El periodo inclusivo se acepta. El PDF de prueba contiene las secciones, marca la compra ausente como no disponible y escribe la moneda como `CRC`. La bitácora confirma una descarga real con pesajes, una venta y una aplicación. El mensaje «Reporte PDF generado exitosamente» no se contrastó en este ciclo. | `cp-offline-sanidad.test.ts`, `cp-reportes-dominio.test.ts`. Bitácora RF-TR-03 |
| CP-REP-02 | Superado | Un periodo con la fecha inicial posterior a la final se rechaza. | `cp-offline-sanidad.test.ts` |
| CP-REP-03 | Superado | Un inventario vacío cuyo saldo cuadra se admite. La ausencia de registros no se trata como saldo inválido. | `cp-reportes-dominio.test.ts` |
| CP-REP-04 | Observado | Personal de Campo no descarga PDF. El servidor revalida al administrador antes de entregarlo. La suite comprueba que guardar el archivo exige internet. | Bitácora RF-TR-03. `cp-operaciones-en-linea.test.ts` |

### 4.5 Offline, integridad y atributos de calidad

| ID | Estado | Resultado real | Evidencia |
| --- | --- | --- | --- |
| CP-OFF-01 | Superado | Sin conexión se encolan pesaje, las cuatro categorías sanitarias, un consumo con stock suficiente y el filtro de tareas propias. La bitácora registró las cuatro capturas con administrador y personal reales. | `cp-captura-local.test.ts`. Bitácora RF-TR-01 |
| CP-OFF-02 | Superado | La cola sigue después de cerrar la base local. Otro usuario no la lee. Una captura de otra finca no altera la copia local. | `cp-cola-local.test.ts`, `cp-offline-sanidad.test.ts` |
| CP-OFF-03 | Superado | Al reconectar, el envío simulado ocurre una vez y un segundo ciclo no repite la llamada. La bitácora confirma reconexión real sin duplicados. El límite de 3 segundos de KPI-02 no se midió. | `cp-sincronizacion.test.ts`. Bitácora RF-TR-02 |
| CP-OFF-04 | Superado | Un rechazo se conserva con el motivo y no se reintenta en silencio. Confirmar una captura la aplica una vez y la saca de la cola. | `cp-sincronizacion.test.ts`, `cp-cola-local.test.ts` |
| CP-OFF-05 | Superado | Una sesión distinta no sincroniza la cola y la conserva. La bitácora cubre cuenta inactiva y membresía revocada. | `cp-sincronizacion.test.ts`. Bitácora RF-TR-02 |
| CP-OFF-06 | Superado | Compra, venta, baja, traslado, alta y edición de toro, tareas, insumos, PDF, trazabilidad y consulta de inventario exigen internet y no se encolan. | `cp-operaciones-en-linea.test.ts` |
| CP-OFF-07 | Observado | Cerrar y volver a abrir la PWA conservó la cola. Este ciclo cerró la base de la prueba, no apagó el dispositivo. | Bitácora RF-TR-01. `cp-cola-local.test.ts` |
| CP-OFF-08 | Superado | Sin usuario local no hay a quién atribuir la captura. El intento de login sin internet en el navegador no se repitió en este ciclo. | `cp-cola-local.test.ts` |
| CP-INT-01 | Bloqueado | No se inspeccionó el campo de credencial. Supabase Auth no entrega la contraseña ni su hash con la clave pública del proyecto. | Causa: sin acceso de inspección al almacén de credenciales. |
| CP-INT-02 | Observado | Correo, identificador interno y DIIO repetidos fueron rechazados en las pruebas de alta y de compra. | Bitácora RF-UC01-01, RF-UC04-01 y RF-UC15-01 |
| CP-INT-03 | Observado | Venta, baja y desactivación conservaron historial. No se reconstruyeron eventos inexistentes. | Bitácora RF-UC03-02, RF-UC12-02 y RF-UC13-01 |
| CP-INT-04 | Observado | Un toro no quedó a la vez vendido y de baja. La segunda salida fue rechazada. | Bitácora RF-UC13-01 |
| CP-INT-05 | Observado | Las consultas y los movimientos de una finca sin membresía fueron rechazados. Los datos de control de calidad no se mezclaron entre fincas. | Bitácora RF-UC14-03 y RF-UC08-01 |
| CP-NFR-01 | Bloqueado | La suite comprueba el resultado de la captura local, no el reloj. En este ciclo no se cronometró la confirmación en el dispositivo. | Causa: falta la medición de los 2 segundos. |
| CP-NFR-02 | Bloqueado | No se midió un registro de campo en el teléfono ni el contraste al sol con una persona distinta del equipo. | Causa: falta la prueba de usabilidad de los 3 minutos. |
| CP-NFR-03 | Bloqueado | Firefox 159.0.1 se usó para leer la cola. Chrome 157.0.8103.38 y Edge 157.0.4341.42 están instalados y no recorrieron la PWA. No se revisó la ficha en teléfono, tableta y escritorio. Safari no está instalado en este Windows. | Causa: el equipo no tiene Safari y este ciclo no recorrió Chrome, Edge ni los tres anchos. |
| CP-NFR-04 | Superado | `http://bovitrack.pages.dev` responde 301 hacia `https://bovitrack.pages.dev/`. HTTPS responde 200. La API usada por la PWA también está en HTTPS. | Cabeceras del 8 de noviembre de 2026. |
| CP-NFR-05 | Superado | Al pasar el precio de ₡2.200/kg a ₡1.700/kg, con el mismo costo diario, el resultado cambia del margen positivo de CP-VEN-04 al margen negativo de CP-VEN-05. La actualización visual en la pantalla de Inicio no se cronometró. | `cp-evaluacion-venta.test.ts` |

## 5. Defectos y pendientes

| ID | Severidad | Caso | Estado | Qué se observó |
| --- | --- | --- | --- | --- |
| DEF-01 | Menor | CP-AUTH-02 | Abierto | El texto de credenciales no es el citado por el plan. El acceso sí se niega. |
| DEF-02 | Menor | CP-PES-02 | Abierto | El peso no positivo se rechaza con otra frase. No entra al historial. |
| DEF-03 | Menor | CP-AUTH-05 | Cerrado | El correo, el cambio y el ingreso con la contraseña nueva se comprobaron el 8 de noviembre de 2026. Después de publicar, [bovitrack.pages.dev](https://bovitrack.pages.dev) sirve `index-dO1Hcsqg.js`, que conserva el enlace de recuperación y lo lleva a `/restablecer-contrasena` antes de cargar la aplicación. |
| DEF-04 | — | RF-TR-01, cola antigua | Cerrado en este Firefox | El 8 de noviembre de 2026, en Firefox y en bovitrack.pages.dev, `localStorage` de `bovitrack-pending-pesajes` devolvió `null`. No hay pesajes viejos que enviar ni descartar en ese perfil. Las capturas nuevas siguen aisladas por usuario. |

No se registran defectos de flete, de ventana de 56 días, de saldo negativo ni de duplicación en la suite de este ciclo.

## 6. Criterios de aceptación del plan

| Criterio de la sección 3.1 | Resultado de este ciclo |
| --- | --- |
| 1. Los casos de prioridad Alta cumplen su fila | No se certifica. Parte está superada por la suite y parte solo observada en la bitácora, con otros datos. |
| 2. No se materializa un criterio de rechazo de la ERS | En lo ejecutado no apareció flete que no cierra, ventana mal contada, saldo negativo, duplicado silencioso ni mezcla de fincas. No se recorrió otra vez cada criterio sobre la línea base del plan. |
| 3. Roles, aislamiento y Offline-First | Cumplidos en el alcance de la suite y de la bitácora. La cola antigua de este Firefox está vacía. |
| 4. Prioridad Media, o desviación escrita | El correo de recuperación, el cambio de contraseña y el ingreso con la nueva ya se comprobaron. La pantalla publicada ya conserva el enlace. PDF, alertas y existencias sí tienen evidencia. |
| 5. Sin defectos críticos o mayores abiertos en prioridad Alta | DEF-04 quedó cerrado para el Firefox revisado. No queda un defecto mayor abierto por esa cola. |

Cada fila de la matriz quedó superada, observada, con desviación o bloqueada, y cada bloqueo tiene su causa. Con eso el ciclo de este informe queda cerrado. La aceptación del producto sigue pendiente por los criterios 1 y 2 de la sección 3.1: las filas observadas usaron datos de control de calidad, no la línea base del plan.

## 7. Cierre

Este informe es el cierre del ciclo del 8 de noviembre de 2026. No queda una fila sin estado.

| Estado | Filas |
| --- | ---: |
| Superado | 57 |
| Observado | 47 |
| Desviación | 2 |
| Bloqueado | 4 |
| Total | 110 |

Los cuatro bloqueos son CP-INT-01, CP-NFR-01, CP-NFR-02 y CP-NFR-03. Una versión posterior puede levantarlos si se inspecciona el hash de la credencial, se cronometran los 2 segundos y los 3 minutos, y se recorre la PWA en Chrome, Edge y los tres anchos. Safari exige un iPhone o una Mac: en este Windows no está instalado.
