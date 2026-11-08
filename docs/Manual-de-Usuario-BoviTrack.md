# Manual de usuario de BoviTrack

**BoviTrack** es una aplicación web (PWA) para administrar fincas dedicadas al engorde de toros. Permite llevar el control de compras, pesajes, Ganancia Media Diaria (GMD), sanidad, insumos de bodega, tareas, ventas, bajas y trazabilidad de cada animal.

---

## Tabla de contenido

1. [Conceptos básicos](#1-conceptos-básicos)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Acceso a la aplicación](#3-acceso-a-la-aplicación)
4. [Navegación general](#4-navegación-general)
5. [Inicio](#5-inicio)
6. [Toros](#6-toros)
7. [Pesajes y GMD](#7-pesajes-y-gmd)
8. [Sanidad](#8-sanidad)
9. [Inventario (bodega)](#9-inventario-bodega)
10. [Tareas](#10-tareas)
11. [Compras de ganado (administrador)](#11-compras-de-ganado-administrador)
12. [Evaluación de venta (administrador)](#12-evaluación-de-venta-administrador)
13. [Ventas (administrador)](#13-ventas-administrador)
14. [Bajas y mortalidad](#14-bajas-y-mortalidad)
15. [Gestión de fincas y equipo (administrador)](#15-gestión-de-fincas-y-equipo-administrador)
16. [Reportes en PDF (administrador)](#16-reportes-en-pdf-administrador)
17. [Trabajo sin conexión (offline)](#17-trabajo-sin-conexión-offline)
18. [Ajustes y cierre de sesión](#18-ajustes-y-cierre-de-sesión)
19. [Reglas importantes del sistema](#19-reglas-importantes-del-sistema)
20. [Preguntas frecuentes y solución de problemas](#20-preguntas-frecuentes-y-solución-de-problemas)

---

## 1. Conceptos básicos

| Término | Significado |
|---|---|
| **Finca** | Unidad de trabajo. Cada toro, insumo, tarea y venta pertenece a una finca. |
| **Toro / bovino** | Animal registrado en el hato. Tiene identificador interno, DIIO-SENASA (opcional en el alta general) y un estado. |
| **DIIO-SENASA** | Número oficial de identificación del animal. |
| **GMD** | Ganancia Media Diaria: diferencia de peso dividida entre los días transcurridos entre pesajes (kg/día). |
| **Estados del toro** | `ACTIVO`, `INACTIVO`, `VENDIDO` y `BAJA`. |
| **Insumo** | Producto de bodega (alimento, suplemento, medicamento o vacuna). |

> Una cuenta puede tener **un rol distinto en cada finca**. Al iniciar sesión no se accede automáticamente a todas las fincas: solo a aquellas donde la cuenta sea miembro.

---

## 2. Roles y permisos

| Función | ADMINISTRADOR | PERSONAL_CAMPO |
|---|:---:|:---:|
| Consultar toros, pesajes y sanidad | ✅ | ✅ (solo fincas asignadas) |
| Registrar pesajes | ✅ | ✅ |
| Registrar aplicaciones sanitarias | ✅ | ✅ |
| Registrar movimientos de inventario | ✅ | ✅ |
| Registrar bajas (fecha y causa) | ✅ | ✅ |
| Consultar / actualizar tareas | ✅ (todas) | ✅ (solo las suyas) |
| Crear, editar y desactivar toros | ✅ | ❌ |
| Registrar compras | ✅ | ❌ |
| Gestionar catálogo de insumos | ✅ | ❌ |
| Evaluar venta y registrar ventas | ✅ | ❌ |
| Ver información financiera (costos, importes) | ✅ | ❌ |
| Gestionar fincas y equipo | ✅ | ❌ |
| Descargar reportes PDF | ✅ | ❌ |

Todas las cuentas activas pueden **crear sus propias fincas** y quedan como `ADMINISTRADOR` de ellas.

---

## 3. Acceso a la aplicación

### 3.1 Registrarse

1. Abre la aplicación y selecciona **Regístrate**.
2. Completa: **Nombre completo**, **Nombre de usuario**, **Correo electrónico**, **Contraseña** y **Confirmar contraseña**.
3. La contraseña debe cumplir las reglas que se muestran en pantalla:
   - Al menos 8 caracteres (máximo 72).
   - Una letra minúscula.
   - Una letra mayúscula.
   - Un número.
   - Un símbolo (por ejemplo `!@#$%`).
4. Confirma el registro.

### 3.2 Iniciar sesión

1. En **Inicia sesión en tu cuenta**, escribe tu **correo o nombre de usuario** y tu **contraseña**.
2. Puedes activar **Recordarme** para conservar la sesión en el dispositivo.
3. Solo pueden ingresar **cuentas activas**. El sistema revalida tu cuenta al entrar, al recuperar la conexión, al volver a la aplicación y cada 30 segundos.

> **Importante:** el primer inicio de sesión requiere conexión a internet. No es posible iniciar sesión por primera vez sin conexión.

### 3.3 Recuperar la contraseña

1. En la pantalla de inicio de sesión, selecciona la opción de contraseña olvidada.
2. Escribe tu correo y solicita el enlace de recuperación.
3. Abre el enlace recibido en tu correo y define una nueva contraseña que cumpla las reglas indicadas.

### 3.4 Unirse a una finca mediante invitación

Si un administrador te envió un **enlace de invitación**:

1. Abre el enlace; la aplicación mostrará *"Procesando invitación…"*.
2. Si no tienes sesión, inicia sesión o regístrate; la invitación se conserva y se aplica al ingresar.
3. Al finalizar, tendrás acceso a la finca con el rol indicado en la invitación.

Si ves **"Enlace inválido"**, solicita uno nuevo al administrador de la finca.

---

## 4. Navegación general

La barra inferior permite moverse entre las secciones principales:

| Sección | Disponible para |
|---|---|
| **Inicio** | Todos |
| **Toros** | Todos |
| **Pesajes** | Todos |
| **Inventario** | Todos (según rol en la finca) |
| **Finca** | Solo administradores |
| **Ajustes** | Todos |

Otras pantallas (**Compras**, **Tareas**, **Ventas**, **Reporte**) se abren desde accesos rápidos en **Inicio**.

Las pantallas administrativas (Finca, Compras, Reporte y Ventas) solo se muestran si en la finca seleccionada tienes el rol `ADMINISTRADOR`. En caso contrario aparece el mensaje *"Selecciona una finca donde tengas el rol ADMINISTRADOR para acceder."*

En la parte superior de la aplicación se muestra el **estado de conexión y sincronización** (ver [sección 17](#17-trabajo-sin-conexión-offline)).

---

## 5. Inicio

La pantalla de inicio resume el estado de la finca seleccionada:

- **Toros activos**
- **GMD global**
- **GMD semanal**
- **Alertas** (aplicaciones sanitarias pendientes)
- **Mis tareas del día**
- **Próximas dosis / tratamientos**
- **Evaluación de venta** (administrador)
- Tarjeta de **pesaje rápido**

### Accesos rápidos

| Acceso | Para qué sirve | Rol |
|---|---|---|
| Asignar y ver tareas / Tareas del equipo | Gestión de tareas | Admin / Personal |
| Movimiento de bodega | Registrar movimientos de inventario | Admin / Personal |
| Reporte semanal / PDF | Generar reportes | Administrador |
| Compras en subasta | Registrar compras de ganado | Administrador |
| Registrar y consultar ventas | Ventas y rentabilidad | Administrador |

### Seleccionar o crear una finca

Desde Inicio puedes cambiar la **finca activa** o **crear una nueva finca** (nombre y ubicación). Quien la crea queda como `ADMINISTRADOR`.

---

## 6. Toros

Pantalla con dos vistas principales: **Hato** y **Sanidad**. Incluye el filtro **Todos** y un buscador.

### 6.1 Agregar un toro (administrador)

1. Selecciona **Agregar toro**.
2. Completa los datos:
   - **Identificador interno** (obligatorio, único; ejemplo `T-014`).
   - **Número DIIO-SENASA** (opcional en el alta general; único si se registra).
   - **Nombre**, **Sexo** (Macho/Hembra), **Raza**, **Color** (opcionales).
   - **Fecha de nacimiento** (opcional) y **Fecha de ingreso**.
3. Puedes agregar varios toros en una misma operación; el título cambia a *"Agregar N toros"*.
4. Guarda. El sistema registra automáticamente la **asignación inicial** a la finca.

> Cuando el toro llega mediante una **compra**, el DIIO-SENASA sí es obligatorio (ver [sección 11](#11-compras-de-ganado-administrador)).

### 6.2 Ficha del toro

Al seleccionar un toro se abre su ficha, que reúne:

- **Datos básicos** (editables por el administrador: nombre, raza y color).
- **Curva de peso**: escala horizontal proporcional a los días reales entre pesajes.
- **Gráfica de GMD** por cada intervalo entre pesajes consecutivos (kg/día).
- **Historial de pesajes** y **sanidad**.
- **Trazabilidad / cronología completa**: compra, asignaciones, retiros, traslados, pesajes, aplicaciones sanitarias, venta y baja, en orden cronológico. El personal no ve importes.
- **Movimientos** (retirar, asignar, trasladar).
- **Baja e historial**.

> El **estado** no se edita directamente: cambia únicamente mediante movimientos, venta o baja.

### 6.3 Retirar, asignar y trasladar toros (administrador)

Desde la ficha del toro:

| Acción | Resultado |
|---|---|
| **Retirar** | El toro queda `INACTIVO` y se conserva su última finca como referencia. |
| **Asignar** | Un toro inactivo vuelve a `ACTIVO` en la misma finca u otra que administres. |
| **Trasladar** | Cambia la finca de un toro `ACTIVO` y mantiene su estado. |

Cada movimiento requiere **fecha**, **observaciones** y queda con su **responsable**.

Reglas:
- La fecha no puede ser **futura**, **anterior al ingreso** ni **anterior al último movimiento**.
- Debes ser administrador en la finca de origen y en la de destino (ambas activas).
- Los movimientos **requieren conexión**.
- El historial, costos, fecha de ingreso original, pesajes y sanidad se conservan siempre.

---

## 7. Pesajes y GMD

### 7.1 Registrar un pesaje

1. Ve a **Pesajes** y selecciona **Agregar pesaje** (también disponible desde la tarjeta de pesaje rápido en Inicio).
2. Completa:
   - **Bovino** (elige de la lista o usa el buscador por DIIO o identificador).
   - **Peso (kg)**: debe ser mayor que cero.
   - **Fecha**.
   - **Observaciones** (opcional; por ejemplo condición corporal o lote).
3. Guarda. El responsable queda registrado automáticamente con tu cuenta.

**Funciona sin conexión**: el pesaje se guarda localmente y se sincroniza al recuperar internet.

### 7.2 Cómo se calcula la GMD

```
GMD = (peso final − peso inicial) / días entre pesajes
```

- Se expresa en **kg/día**.
- Si dos pesajes tienen la misma fecha, ese intervalo se omite.
- Con datos insuficientes, la GMD no se calcula.
- La GMD no se almacena; se calcula siempre a partir de los pesajes.

---

## 8. Sanidad

Permite registrar **vacunación, desparasitación, vitaminización y tratamientos**.

### 8.1 Registrar una aplicación

1. En **Toros**, abre la vista **Sanidad** o la ficha del toro y selecciona **Registrar aplicación**.
2. Completa:
   - **Toro**
   - **Producto** (debe existir en el catálogo de insumos)
   - **Dosis** (ejemplo: `5 ml`)
   - **Fecha de aplicación**
   - **Próxima aplicación** (genera la alerta)
   - **Observaciones** (opcional: lote, vía de aplicación o reacción observada)
3. Guarda. El responsable queda registrado con tu cuenta.

**Funciona sin conexión.**

### 8.2 Alertas y próximas aplicaciones

Las aplicaciones programadas aparecen en **Inicio** como **Próximas dosis / tratamientos**, y el contador **Alertas** indica cuántas hay pendientes.

---

## 9. Inventario (bodega)

Gestiona los insumos de la finca. Muestra las existencias y el historial por insumo. Puedes filtrar por **Activos**, **Inactivos** o **Todos**.

### 9.1 Catálogo de insumos (administrador)

- **Agregar** un insumo: **Nombre**, **Categoría** (`ALIMENTO`, `SUPLEMENTO`, `MEDICAMENTO`, `VACUNA`) y **Unidad**.
- **Editar** un insumo.
- **Desactivar** un insumo: conserva saldo e historial, pero ya no admite nuevos movimientos.

> Si un insumo ya tiene historial, no se puede cambiar su unidad ni su categoría.

### 9.2 Registrar un movimiento

1. En el insumo, selecciona **Registrar movimiento**.
2. Elige el **tipo de movimiento**:

| Tipo | Efecto en el saldo |
|---|---|
| `ENTRADA` | Suma |
| `AJUSTE_POSITIVO` | Suma |
| `SALIDA` | Resta |
| `CONSUMO` | Resta |
| `AJUSTE_NEGATIVO` | Resta |

3. Indica **cantidad** (siempre positiva), **Fecha del movimiento** y **Observaciones** (opcional).
4. Guarda.

Reglas:
- El **saldo nunca puede quedar negativo**.
- Los movimientos confirmados **no se editan ni se borran**: se corrigen registrando un ajuste.
- Con conexión, el servidor valida el saldo en el momento. Sin conexión, el saldo mostrado es **provisional** y Supabase podría rechazar el movimiento si hubo cambios concurrentes.

### 9.3 Consultar historial

Usa **Ver historial** en cada insumo. El historial está paginado y puede refrescarse con **Actualizar historial**.

**Los movimientos de inventario funcionan sin conexión.** La gestión del catálogo requiere conexión.

---

## 10. Tareas

### 10.1 Administrador

1. Ve a **Tareas** y crea una tarea:
   - **Tarea** (título, por ejemplo *"Vacunar el lote norte"*).
   - **Detalle** (opcional).
   - **Asignar a** un miembro de la finca o **Toda la finca**.
   - **Fecha límite**.
2. Puedes **editar** la tarea, **reasignarla** y consultar su **historial** de cambios.
3. Usa el buscador (título, detalle o persona) y el filtro **Del equipo**.

### 10.2 Personal de campo

- Consulta únicamente **las tareas asignadas a tu cuenta**.
- Actualiza su **estado** (incluso sin conexión; se sincroniza al reconectar).
- Las tareas sin responsable quedan bajo administración.

---

## 11. Compras de ganado (administrador)

Ruta: acceso **Compras en subasta** desde Inicio. Selecciona primero una finca administrada.

### 11.1 Registrar una compra

1. Completa **Datos de la compra**:
   - **Número de factura**
   - **Fecha de compra**
   - **ID de subasta** y/o **Proveedor** (indica al menos uno)
   - **Flete total (₡)**
2. En **Bovinos adquiridos**, agrega cada animal con:
   - **Sexo**, **Número DIIO-SENASA** (obligatorio), **Identificador interno**
   - **Peso de compra (kg)** y **Precio por kilo (₡)** (corresponden a cada animal)
   - **Fecha de ingreso** (si se deja vacía, se usa la fecha de compra)
   - Opcionales: **fecha de nacimiento**, **nombre**, **raza**, **color**
3. Usa **Quitar** para eliminar un animal de la lista.
4. Revisa el **Resumen estimado**: cantidad de bovinos, peso total, peso × precio/kg, flete prorrateado y costo inicial total.
5. Guarda. Se mostrará **Compra registrada** con el resumen y los bovinos registrados.

### 11.2 Cálculo del costo inicial

```
Costo inicial por toro = (peso × precio por kg) + flete proporcional
```

El flete se reparte entre los toros de la compra y los centavos se distribuyen exactamente, sin pérdida.

La operación es **atómica**: si el DIIO está duplicado o hay un error, no queda ningún dato parcial.

---

## 12. Evaluación de venta (administrador)

Ubicada en **Inicio**, responde si **conviene vender hoy** un toro.

### 12.1 Cómo usarla

1. Selecciona el toro.
2. Ingresa:
   - **Precio esperado (CRC/kg)**
   - **Alimentación y otros cuidados (CRC/toro/día)**
3. Consulta el resultado.

### 12.2 Requisitos

El toro debe tener **al menos 8 fechas distintas con pesajes positivos dentro de los últimos 56 días** (incluyendo hoy). Si no los tiene, aparece **"Faltan pesajes"** y no se emite sugerencia.

### 12.3 Resultados que muestra

- **Peso actual**
- **GMD 56 días**
- **Pesajes válidos** usados
- **Compra + flete**
- **Alimentación y cuidados** acumulados
- **Costo acumulado**
- **Equilibrio** (precio mínimo por kg para cubrir costos)
- **Esperado** (precio que ingresaste)
- **Margen estimado hoy**
- Gráfica comparativa: **Costos acumulados** vs **Ingreso al precio esperado**

### 12.4 Posibles decisiones

| Mensaje | Significado |
|---|---|
| **Rentable hoy** | El ingreso esperado cubre compra, flete y mantenimiento. |
| **No rentable hoy** | El ingreso esperado no cubre los costos acumulados. |
| **Faltan pesajes** | No hay suficientes pesajes válidos. |
| **Completa los parámetros** | Falta precio esperado o mantenimiento diario. |
| **Faltan costos de compra** | El toro no tiene costos de compra registrados. |

> La evaluación **no hace proyecciones futuras** ni incluye costos sanitarios o de inventario por toro.

---

## 13. Ventas (administrador)

### 13.1 Registrar una venta

1. Ve a **Ventas** → **Registrar venta**.
2. Completa:
   - **Toro** (solo toros activos)
   - **Fecha de venta**
   - **Peso de salida (kg)**
   - **Precio de venta (CRC/kg)**
   - **Alimentación y otros cuidados (CRC/toro/día)**
   - **Comprador o canal**
3. Revisa la **Vista previa de rentabilidad**: ingreso bruto, costo de compra y rentabilidad final.
4. Confirma en **Confirmar venta**.

```
Rentabilidad = ingreso bruto − compra − flete − mantenimiento desde el ingreso
```

Reglas:
- Si falta compra, precio/kg o pesaje inicial, la venta se registra igualmente, pero la rentabilidad queda **no disponible** (no se inventa un valor).
- Al confirmar, el toro pasa a `VENDIDO` en la misma transacción, y **no puede reactivarse**.
- Si la finca está inactiva, solo se puede consultar el historial.

El **Historial de ventas** muestra todas las ventas cerradas.

---

## 14. Bajas y mortalidad

Disponible para **administrador y personal de campo**, desde la sección **Baja e historial** de la ficha del toro.

### 14.1 Registrar una baja

1. Abre la ficha del toro y selecciona **Registrar baja**.
2. Indica **fecha** y **causa**.
3. Confirma.

Resultados:
- El toro pasa a estado `BAJA` (estado único para mortalidad y otras bajas).
- No puede reactivarse ni cambiarse a `VENDIDO`.
- Su ficha e historial se conservan.

### 14.2 Pérdida económica

```
Pérdida = compra + flete asignado + (mantenimiento diario × días desde el ingreso hasta la baja)
```

- **El personal no ve ni ingresa importes**; solo registra fecha y causa.
- Si faltan datos (mantenimiento o costos), la pérdida queda **pendiente** (no se convierte en cero).
- El **administrador** puede completar el cálculo después. Un importe final ya confirmado no se sobrescribe.

> Las bajas **requieren conexión**: no se pueden capturar sin internet.

---

## 15. Gestión de fincas y equipo (administrador)

Ruta: **Finca** en la barra inferior.

### 15.1 Fincas

- **Crear** una finca (nombre, ubicación).
- **Editar** nombre y ubicación.
- **Desactivar** una finca: conserva todo su historial. No se puede desactivar si tiene **toros activos**; el sistema indica el motivo.

### 15.2 Equipo

En la sección de miembros puedes:

**Agregar una cuenta ya registrada**
1. Escribe el **correo** de la cuenta.
2. Elige el rol: `ADMINISTRADOR` o `PERSONAL_CAMPO`.
3. Agrégala.

**Invitar por enlace**
1. Cambia a la pestaña de enlace.
2. Elige el rol que tendrá quien use la invitación.
3. Genera el enlace y **cópialo** para compartirlo.

**Cambiar el rol de un miembro**
- Selecciona el nuevo rol en el listado y guarda. El cambio aplica **solo a esa finca**.
- No puedes cambiar tu propio rol (evita la autodemoción del administrador).

**Retirar un miembro**
- Quita a la persona de la finca; su historial se conserva.

---

## 16. Reportes en PDF (administrador)

Ruta: **Reporte semanal / PDF** desde Inicio.

### 16.1 Generar un PDF

1. Indica el **Periodo del reporte**: **Desde** y **Hasta** (ambas fechas se incluyen).
2. Marca las secciones a incluir:

| Sección | Contenido |
|---|---|
| **Reporte semanal** | Peso, GMD semanal de los sábados y estructura del hato. |
| **Resumen de la finca** | Toros activos, GMD global y alertas pendientes. |
| **Inventario de toros** | Bovinos con DIIO, raza, sexo y estado. |
| **Historial de pesajes** | Peso y fecha de cada registro. |
| **Inventario de bodega** | Existencias e insumos (solo administradores). |

El PDF también incluye, según el periodo: pesajes/GMD, **ventas cerradas** (ingreso bruto, costos y rentabilidad) e **historial sanitario** (producto, dosis, fecha, próxima aplicación y responsable).

3. Selecciona **Guardar PDF** y elige la ubicación de descarga.

Notas:
- Las fechas invertidas (Desde posterior a Hasta) se rechazan.
- Si no se pudo cargar toda la información, **no se descarga un reporte incompleto**; actualiza la página e inténtalo de nuevo.
- Los reportes requieren conexión y revalidan tu acceso antes de generarse.

---

## 17. Trabajo sin conexión (offline)

BoviTrack funciona como PWA y permite **capturar en el campo sin internet**, solo estas cuatro operaciones:

| Captura offline permitida |
|---|
| ✅ Pesajes |
| ✅ Aplicaciones sanitarias |
| ✅ Movimientos de inventario |
| ✅ Actualización de tareas |

Todo lo demás (compras, ventas, bajas, movimientos de toros, gestión de fincas y equipo, evaluación de venta y reportes) **requiere conexión**.

### 17.1 Antes de salir al campo

1. Abre la aplicación **con conexión a internet**.
2. Selecciona la finca en la que vas a trabajar.
3. **Espera a que termine la preparación de datos** de esa finca (indicador de estado en la parte superior).
4. Ya puedes salir al campo: podrás reabrir la aplicación y capturar sin conexión.

### 17.2 Durante el trabajo sin conexión

- Cada captura se guarda en tu dispositivo con tu usuario, finca, un identificador único y estado **pendiente**.
- El indicador superior distingue entre **guardado local** y **confirmado en el servidor**.

### 17.3 Al recuperar la conexión

- La sincronización es **automática**: al reconectar, al abrir o enfocar la aplicación y mediante reintentos periódicos.
- Un reintento **no duplica** información.
- Si hay un **fallo de red**, la captura sigue pendiente.
- Si el servidor **rechaza** una captura (por ejemplo, saldo insuficiente por cambios concurrentes, pérdida de acceso a la finca o toro trasladado a otra finca), queda **visible para revisión** y **bloquea la cola** hasta que se resuelva.
- Si tu sesión se invalida, se solicita autenticarte de nuevo **sin perder** las capturas pendientes.

### 17.4 Consideraciones

- **No puedes cerrar sesión** mientras haya capturas sin resolver. Al cerrar sesión se eliminan las copias locales de tu usuario.
- El Service Worker se instala en la versión de producción de la aplicación.
- Usa navegadores modernos (Chrome, Edge, Safari, Firefox).
- Si existía una **cola antigua de pesajes** (de versiones previas), no se envía automáticamente porque no identifica a su propietario; debe revisarse manualmente.

---

## 18. Ajustes y cierre de sesión

En **Ajustes** puedes ver tu identidad, la finca activa y tu **rol en esa finca**.

Para salir selecciona **Cerrar sesión**. Si hay capturas offline pendientes de sincronizar, el sistema lo impedirá hasta que se resuelvan.

---

## 19. Reglas importantes del sistema

- **Cuenta activa y finca autorizada**: toda acción valida tu cuenta, tu rol y la finca.
- **Unicidad**: correo, identificador interno del toro y DIIO-SENASA no pueden repetirse.
- **Un toro, una finca activa** a la vez; los movimientos conservan origen, destino y fecha.
- **No hay borrado físico** de fincas, toros, insumos ni usuarios con historial: se **desactivan**.
- **Estados finales**: `VENDIDO` y `BAJA` cierran la operación del toro; no hay reactivación.
- **Pesajes**: siempre positivos y asociados a un toro y a un responsable válidos.
- **Inventario**: cantidades positivas, saldo nunca negativo y movimientos inmutables (se corrigen con ajustes).
- **Información financiera**: solo visible para administradores.
- **Datos ausentes**: nunca se convierten en cero; los cálculos quedan como no disponibles o pendientes.

---

## 20. Preguntas frecuentes y solución de problemas

**No puedo iniciar sesión.**
Verifica correo/usuario y contraseña. Si tu cuenta fue desactivada, contacta al administrador. Recuerda que el primer inicio de sesión necesita internet.

**No veo la sección Finca, Compras, Ventas o Reporte.**
Estas secciones son solo para `ADMINISTRADOR`. Verifica tu rol en la finca seleccionada (Ajustes) o cambia de finca.

**No veo mi finca / aparece "No se pudo verificar tu acceso a las fincas".**
Usa **Reintentar**. Si persiste, es posible que no seas miembro de esa finca; pide a un administrador que te agregue.

**La evaluación de venta dice "Faltan pesajes".**
El toro necesita al menos 8 fechas distintas con peso en los últimos 56 días. Registra más pesajes.

**Un registro offline aparece como rechazado.**
Revisa el motivo mostrado. Causas frecuentes: saldo insuficiente de un insumo por cambios concurrentes, pérdida de membresía en la finca, o toro movido a otra finca. Corrige o descarta la captura para desbloquear la cola.

**No puedo cerrar sesión.**
Tienes capturas offline sin sincronizar. Conéctate a internet y espera a que se confirmen o resuélvelas.

**No puedo desactivar una finca.**
Aún tiene toros activos. Retira o traslada los toros primero.

**Ingresé un movimiento de inventario por error.**
Los movimientos confirmados no se editan. Registra un **ajuste positivo o negativo** para corregir el saldo.

**El PDF no se descarga.**
Verifica que las fechas sean válidas (Desde ≤ Hasta), que haya conexión y que hayas seleccionado al menos una sección.

---

*Manual elaborado a partir de la documentación y el código del repositorio BoviTrack. Algunas funciones pueden evolucionar; consulta `bitacora.md` y `Contexto-Desarrollo-BoviTrack.md` del repositorio para conocer el estado vigente de cada requisito.*
