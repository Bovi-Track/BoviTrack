# Bitácora de requisitos funcionales — BoviTrack

Actualizada: 2026-10-18. Los porcentajes son estimaciones; 100 % significa que el requisito está implementado y validado.

Cada tarea debe indicar qué requisito atiende. Al completarla, actualizar su avance y lo que falta, sin ampliar el alcance del requisito.

Las funciones de entrada indican sus requisitos en comentarios; los helpers describen su operación. Las implementaciones parciales y desviaciones se señalan explícitamente.

| ID | Requisito funcional | Avance | Qué falta |
|---|---|---:|---|
| RF-UC01-01 | Registrar compras: subasta/proveedor, factura, fecha, peso, precio/kg, transporte y toros adquiridos. | 85 % | Unificar el rol administrador en compras y verificar en Supabase la compra completa, el pesaje inicial, la asignación y la reversión ante errores. |
| RF-UC01-02 | Calcular costo inicial por toro: peso × precio/kg + transporte proporcional. | 90 % | Validar el reparto exacto del flete, incluidos centavos, y la persistencia de los costos en una compra real. |
| RF-UC02-01 | Consultar trazabilidad completa y cronológica del toro. | 35 % | Integrar compra, asignaciones, retiros, traslados, venta y baja con los pesajes y la sanidad existentes. |
| RF-UC03-01 | Administrador: crear, consultar, modificar y desactivar fincas. | 85 % | Resolver la desactivación de fincas con toros activos; versionar y verificar las RPC y sus permisos. |
| RF-UC03-02 | Agregar, retirar y trasladar toros conservando historial. | 20 % | Implementar retiro/traslado con origen, destino y fecha; validar ambas fincas y mantener una sola pertenencia activa por toro. |
| RF-UC04-01 | Administrador: crear, consultar, modificar y desactivar toros con identificadores, datos básicos y estado. | 70 % | Permitir desactivar toros activos; verificar permisos e impedir marcar vendido/baja/muerto sin registrar el evento de UC-12/13. |
| RF-UC05-01 | Registrar peso y fecha; validar peso positivo, toro y responsable; conservar historial. | 90 % | Probar captura y consulta con personal de campo y rechazos con cuenta inactiva/no miembro. Administrador ya comprobado en Supabase: peso positivo, responsable real, persistencia e idempotencia. |
| RF-UC06-01 | Calcular variación de peso y GMD a partir de pesajes. | 100 % | Ninguno detectado: cálculo y casos de datos insuficientes/fechas iguales comprobados. |
| RF-UC06-02 | Mostrar historial y gráficas de peso y GMD. | 75 % | Añadir gráfica de GMD y representar los intervalos reales entre fechas en la curva de peso. |
| RF-UC07-01 | Registrar vacunas, desparasitantes, vitaminas y tratamientos con producto, dosis, fecha y responsable. | 75 % | Verificar categorías/productos de la RPC, responsable autenticado y conservación del historial en Supabase. |
| RF-UC07-02 | Mostrar próximas aplicaciones sanitarias y alertas. | 90 % | Comprobar que Inicio cubra todas las aplicaciones pendientes, también cuando haya más de 12 registros. |
| RF-UC08-01 | Administrador: crear, consultar, modificar y desactivar insumos del catálogo. | 95 % | Validar en Supabase los rechazos para personal, cuenta inactiva y otra finca. El flujo administrador ya está probado. |
| RF-UC09-01 | Registrar entradas, salidas, consumos y ajustes con cantidades positivas y sin saldo negativo. | 95 % | Probar movimientos con sesión real de personal y rechazos de cuenta inactiva/no miembro. Saldo y concurrencia ya están probados con administrador. |
| RF-UC09-02 | Consultar existencias e historial completo por insumo. | 95 % | Validar consultas con sesiones reales de personal, cuenta inactiva y no miembro; paginación y persistencia ya están probadas. |
| RF-UC10-01 | Exigir al menos 8 pesajes válidos distribuidos en 56 días para evaluar venta. | 0 % | Implementar ambos mínimos y bloquear la evaluación cuando no se cumplan. |
| RF-UC10-02 | Administrador: evaluar venta actual con peso, GMD reciente, costos acumulados, mantenimiento diario y precio esperado/kg. | 20 % | Definir criterio económico y ventana de GMD reciente; incorporar todos los costos y el precio esperado. |
| RF-UC10-03 | Mostrar decisión de venta, datos utilizados y gráficas de apoyo, sin proyecciones futuras. | 25 % | Mostrar el resultado económico explicable, todas sus entradas y las gráficas de apoyo. |
| RF-UC11-01 | Administrador: crear, consultar, modificar, asignar y seguir tareas de campo. | 65 % | Implementar edición y reasignación; restringir administración por rol y conservar historial de cambios. |
| RF-UC11-02 | Personal de Campo: consultar sus tareas y actualizar su estado. | 70 % | Restringir la consulta a tareas autorizadas y validar en Supabase los permisos de actualización y el historial con una sesión real de personal. La nueva RPC ya restringe la actualización a tareas propias en pruebas locales. |
| RF-UC12-01 | Administrador: registrar venta con fecha, peso de salida, precio/kg y comprador/canal. | 0 % | Implementar formulario y operación persistente con todos los datos obligatorios. |
| RF-UC12-02 | Calcular rentabilidad final, marcar vendido y conservar historial. | 0 % | Implementar cálculo y transacción de venta; aceptar solo toros activos y evitar ventas o bajas incompatibles. |
| RF-UC13-01 | Registrar baja/muerte con fecha, causa y pérdida económica; cambiar estado y conservar historial. | 0 % | Implementar captura y transacción para administrador/personal; aceptar solo toros activos y evitar eventos duplicados o incompatibles. |
| RF-UC14-01 | Iniciar y cerrar sesión únicamente con cuentas activas. | 90 % | Probar una cuenta inactiva en Supabase y corregir si conserva acceso. Reautenticación sin perder capturas, bloqueo de cierre con pendientes y cierre de sesión ya comprobados con administrador real; el estado de sesión y errores de acceso ya están centralizados. |
| RF-UC14-02 | Recuperar contraseña. | 90 % | Probar envío de correo, enlace de recuperación y cambio de contraseña completos en Supabase. |
| RF-UC14-03 | Aplicar roles Administrador/Personal de Campo y acceso solo a fincas autorizadas. | 50 % | Completar restricciones de toros, tareas, datos financieros y PDF; verificar cuenta/rol/finca en Supabase en todos los módulos. |
| RF-UC15-01 | Administrador: crear, consultar, modificar y desactivar cuentas del personal de sus fincas. | 45 % | Implementar alta, edición y desactivación de cuentas; invitar o retirar miembros de una finca no cubre esas operaciones. |
| RF-UC15-02 | Asignar roles y permisos a cada cuenta. | 60 % | Permitir cambiar el rol de miembros existentes y verificar autorización de las operaciones en Supabase. |
| RF-TR-01 | Capturar offline pesajes, sanidad, movimientos de inventario y actualizaciones de tareas. | 90 % | Validar las cuatro capturas con personal de campo y comprobar Safari/Firefox. Revisar manualmente la cola antigua sin propietario. Administrador real ya probado en Chromium: captura, cierre/reapertura offline y persistencia en Supabase. |
| RF-TR-02 | Sincronizar automáticamente al recuperar conexión, sin duplicar información. | 90 % | Validar en Supabase con personal, cuenta inactiva y no miembro. SQL aplicado; administrador real comprobado: reconexión automática, reintentos y concurrencia sin duplicados, rechazos por saldo y reautenticación conservando la captura. Respuesta perdida y aislamiento entre usuarios también probados localmente. |
| RF-TR-03 | Administrador: descargar PDF por periodo de pesajes/GMD, ventas/rentabilidad, inventario y sanidad. | 60 % | Completar periodo en las demás secciones, ventas/rentabilidad e historial sanitario; restringir todas las descargas al administrador. Bodega por periodo ya está probada. |
