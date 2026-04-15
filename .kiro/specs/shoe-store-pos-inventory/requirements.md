# Documento de Requisitos — ShoeStore POS & Inventario

---

## 1. Resumen Ejecutivo

Este documento define los requisitos para una **aplicación web en la nube** destinada a una pequeña empresa de calzado con **3 tiendas físicas** a nivel nacional. La aplicación será accesible desde **tablets y dispositivos móviles** y cubrirá dos dominios funcionales principales:

1. **Gestión de Inventario**: control de stock por tienda y por variante de producto (talla/color), movimientos auditados, alertas de stock bajo, transferencias entre tiendas y reportes tipo kardex.
2. **Punto de Venta (POS)**: flujo rápido de venta con búsqueda por nombre/SKU, escaneo de código de barras, carrito, descuentos, impuestos (IVA), generación de tickets con numeración, impresión en impresora térmica Bluetooth, y gestión de devoluciones/cambios.

Adicionalmente, el sistema incluye:
- **Catálogo de productos** con fichas detalladas (fotos, descripción, variantes, precios).
- **Gestión multiusuario** con roles (Admin, Gerente, Vendedor) y permisos por tienda.
- **Subsistema de impresión** de tickets térmicos (ESC/POS) con soporte Bluetooth y alternativas.
- **Auditoría** completa de acciones sensibles.
- **Cumplimiento básico GDPR** y políticas de seguridad.

**Alcance MVP vs Fase 2**: El documento marca explícitamente qué funcionalidades entran en el MVP y cuáles se difieren a Fase 2.

**Stack tecnológico preferido**:
- Frontend: React / Next.js desplegado en Vercel
- Backend: ASP.NET Core (opción principal) o BaaS (Supabase/Firebase como alternativa)
- Base de datos: PostgreSQL (preferencia) o equivalente en tier gratuito
- Almacenamiento de fotos: Cloudinary / Supabase Storage / S3 free tier

---

## 2. Personas y Roles

### 2.1 Personas

| Persona | Descripción | Dispositivo principal | Objetivos |
|---------|-------------|----------------------|-----------|
| **Carlos (Dueño/Admin)** | Propietario de la cadena de 3 tiendas. Necesita visión global del negocio. | Laptop / Tablet | Ver reportes globales, gestionar catálogo, controlar stock de todas las tiendas, administrar usuarios |
| **María (Gerente de Tienda)** | Encargada de una tienda específica. Gestiona inventario local y supervisa vendedores. | Tablet | Gestionar stock de su tienda, aprobar ajustes, ver reportes de su tienda, supervisar ventas |
| **Luis (Vendedor)** | Atiende clientes en mostrador. Necesita flujo de venta rápido. | Tablet / Móvil | Buscar productos, registrar ventas rápidamente, imprimir tickets, procesar devoluciones |
| **Ana (Vendedora con permisos extendidos)** | Vendedora senior que puede hacer transferencias entre tiendas. | Tablet | Mismas funciones que Luis + iniciar transferencias de stock |

### 2.2 Roles del Sistema

| Rol | Alcance | Permisos clave |
|-----|---------|----------------|
| **Admin** | Global (todas las tiendas) | CRUD productos, gestión de usuarios, configuración global, reportes globales, ajustes de stock en cualquier tienda, configuración de impuestos y métodos de pago |
| **Gerente** | Por tienda asignada | Gestión de stock de su tienda, aprobación de ajustes, reportes de su tienda, gestión de vendedores de su tienda, devoluciones, cierre de caja |
| **Vendedor** | Por tienda asignada | Registrar ventas, buscar productos, ver stock de su tienda, imprimir tickets, procesar devoluciones simples |

### 2.3 Matriz de Permisos Detallada

| Acción | Admin | Gerente | Vendedor |
|--------|-------|---------|----------|
| Crear/editar producto | ✅ | ❌ | ❌ |
| Ver catálogo completo | ✅ | ✅ (su tienda) | ✅ (su tienda) |
| Ver stock de todas las tiendas | ✅ | ❌ | ❌ |
| Ver stock de su tienda | ✅ | ✅ | ✅ |
| Ajustar stock | ✅ | ✅ (su tienda) | ❌ |
| Transferir stock entre tiendas | ✅ | ✅ (origen=su tienda) | ❌ (salvo permiso explícito) |
| Registrar venta | ✅ | ✅ | ✅ |
| Cancelar venta (antes de confirmar) | ✅ | ✅ | ✅ |
| Anular venta (después de confirmar) | ✅ | ✅ | ❌ |
| Procesar devolución | ✅ | ✅ | ✅ (con límite configurable) |
| Gestionar usuarios | ✅ | ❌ | ❌ |
| Ver reportes globales | ✅ | ❌ | ❌ |
| Ver reportes de tienda | ✅ | ✅ | ❌ |
| Configurar impuestos/métodos pago | ✅ | ❌ | ❌ |
| Cierre de caja | ✅ | ✅ | ❌ |
| Ver auditoría | ✅ | ✅ (su tienda) | ❌ |

---

## 3. Recorridos de Usuario (User Journeys)

### 3.1 Journey: Creación de Producto

**Actor**: Carlos (Admin)
**Dispositivo**: Laptop

1. Carlos accede al módulo "Catálogo" desde el menú principal.
2. Pulsa "Nuevo Producto".
3. Completa el formulario base: nombre ("Zapato Oxford Classic"), marca ("MarcaX"), categoría ("Formal"), descripción rica.
4. Sube 4 fotos del producto (galería con drag & drop).
5. Define atributos: precio base ($1,200 MXN), costo ($600 MXN), IVA (16%).
6. Agrega variantes:
   - Talla 26, Color Negro → SKU: OXF-CLX-26-NEG, Código de barras: 7501234567890
   - Talla 26, Color Café → SKU: OXF-CLX-26-CAF
   - Talla 27, Color Negro → SKU: OXF-CLX-27-NEG
   - (continúa para cada combinación)
7. Asigna stock inicial por tienda para cada variante:
   - Tienda Centro: 5 pares (26-NEG), 3 pares (26-CAF), 4 pares (27-NEG)
   - Tienda Norte: 3 pares (26-NEG), 2 pares (26-CAF), 3 pares (27-NEG)
   - Tienda Sur: 2 pares (26-NEG), 1 par (26-CAF), 2 pares (27-NEG)
8. Marca el producto como "Activo".
9. Guarda. El sistema confirma la creación y muestra la ficha del producto.
10. El sistema registra en auditoría: "Carlos creó producto OXF-CLX a las 14:32".

### 3.2 Journey: Venta en POS

**Actor**: Luis (Vendedor)
**Dispositivo**: Tablet
**Tienda**: Centro

1. Luis abre el módulo POS. El sistema muestra la interfaz de venta con barra de búsqueda prominente.
2. Un cliente pide "Zapato Oxford talla 27 negro".
3. Luis escribe "Oxford 27" en la barra de búsqueda. El sistema muestra resultados filtrados.
4. Luis selecciona "Zapato Oxford Classic - Talla 27 - Negro". El sistema muestra stock disponible: 4 pares en Tienda Centro.
5. Luis agrega 1 par al carrito. El carrito muestra:
   - 1x Zapato Oxford Classic 27-NEG — $1,200.00
   - Subtotal: $1,200.00
   - IVA (16%): $192.00
   - Total: $1,392.00
6. El cliente también quiere unos tenis. Luis escanea el código de barras con la cámara del tablet.
7. El sistema identifica "Tenis Sport Run - Talla 26 - Blanco" y lo agrega al carrito.
   - 1x Tenis Sport Run 26-BLA — $890.00
   - Subtotal: $2,090.00
   - IVA (16%): $334.40
   - Total: $2,424.40
8. El cliente pide un 10% de descuento. Luis aplica descuento del 10% al total.
   - Descuento: -$209.00
   - Subtotal con descuento: $1,881.00
   - IVA (16%): $300.96
   - Total: $2,181.96
9. El cliente paga con tarjeta. Luis selecciona "Tarjeta" como método de pago.
10. Luis confirma la venta. El sistema:
    a. Genera ticket #TC-2024-000142
    b. Deduce stock: Oxford 27-NEG en Centro pasa de 4 a 3; Tenis 26-BLA en Centro pasa de 8 a 7
    c. Registra el movimiento de stock tipo "Venta"
    d. Envía el ticket a la impresora Bluetooth
11. La impresora térmica imprime el ticket con logo, datos de tienda, detalle de productos, descuento, IVA, total, método de pago y política de devolución.
12. Luis entrega el ticket al cliente.

### 3.3 Journey: Devolución

**Actor**: Luis (Vendedor) + María (Gerente para aprobación si aplica)
**Dispositivo**: Tablet
**Tienda**: Centro

1. Un cliente regresa con el ticket #TC-2024-000142 y quiere devolver los Tenis Sport Run.
2. Luis accede al módulo "Devoluciones" y busca el ticket por número.
3. El sistema muestra el detalle de la venta original.
4. Luis selecciona el artículo a devolver: "Tenis Sport Run 26-BLA".
5. Selecciona motivo: "Defecto de fábrica" (de una lista configurable).
6. El sistema calcula el reembolso:
   - Precio original: $890.00
   - Descuento proporcional aplicado: -$89.00
   - IVA proporcional: $128.16
   - Total reembolso: $929.16
7. Luis confirma la devolución. El sistema:
   a. Genera nota de devolución #DEV-TC-2024-000142-01
   b. Re-ingresa stock: Tenis 26-BLA en Centro pasa de 7 a 8
   c. Registra movimiento de stock tipo "Devolución"
   d. Imprime nota de devolución en impresora térmica
8. El sistema registra en auditoría: "Luis procesó devolución DEV-TC-2024-000142-01 a las 16:45".

### 3.4 Journey: Transferencia entre Tiendas

**Actor**: María (Gerente de Tienda Centro)
**Dispositivo**: Tablet

1. María detecta que Tienda Norte necesita más stock de "Zapato Oxford Classic 27-NEG".
2. Accede al módulo "Transferencias" y crea nueva transferencia.
3. Selecciona:
   - Origen: Tienda Centro
   - Destino: Tienda Norte
   - Producto: Zapato Oxford Classic 27-NEG
   - Cantidad: 2 pares
4. Agrega nota: "Solicitud de Gerente Norte por alta demanda".
5. Confirma la transferencia. El sistema:
   a. Genera transferencia #TRF-2024-000023
   b. Deduce stock en Centro: 3 → 1
   c. Incrementa stock en Norte: 3 → 5
   d. Registra dos movimientos: "Salida por transferencia" en Centro y "Entrada por transferencia" en Norte
6. Ambos gerentes pueden ver la transferencia en el historial.

### 3.5 Journey: Gestión de Inventario (Ajuste y Kardex)

**Actor**: María (Gerente de Tienda Centro)
**Dispositivo**: Tablet

1. María realiza conteo físico y detecta que "Sandalia Verano 25-ROJ" tiene 10 unidades en sistema pero solo 8 físicas.
2. Accede al módulo "Inventario" → "Ajustes de Stock".
3. Busca el producto/variante.
4. Crea ajuste: cantidad actual sistema = 10, cantidad real = 8, diferencia = -2.
5. Selecciona motivo: "Diferencia en conteo físico".
6. Agrega nota: "Conteo realizado el 15/03/2024 por María y Luis".
7. Confirma el ajuste. El sistema:
   a. Ajusta stock de 10 a 8
   b. Registra movimiento tipo "Ajuste" con motivo y nota
   c. Registra en auditoría: "María ajustó stock de SAN-VER-25-ROJ en Centro: 10→8"
8. María consulta el Kardex del producto para verificar el historial completo de movimientos.

---

## 4. Requisitos Funcionales (MVP vs Fase 2)


### Requisito 1: Gestión de Catálogo de Productos

**Historia de Usuario:** Como Admin, quiero crear y gestionar un catálogo de productos con información detallada, fotos y variantes, para que todas las tiendas tengan acceso a información precisa y actualizada de cada producto.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_Catalogo SHALL almacenar para cada producto base los campos: nombre (máx. 200 caracteres), marca, categoría, descripción (texto enriquecido, máx. 5000 caracteres), estado (activo/inactivo), precio base, costo, porcentaje de impuesto (IVA), fecha de creación y fecha de última modificación.
2. WHEN un Admin crea un producto nuevo, THE Sistema_Catalogo SHALL requerir como mínimo: nombre, marca, categoría, precio base, costo y al menos una variante (talla + color).
3. THE Sistema_Catalogo SHALL permitir asociar entre 1 y 10 fotos por producto, cada una con un tamaño máximo de 5 MB y en formatos JPG, PNG o WebP.
4. WHEN un Admin sube una foto, THE Sistema_Catalogo SHALL generar automáticamente una miniatura de 200x200 píxeles y una versión optimizada de 800x800 píxeles para la galería.
5. THE Sistema_Catalogo SHALL soportar variantes obligatorias compuestas por talla y color, donde cada combinación única de talla y color constituye una variante independiente con su propio stock.
6. THE Sistema_Catalogo SHALL generar un SKU único por variante siguiendo el patrón: {CATEGORIA_3}-{MARCA_3}-{TALLA}-{COLOR_3} (ejemplo: FOR-MRX-27-NEG).
7. WHERE un código de barras GTIN existe para una variante, THE Sistema_Catalogo SHALL almacenar y validar el formato del código (EAN-13 o UPC-A).
8. WHEN un Admin marca un producto como "inactivo", THE Sistema_Catalogo SHALL ocultar el producto de las búsquedas del POS pero mantener el historial de ventas y stock existente.
9. WHEN un usuario con permisos accede a la página de detalle de un producto, THE Sistema_Catalogo SHALL mostrar: galería de fotos navegable, descripción completa, tabla de variantes con talla, color, SKU, precio y stock por tienda (filtrado según permisos del usuario).
10. IF un Admin intenta crear un producto con un SKU que ya existe, THEN THE Sistema_Catalogo SHALL rechazar la operación y mostrar un mensaje indicando el SKU duplicado y el producto existente que lo utiliza.

### Requisito 2: Gestión de Variantes de Producto

**Historia de Usuario:** Como Admin, quiero definir variantes de talla y color para cada producto con stock independiente, para que el inventario refleje con precisión la disponibilidad de cada combinación específica.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_Catalogo SHALL mantener una lista configurable de tallas (ejemplo: 22, 22.5, 23, 23.5, ..., 31) y una lista configurable de colores (ejemplo: Negro, Café, Blanco, Rojo, Azul, etc.) administrables por el Admin.
2. WHEN un Admin agrega variantes a un producto, THE Sistema_Catalogo SHALL crear una variante por cada combinación seleccionada de talla y color.
3. THE Sistema_Catalogo SHALL permitir que cada variante tenga un precio diferente al precio base del producto (sobreprecio o descuento por variante).
4. WHEN un Admin elimina una variante que tiene stock mayor a cero en cualquier tienda, THE Sistema_Catalogo SHALL impedir la eliminación y mostrar un mensaje indicando las tiendas y cantidades de stock existentes.
5. THE Sistema_Catalogo SHALL permitir asociar fotos específicas a variantes de color, de modo que al seleccionar un color en la ficha de producto se muestren las fotos correspondientes.

### Requisito 3: Gestión de Inventario por Tienda

**Historia de Usuario:** Como Gerente de tienda, quiero gestionar el stock de mi tienda por variante de producto, para que el inventario refleje con exactitud las existencias físicas.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_Inventario SHALL mantener un registro de stock independiente para cada combinación de variante de producto y tienda, donde el stock es un número entero no negativo.
2. WHEN se confirma una venta en el POS, THE Sistema_Inventario SHALL deducir automáticamente la cantidad vendida del stock de la tienda correspondiente para cada variante incluida en la venta.
3. IF una venta intenta deducir más stock del disponible para una variante en una tienda, THEN THE Sistema_Inventario SHALL rechazar la confirmación de la venta y mostrar un mensaje indicando la variante y el stock disponible actual.
4. THE Sistema_Inventario SHALL registrar cada movimiento de stock con los campos: tipo de movimiento (entrada, venta, devolución, ajuste, transferencia_salida, transferencia_entrada), cantidad, stock anterior, stock posterior, fecha y hora, usuario que realizó la acción, tienda, variante, referencia al documento origen (venta, devolución, transferencia, ajuste) y nota opcional.
5. WHEN un Gerente o Admin consulta el kardex de una variante en una tienda, THE Sistema_Inventario SHALL mostrar el historial cronológico de todos los movimientos de stock con los campos definidos en el criterio anterior, paginado en bloques de 50 registros.
6. THE Sistema_Inventario SHALL permitir configurar un umbral de stock bajo por variante y tienda (o un umbral global por defecto), con un valor mínimo de 0 y un valor máximo de 9999.
7. WHEN el stock de una variante en una tienda alcanza o cae por debajo del umbral configurado, THE Sistema_Inventario SHALL generar una alerta visible en el dashboard del Gerente de esa tienda y del Admin.
8. WHEN un Gerente realiza un ajuste de stock, THE Sistema_Inventario SHALL requerir: cantidad nueva, motivo de ajuste (seleccionado de lista configurable: "Conteo físico", "Daño", "Robo/Pérdida", "Error de sistema", "Otro") y nota descriptiva obligatoria.

### Requisito 4: Transferencias entre Tiendas

**Historia de Usuario:** Como Gerente de tienda, quiero transferir stock de mi tienda a otra tienda, para redistribuir inventario según la demanda de cada ubicación.

**Fase:** MVP

#### Criterios de Aceptación

1. WHEN un Gerente o Admin crea una transferencia, THE Sistema_Inventario SHALL requerir: tienda origen, tienda destino, al menos una línea con variante y cantidad, y nota opcional.
2. WHEN se confirma una transferencia, THE Sistema_Inventario SHALL deducir el stock de la tienda origen e incrementar el stock de la tienda destino de forma atómica en una sola transacción.
3. IF la cantidad a transferir excede el stock disponible en la tienda origen, THEN THE Sistema_Inventario SHALL rechazar la transferencia y mostrar el stock disponible actual.
4. THE Sistema_Inventario SHALL asignar un número de transferencia único con formato TRF-{AÑO}-{SECUENCIAL_6_DIGITOS} (ejemplo: TRF-2024-000023).
5. WHILE una transferencia está en estado "pendiente" (Fase 2: flujo de aprobación), THE Sistema_Inventario SHALL reservar el stock en la tienda origen sin deducirlo hasta la confirmación.

**Nota Fase 2:** En MVP, las transferencias se confirman inmediatamente. En Fase 2 se implementará un flujo de aprobación donde el Gerente destino debe aceptar la transferencia.

### Requisito 5: Importación y Exportación de Datos

**Historia de Usuario:** Como Admin, quiero exportar el catálogo e inventario a CSV y opcionalmente importar datos desde CSV, para facilitar la carga inicial y el análisis externo de datos.

**Fase:** MVP (exportación) / Fase 2 (importación)

#### Criterios de Aceptación

1. THE Sistema_Inventario SHALL permitir exportar a formato CSV: catálogo de productos con variantes, stock actual por tienda y variante, y historial de movimientos de stock filtrado por rango de fechas.
2. WHEN un Admin solicita una exportación, THE Sistema_Inventario SHALL generar el archivo CSV con codificación UTF-8 con BOM y separador de coma, e incluir una fila de encabezados descriptivos.
3. THE Sistema_Inventario SHALL limitar la exportación a un máximo de 50,000 registros por archivo; IF el resultado excede ese límite, THEN THE Sistema_Inventario SHALL dividir la exportación en múltiples archivos.
4. **(Fase 2)** WHEN un Admin sube un archivo CSV de importación, THE Sistema_Inventario SHALL validar el formato, mostrar un resumen de cambios (productos nuevos, actualizaciones, errores) y requerir confirmación antes de aplicar los cambios.

### Requisito 6: Punto de Venta — Flujo de Venta

**Historia de Usuario:** Como Vendedor, quiero registrar ventas de forma rápida buscando productos, agregándolos al carrito y confirmando el pago, para atender clientes de manera eficiente.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_POS SHALL presentar una interfaz de venta con: barra de búsqueda prominente, área de carrito visible, resumen de totales (subtotal, descuento, impuesto, total) y botones de acción (confirmar venta, cancelar, aplicar descuento).
2. WHEN un Vendedor escribe en la barra de búsqueda, THE Sistema_POS SHALL mostrar resultados en tiempo real (debounce de 300ms) filtrando por nombre de producto, SKU o código de barras, mostrando solo productos activos con stock mayor a cero en la tienda actual.
3. WHERE el dispositivo tiene cámara disponible, THE Sistema_POS SHALL permitir escanear códigos de barras (EAN-13, UPC-A) usando la cámara del dispositivo para buscar productos.
4. WHEN un Vendedor selecciona un producto de los resultados de búsqueda, THE Sistema_POS SHALL mostrar las variantes disponibles (talla/color) con su stock en la tienda actual, y permitir seleccionar la variante deseada.
5. WHEN un Vendedor agrega una variante al carrito, THE Sistema_POS SHALL mostrar: nombre del producto, variante (talla-color), cantidad, precio unitario, subtotal de línea; y recalcular automáticamente subtotal, impuesto y total del carrito.
6. THE Sistema_POS SHALL permitir modificar la cantidad de cada línea del carrito (entre 1 y el stock disponible) y eliminar líneas individuales.
7. WHEN un Vendedor aplica un descuento, THE Sistema_POS SHALL soportar descuento porcentual (0-100%) o monto fijo, aplicable a nivel de línea individual o a nivel de carrito completo.
8. THE Sistema_POS SHALL calcular el IVA sobre el subtotal después de descuentos, usando la tasa de impuesto configurada para cada producto.
9. WHEN un Vendedor confirma la venta, THE Sistema_POS SHALL: (a) validar que el stock sigue disponible para cada línea, (b) generar un número de ticket único, (c) registrar la venta con todos sus detalles, (d) deducir stock, (e) enviar el ticket a impresión.
10. IF entre el momento de agregar al carrito y confirmar la venta otro usuario agotó el stock de una variante, THEN THE Sistema_POS SHALL mostrar un mensaje indicando las variantes sin stock suficiente y permitir al Vendedor ajustar el carrito.
11. WHEN un Vendedor cancela una venta antes de confirmarla, THE Sistema_POS SHALL descartar el carrito sin afectar el inventario ni generar ningún registro de venta.

### Requisito 7: Métodos de Pago

**Historia de Usuario:** Como Vendedor, quiero seleccionar el método de pago del cliente al confirmar una venta, para registrar correctamente cómo se realizó el cobro.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_POS SHALL soportar los métodos de pago: Efectivo, Tarjeta de Crédito, Tarjeta de Débito y Otro (configurable por Admin).
2. WHEN el método de pago es "Efectivo", THE Sistema_POS SHALL solicitar el monto recibido y calcular el cambio a devolver.
3. THE Sistema_POS SHALL permitir pagos mixtos (parte efectivo, parte tarjeta) registrando el monto de cada método.
4. WHEN un Admin configura un nuevo método de pago, THE Sistema_POS SHALL requerir: nombre del método, estado (activo/inactivo) e icono opcional.

### Requisito 8: Numeración de Tickets y Ventas

**Historia de Usuario:** Como dueño del negocio, quiero que cada venta tenga un número de ticket único y secuencial por tienda, para mantener un control ordenado y trazable de todas las transacciones.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_POS SHALL generar números de ticket con formato: {PREFIJO_TIENDA}-{AÑO}-{SECUENCIAL_6_DIGITOS} (ejemplo: TC-2024-000142 para Tienda Centro).
2. THE Sistema_POS SHALL garantizar que los números de ticket sean secuenciales sin saltos dentro de cada tienda y año.
3. WHEN inicia un nuevo año calendario, THE Sistema_POS SHALL reiniciar el secuencial a 000001 para cada tienda.
4. THE Sistema_POS SHALL configurar el prefijo de tienda como parte de la configuración de cada tienda (ejemplo: TC=Tienda Centro, TN=Tienda Norte, TS=Tienda Sur).

### Requisito 9: Devoluciones y Cambios

**Historia de Usuario:** Como Vendedor, quiero procesar devoluciones de productos referenciando la venta original, para que el stock se reingrese correctamente y se genere documentación de la devolución.

**Fase:** MVP

#### Criterios de Aceptación

1. WHEN un Vendedor inicia una devolución, THE Sistema_POS SHALL permitir buscar la venta original por número de ticket, fecha o nombre del cliente (si se registró).
2. WHEN se encuentra la venta original, THE Sistema_POS SHALL mostrar todas las líneas de la venta y permitir seleccionar los artículos a devolver con su cantidad (parcial o total).
3. THE Sistema_POS SHALL requerir un motivo de devolución seleccionado de una lista configurable: "Defecto de fábrica", "Talla incorrecta", "No satisface expectativas", "Daño en transporte", "Otro" (con nota obligatoria).
4. WHEN se confirma una devolución, THE Sistema_POS SHALL: (a) calcular el monto de reembolso proporcional incluyendo descuentos e impuestos de la venta original, (b) re-ingresar el stock de las variantes devueltas en la tienda donde se procesa la devolución, (c) generar una nota de devolución con número único formato DEV-{TICKET_ORIGINAL}-{SECUENCIAL_2_DIGITOS}.
5. THE Sistema_POS SHALL imprimir la nota de devolución en la impresora térmica con: número de nota, referencia al ticket original, artículos devueltos, motivo, monto de reembolso, fecha y hora, y nombre del vendedor.
6. IF un Vendedor intenta devolver un artículo de una venta con más de 30 días de antigüedad (configurable), THEN THE Sistema_POS SHALL requerir aprobación de un Gerente o Admin para proceder.
7. **(Fase 2)** WHEN un cliente desea un cambio (devolución + nueva venta), THE Sistema_POS SHALL permitir procesar la devolución y la nueva venta en una sola transacción, calculando la diferencia a pagar o devolver.

### Requisito 10: Diseño e Impresión de Tickets Térmicos

**Historia de Usuario:** Como Vendedor, quiero imprimir tickets de venta en una impresora térmica Bluetooth desde mi tablet o móvil, para entregar comprobantes físicos a los clientes de forma inmediata.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_Impresion SHALL generar tickets en formato ESC/POS compatible con impresoras térmicas de 58mm y 80mm de ancho.
2. THE Sistema_Impresion SHALL incluir en cada ticket de venta: logo de la tienda (imagen monocromática), nombre de la tienda, dirección, teléfono, RFC/NIF, fecha y hora de la venta, número de ticket, nombre del vendedor, líneas de detalle (producto, variante, cantidad, precio unitario, subtotal), descuentos aplicados, subtotal, desglose de IVA, total, método de pago, monto recibido y cambio (si aplica), y texto de política de devolución.
3. WHEN un Vendedor confirma una venta, THE Sistema_Impresion SHALL enviar automáticamente el ticket a la impresora Bluetooth configurada para esa tienda/dispositivo.
4. IF la impresora Bluetooth no está disponible o la conexión falla, THEN THE Sistema_Impresion SHALL mostrar un mensaje de error y ofrecer las opciones: reintentar impresión, imprimir en otra impresora configurada, o guardar el ticket para impresión posterior.
5. THE Sistema_Impresion SHALL permitir reimprimir cualquier ticket desde el historial de ventas.
6. THE Sistema_Impresion SHALL permitir al Admin configurar la plantilla del ticket: logo, textos de encabezado, texto de pie (política de devolución), y activar/desactivar secciones opcionales.

### Requisito 11: Autenticación y Gestión de Usuarios

**Historia de Usuario:** Como Admin, quiero gestionar usuarios con diferentes roles y permisos por tienda, para controlar el acceso al sistema de forma segura.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_Auth SHALL autenticar usuarios mediante correo electrónico y contraseña.
2. THE Sistema_Auth SHALL requerir contraseñas con un mínimo de 8 caracteres, al menos una letra mayúscula, una minúscula, un número y un carácter especial.
3. WHEN un usuario ingresa credenciales incorrectas 5 veces consecutivas, THE Sistema_Auth SHALL bloquear la cuenta durante 15 minutos y notificar al Admin por correo electrónico.
4. THE Sistema_Auth SHALL emitir tokens JWT con expiración de 8 horas para sesiones activas y refresh tokens con expiración de 30 días.
5. WHEN un Admin crea un usuario, THE Sistema_Auth SHALL requerir: nombre completo, correo electrónico, rol (Admin, Gerente, Vendedor) y tienda(s) asignada(s).
6. THE Sistema_Auth SHALL impedir que un usuario con rol Vendedor acceda a datos de tiendas a las que no está asignado.
7. WHEN un Admin desactiva un usuario, THE Sistema_Auth SHALL invalidar todas las sesiones activas de ese usuario en un plazo máximo de 5 minutos.

### Requisito 12: Auditoría de Acciones

**Historia de Usuario:** Como Admin, quiero que el sistema registre todas las acciones sensibles con detalle de quién, qué, cuándo y dónde, para mantener trazabilidad completa de las operaciones.

**Fase:** MVP

#### Criterios de Aceptación

1. THE Sistema_Auditoria SHALL registrar un evento de auditoría para cada una de las siguientes acciones: creación/edición/eliminación de productos, ajustes de stock, transferencias, ventas, devoluciones, creación/edición/desactivación de usuarios, cambios de configuración, e intentos de acceso fallidos.
2. THE Sistema_Auditoria SHALL almacenar para cada evento: timestamp (UTC), usuario que realizó la acción, tipo de acción, entidad afectada (tipo e ID), tienda asociada, valores anteriores y nuevos (para ediciones), dirección IP y user-agent del dispositivo.
3. THE Sistema_Auditoria SHALL retener los registros de auditoría durante un mínimo de 2 años.
4. WHEN un Admin o Gerente consulta la auditoría, THE Sistema_Auditoria SHALL permitir filtrar por: rango de fechas, usuario, tipo de acción, tienda y entidad afectada.
5. THE Sistema_Auditoria SHALL ser inmutable: ningún usuario, incluido el Admin, podrá modificar o eliminar registros de auditoría.

### Requisito 13: Alertas de Stock Bajo

**Historia de Usuario:** Como Gerente de tienda, quiero recibir alertas cuando el stock de un producto cae por debajo del umbral configurado, para tomar acciones de reabastecimiento oportunas.

**Fase:** MVP

#### Criterios de Aceptación

1. WHEN el stock de una variante en una tienda alcanza o cae por debajo del umbral configurado, THE Sistema_Alertas SHALL crear una alerta visible en el dashboard con: nombre del producto, variante, tienda, stock actual y umbral configurado.
2. THE Sistema_Alertas SHALL mostrar un badge con el conteo de alertas activas en el menú de navegación para Gerentes y Admin.
3. WHEN un Gerente o Admin visualiza una alerta, THE Sistema_Alertas SHALL permitir marcarla como "atendida" con una nota opcional.
4. WHILE el stock permanece por debajo del umbral, THE Sistema_Alertas SHALL mantener la alerta activa aunque haya sido marcada como "atendida" (se reactiva si el stock no se repone).
5. **(Fase 2)** WHEN se genera una alerta de stock bajo, THE Sistema_Alertas SHALL enviar una notificación por correo electrónico al Gerente de la tienda y al Admin.


### Requisito 14: Cierre de Caja y Reportes por Vendedor (Fase 2)

**Historia de Usuario:** Como Gerente de tienda, quiero realizar cierres de caja diarios y ver reportes de ventas por vendedor, para controlar el flujo de efectivo y el rendimiento del equipo.

**Fase:** Fase 2

#### Criterios de Aceptación

1. **(Fase 2)** WHEN un Gerente inicia un cierre de caja, THE Sistema_POS SHALL calcular: total de ventas del turno, desglose por método de pago, total de devoluciones, y saldo esperado en caja.
2. **(Fase 2)** WHEN un Gerente ingresa el conteo físico de efectivo, THE Sistema_POS SHALL calcular la diferencia entre el saldo esperado y el conteo real, y registrar el cierre con la diferencia.
3. **(Fase 2)** THE Sistema_Reportes SHALL generar reportes de ventas por vendedor con: número de transacciones, monto total vendido, ticket promedio, y productos más vendidos, filtrable por rango de fechas.

---

## 5. Requisitos No Funcionales

### Requisito NF-1: Rendimiento

**Historia de Usuario:** Como Vendedor, quiero que el sistema responda rápidamente durante el flujo de venta, para no hacer esperar a los clientes.

#### Criterios de Aceptación

1. THE Sistema SHALL responder a búsquedas de productos en el POS en un tiempo máximo de 500 milisegundos para un catálogo de hasta 5,000 variantes.
2. THE Sistema SHALL confirmar una venta (incluyendo deducción de stock y generación de ticket) en un tiempo máximo de 2 segundos.
3. THE Sistema SHALL cargar la página de detalle de producto (incluyendo galería de fotos) en un tiempo máximo de 3 segundos con conexión 4G.
4. THE Sistema SHALL soportar al menos 15 usuarios concurrentes (5 por tienda) sin degradación perceptible del rendimiento.

### Requisito NF-2: Disponibilidad y Resiliencia

**Historia de Usuario:** Como dueño del negocio, quiero que el sistema esté disponible durante el horario comercial, para no perder ventas por caídas del sistema.

#### Criterios de Aceptación

1. THE Sistema SHALL mantener una disponibilidad mínima del 99.5% durante horario comercial (8:00-21:00 hora local).
2. IF el sistema experimenta una caída, THEN THE Sistema SHALL recuperarse automáticamente en un plazo máximo de 10 minutos mediante reinicio automático del servicio.
3. THE Sistema SHALL realizar backups automáticos de la base de datos cada 24 horas, con retención de al menos 7 días.
4. **(Fase 2)** WHILE el dispositivo pierde conexión a internet, THE Sistema_POS SHALL permitir continuar registrando ventas en modo offline y sincronizar automáticamente cuando se restablezca la conexión.

### Requisito NF-3: Seguridad

**Historia de Usuario:** Como dueño del negocio, quiero que el sistema proteja los datos del negocio y de los clientes, para cumplir con buenas prácticas de seguridad y regulaciones.

#### Criterios de Aceptación

1. THE Sistema SHALL cifrar todas las comunicaciones entre cliente y servidor usando TLS 1.2 o superior.
2. THE Sistema SHALL almacenar contraseñas usando bcrypt con un factor de costo mínimo de 12.
3. THE Sistema SHALL implementar control de acceso basado en roles (RBAC) validando permisos en cada endpoint del API.
4. THE Sistema SHALL sanitizar todas las entradas de usuario para prevenir inyección SQL y XSS.
5. THE Sistema SHALL incluir headers de seguridad HTTP: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security.
6. THE Sistema SHALL limitar las peticiones al API a un máximo de 100 peticiones por minuto por usuario autenticado (rate limiting).

### Requisito NF-4: Responsividad y Compatibilidad

**Historia de Usuario:** Como Vendedor, quiero usar el sistema desde mi tablet o móvil con una experiencia fluida, para atender clientes en cualquier parte de la tienda.

#### Criterios de Aceptación

1. THE Sistema SHALL ser completamente funcional y usable en dispositivos con pantallas desde 375px (móvil) hasta 1920px (desktop).
2. THE Sistema SHALL ser compatible con las últimas 2 versiones de: Chrome (Android), Safari (iOS/iPadOS), Chrome (desktop) y Edge (desktop).
3. THE Sistema_POS SHALL optimizar su interfaz para uso táctil con áreas de toque mínimas de 44x44 píxeles según las guías de accesibilidad WCAG 2.1.
4. THE Sistema SHALL funcionar como Progressive Web App (PWA) permitiendo instalación en la pantalla de inicio del dispositivo.

### Requisito NF-5: Cumplimiento GDPR Básico

**Historia de Usuario:** Como dueño del negocio, quiero que el sistema cumpla con principios básicos de protección de datos, para operar de forma responsable y legal.

#### Criterios de Aceptación

1. THE Sistema SHALL aplicar el principio de minimización de datos, recopilando solo los datos estrictamente necesarios para la operación del negocio.
2. THE Sistema SHALL permitir al Admin exportar todos los datos asociados a un usuario en formato JSON en un plazo máximo de 72 horas tras la solicitud.
3. THE Sistema SHALL permitir al Admin eliminar o anonimizar datos de un usuario, manteniendo la integridad referencial de registros históricos (ventas, auditoría) mediante anonimización en lugar de eliminación.
4. THE Sistema SHALL definir y documentar períodos de retención de datos: datos de ventas (5 años), datos de auditoría (2 años), datos de usuarios inactivos (1 año antes de anonimización).

---

## 6. Arquitectura de Información

### 6.1 Estructura de Navegación Principal

```
┌─────────────────────────────────────────────────┐
│  BARRA SUPERIOR                                  │
│  [Logo] [Nombre Tienda Actual] [Alertas 🔔(3)]  │
│  [Buscar...]           [Usuario ▼] [Cerrar Sesión]│
├─────────────────────────────────────────────────┤
│  MENÚ LATERAL (colapsable en móvil)              │
│                                                   │
│  📊 Dashboard                                     │
│  🛒 Punto de Venta (POS)                         │
│  📦 Catálogo                                      │
│     ├── Productos                                 │
│     ├── Categorías                                │
│     └── Marcas                                    │
│  📋 Inventario                                    │
│     ├── Stock Actual                              │
│     ├── Movimientos                               │
│     ├── Ajustes                                   │
│     ├── Transferencias                            │
│     └── Alertas                                   │
│  🧾 Ventas                                        │
│     ├── Historial de Ventas                       │
│     └── Devoluciones                              │
│  👥 Usuarios (solo Admin)                         │
│  ⚙️ Configuración (solo Admin/Gerente)            │
│     ├── Tiendas                                   │
│     ├── Impuestos                                 │
│     ├── Métodos de Pago                           │
│     ├── Plantilla de Ticket                       │
│     └── Impresoras                                │
│  📈 Reportes (Fase 2)                             │
│  📝 Auditoría (Admin/Gerente)                     │
└─────────────────────────────────────────────────┘
```

### 6.2 Mapa de Pantallas

| # | Pantalla | Ruta | Roles con acceso |
|---|----------|------|-----------------|
| 1 | Login | /login | Todos (no autenticados) |
| 2 | Dashboard | / | Todos |
| 3 | POS - Venta | /pos | Vendedor, Gerente, Admin |
| 4 | POS - Carrito/Checkout | /pos (mismo) | Vendedor, Gerente, Admin |
| 5 | Lista de Productos | /catalogo/productos | Admin, Gerente (lectura) |
| 6 | Crear/Editar Producto | /catalogo/productos/nuevo, /catalogo/productos/:id/editar | Admin |
| 7 | Detalle de Producto | /catalogo/productos/:id | Todos |
| 8 | Categorías | /catalogo/categorias | Admin |
| 9 | Marcas | /catalogo/marcas | Admin |
| 10 | Stock Actual | /inventario/stock | Gerente, Admin |
| 11 | Historial de Movimientos | /inventario/movimientos | Gerente, Admin |
| 12 | Nuevo Ajuste de Stock | /inventario/ajustes/nuevo | Gerente, Admin |
| 13 | Nueva Transferencia | /inventario/transferencias/nueva | Gerente, Admin |
| 14 | Lista de Transferencias | /inventario/transferencias | Gerente, Admin |
| 15 | Alertas de Stock | /inventario/alertas | Gerente, Admin |
| 16 | Historial de Ventas | /ventas/historial | Gerente, Admin |
| 17 | Detalle de Venta | /ventas/:id | Gerente, Admin, Vendedor (sus ventas) |
| 18 | Nueva Devolución | /ventas/devoluciones/nueva | Vendedor, Gerente, Admin |
| 19 | Lista de Devoluciones | /ventas/devoluciones | Gerente, Admin |
| 20 | Gestión de Usuarios | /usuarios | Admin |
| 21 | Configuración de Tiendas | /config/tiendas | Admin |
| 22 | Configuración de Impuestos | /config/impuestos | Admin |
| 23 | Configuración de Métodos de Pago | /config/metodos-pago | Admin |
| 24 | Configuración de Ticket | /config/ticket | Admin |
| 25 | Configuración de Impresoras | /config/impresoras | Admin, Gerente |
| 26 | Auditoría | /auditoria | Admin, Gerente |
| 27 | Perfil de Usuario | /perfil | Todos |

---

## 7. Wireframes UX (Descripción Textual por Pantalla)

### 7.1 Pantalla: Login (/login)

**Objetivo:** Permitir al usuario autenticarse en el sistema.

**Layout:**
- Centrado vertical y horizontal en pantalla completa.
- Fondo con color de marca sutil.

**Campos:**
- Logo de la empresa (centrado, arriba)
- Campo "Correo electrónico" (input type=email, placeholder: "tu@correo.com")
- Campo "Contraseña" (input type=password, con toggle de visibilidad)
- Checkbox "Recordar sesión"
- Botón "Iniciar Sesión" (primario, ancho completo)
- Enlace "¿Olvidaste tu contraseña?" (debajo del botón)

**Estados:**
- **Cargando:** Botón muestra spinner, campos deshabilitados.
- **Error de credenciales:** Mensaje rojo sobre el formulario: "Correo o contraseña incorrectos".
- **Cuenta bloqueada:** Mensaje: "Cuenta bloqueada por intentos fallidos. Intenta en 15 minutos."
- **Éxito:** Redirección al Dashboard.

### 7.2 Pantalla: Dashboard (/)

**Objetivo:** Vista general del estado del negocio adaptada al rol del usuario.

**Layout:** Grid responsivo de tarjetas (cards).

**Contenido para Admin:**
- Tarjeta "Ventas Hoy": monto total de ventas del día en todas las tiendas, con comparativa vs ayer (↑12%).
- Tarjeta "Ventas por Tienda": mini gráfico de barras con ventas del día por tienda.
- Tarjeta "Productos Activos": conteo total de productos activos.
- Tarjeta "Alertas de Stock": conteo de alertas activas con enlace a la lista.
- Tarjeta "Últimas Ventas": tabla con las 5 ventas más recientes (ticket, tienda, monto, hora).
- Tarjeta "Últimos Movimientos de Stock": tabla con los 5 movimientos más recientes.

**Contenido para Gerente:**
- Igual que Admin pero filtrado a su tienda.
- Tarjeta adicional "Vendedores Activos": lista de vendedores conectados en su tienda.

**Contenido para Vendedor:**
- Tarjeta "Mis Ventas Hoy": conteo y monto total de sus ventas del día.
- Tarjeta "Acceso Rápido POS": botón grande para ir al POS.
- Tarjeta "Últimas Ventas": sus 5 ventas más recientes.

### 7.3 Pantalla: POS - Punto de Venta (/pos)

**Objetivo:** Interfaz principal de venta optimizada para velocidad y uso táctil.

**Layout:** Dos columnas en tablet/desktop; una columna con tabs en móvil.

**Columna Izquierda (60%) — Búsqueda y Productos:**
- Barra de búsqueda grande (altura 56px) con icono de lupa y botón de cámara (escaneo de código de barras).
- Debajo: grid de resultados de búsqueda como tarjetas compactas:
  - Cada tarjeta: miniatura del producto (60x60px), nombre, precio, badge de stock.
  - Al tocar una tarjeta: modal/drawer con selector de variante (talla/color) y botón "Agregar al carrito".
- Si no hay búsqueda activa: mostrar "Productos frecuentes" (los 8 más vendidos en esa tienda).

**Columna Derecha (40%) — Carrito:**
- Encabezado: "Carrito" con badge de cantidad de items.
- Lista de líneas del carrito:
  - Cada línea: nombre corto, variante (T27-NEG), controles +/- de cantidad, precio unitario, subtotal, botón eliminar (X).
- Sección de descuento: botón "Aplicar Descuento" que abre un modal con opciones: % o monto fijo, a nivel de línea o carrito.
- Resumen:
  - Subtotal: $X,XXX.XX
  - Descuento: -$XXX.XX
  - IVA (16%): $XXX.XX
  - **Total: $X,XXX.XX** (fuente grande, negrita)
- Selector de método de pago: botones tipo toggle (Efectivo | Tarjeta | Otro).
- Si Efectivo: campo "Monto recibido" y cálculo automático de cambio.
- Botón "Confirmar Venta" (verde, grande, ancho completo, altura 56px).
- Botón "Cancelar" (rojo outline, debajo).

**Estados:**
- **Carrito vacío:** Mensaje "Busca un producto para comenzar" con icono ilustrativo.
- **Procesando venta:** Overlay con spinner y texto "Procesando venta...".
- **Venta exitosa:** Modal de confirmación con número de ticket, opción de reimprimir, botón "Nueva Venta".
- **Error de stock:** Modal con lista de variantes sin stock suficiente y opciones de ajuste.
- **Error de impresión:** Modal con opciones: reintentar, otra impresora, guardar para después.

### 7.4 Pantalla: Detalle de Producto (/catalogo/productos/:id)

**Objetivo:** Mostrar toda la información de un producto con galería de fotos y tabla de variantes.

**Layout:** Dos columnas en desktop; una columna scrollable en móvil.

**Columna Izquierda — Galería:**
- Imagen principal grande (400x400px en desktop, ancho completo en móvil).
- Fila de miniaturas debajo (60x60px cada una, scrollable horizontal).
- Al tocar una miniatura: se muestra como imagen principal.
- Soporte para zoom al tocar/pinch en móvil.

**Columna Derecha — Información:**
- Nombre del producto (H1).
- Marca y Categoría (badges/tags).
- Precio: "$1,200.00 MXN" (fuente grande).
- Estado: badge "Activo" (verde) o "Inactivo" (gris).
- Descripción: texto enriquecido expandible (mostrar primeros 200 caracteres con "Ver más").
- SKU base, Código de barras (si existe).

**Sección Variantes (ancho completo, debajo):**
- Tabla responsiva:
  | Talla | Color | SKU | Código Barras | Precio | Stock Centro | Stock Norte | Stock Sur | Total |
  |-------|-------|-----|---------------|--------|-------------|-------------|-----------|-------|
  | 26 | Negro | OXF-CLX-26-NEG | 7501234567890 | $1,200 | 5 | 3 | 2 | 10 |
  | 26 | Café | OXF-CLX-26-CAF | — | $1,200 | 3 | 2 | 1 | 6 |
- Nota: columnas de stock filtradas según permisos (Vendedor solo ve su tienda).
- Celdas de stock con color: verde (>umbral), amarillo (=umbral), rojo (<umbral).

**Acciones (solo Admin):**
- Botón "Editar Producto" (arriba derecha).
- Botón "Desactivar" / "Activar".

### 7.5 Pantalla: Crear/Editar Producto (/catalogo/productos/nuevo)

**Objetivo:** Formulario completo para crear o editar un producto con sus variantes.

**Layout:** Formulario en secciones con tabs o acordeón.

**Sección 1 — Información Base:**
- Campo "Nombre" (text, requerido, máx. 200 chars).
- Campo "Marca" (select con búsqueda, requerido).
- Campo "Categoría" (select con búsqueda, requerido).
- Campo "Descripción" (textarea con editor de texto enriquecido, máx. 5000 chars).
- Campo "Precio Base" (number, requerido, formato moneda).
- Campo "Costo" (number, requerido, formato moneda).
- Campo "Tasa de IVA" (select: 16%, 8%, 0%, o personalizado).
- Toggle "Producto Activo" (switch, default: activo).

**Sección 2 — Fotos:**
- Zona de drag & drop para subir fotos (máx. 10, máx. 5MB cada una).
- Preview de fotos subidas con opción de reordenar (drag), eliminar, y marcar como principal.
- Indicador de progreso de subida.

**Sección 3 — Variantes:**
- Selector múltiple de tallas (checkboxes o chips seleccionables).
- Selector múltiple de colores (chips con muestra de color).
- Botón "Generar Variantes" que crea la matriz de combinaciones.
- Tabla editable de variantes generadas:
  | Talla | Color | SKU (auto) | Código Barras | Sobreprecio | Activa |
  - SKU se genera automáticamente pero es editable.
  - Código de barras es opcional.
  - Sobreprecio permite ajustar precio por variante (+$50, -$30, etc.).

**Sección 4 — Stock Inicial (solo en creación):**
- Tabla por variante y tienda para ingresar stock inicial:
  | Variante | Centro | Norte | Sur |
  | 26-NEG | [input] | [input] | [input] |

**Acciones:**
- Botón "Guardar" (primario).
- Botón "Guardar y Crear Otro" (secundario).
- Botón "Cancelar" (outline).

### 7.6 Pantalla: Stock Actual (/inventario/stock)

**Objetivo:** Vista consolidada del stock de todos los productos por tienda.

**Filtros (barra superior):**
- Tienda (select: Todas / Centro / Norte / Sur — según permisos).
- Categoría (select).
- Marca (select).
- Estado de stock (select: Todos / Normal / Bajo / Agotado).
- Búsqueda por nombre/SKU.

**Tabla principal:**
| Producto | Variante | SKU | Centro | Norte | Sur | Total | Estado |
|----------|----------|-----|--------|-------|-----|-------|--------|
| Oxford Classic | 26-NEG | OXF-CLX-26-NEG | 5 | 3 | 2 | 10 | 🟢 Normal |
| Oxford Classic | 27-NEG | OXF-CLX-27-NEG | 1 | 0 | 2 | 3 | 🟡 Bajo |
| Sandalia Verano | 25-ROJ | SAN-VER-25-ROJ | 0 | 0 | 0 | 0 | 🔴 Agotado |

**Acciones:**
- Botón "Exportar CSV".
- Click en fila → navega al kardex de esa variante.

### 7.7 Pantalla: Kardex / Historial de Movimientos (/inventario/movimientos)

**Objetivo:** Historial detallado de movimientos de stock para una variante en una tienda.

**Filtros:**
- Producto/Variante (búsqueda).
- Tienda (select).
- Tipo de movimiento (multi-select: Entrada, Venta, Devolución, Ajuste, Transferencia).
- Rango de fechas.

**Tabla:**
| Fecha/Hora | Tipo | Referencia | Cantidad | Stock Anterior | Stock Posterior | Usuario | Nota |
|------------|------|-----------|----------|---------------|----------------|---------|------|
| 15/03 16:45 | Devolución | DEV-TC-2024-000142-01 | +1 | 7 | 8 | Luis | Defecto fábrica |
| 15/03 14:32 | Venta | TC-2024-000142 | -1 | 8 | 7 | Luis | — |
| 14/03 10:00 | Transferencia Entrada | TRF-2024-000023 | +2 | 6 | 8 | María | Desde Centro |

**Acciones:**
- Botón "Exportar CSV".
- Paginación: 50 registros por página.

### 7.8 Pantalla: Nueva Devolución (/ventas/devoluciones/nueva)

**Objetivo:** Procesar una devolución referenciando la venta original.

**Paso 1 — Buscar Venta:**
- Campo de búsqueda: "Número de ticket o fecha".
- Resultados: lista de ventas coincidentes con: ticket, fecha, monto, tienda.

**Paso 2 — Seleccionar Artículos:**
- Detalle de la venta seleccionada.
- Checkboxes por línea para seleccionar artículos a devolver.
- Campo de cantidad por línea (si se devuelve parcialmente).

**Paso 3 — Motivo y Confirmación:**
- Select "Motivo de devolución" (requerido).
- Textarea "Nota adicional" (requerido si motivo = "Otro").
- Resumen de reembolso calculado.
- Botón "Confirmar Devolución".

---

## 8. Modelo de Datos (ERD Textual)

### 8.1 Entidades y Campos Clave
#### Entidad: Store (Tienda)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| name | VARCHAR(100) | NOT NULL, UNIQUE | Nombre de la tienda |
| code | VARCHAR(10) | NOT NULL, UNIQUE | Prefijo para tickets (TC, TN, TS) |
| address | VARCHAR(500) | NOT NULL | Direccion completa |
| phone | VARCHAR(20) | | Telefono de contacto |
| tax_id | VARCHAR(20) | | RFC/NIF de la tienda |
| logo_url | VARCHAR(500) | | URL del logo para tickets |
| return_policy_text | TEXT | | Texto de politica de devolucion para tickets |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Estado activo/inactivo |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion |
| updated_at | TIMESTAMP | NOT NULL | Fecha de ultima modificacion |

**Indices:** UNIQUE(code), INDEX(is_active)

#### Entidad: User (Usuario)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Correo electronico |
| password_hash | VARCHAR(255) | NOT NULL | Hash bcrypt de la contrasena |
| full_name | VARCHAR(200) | NOT NULL | Nombre completo |
| role | ENUM | NOT NULL | admin, manager, seller |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Estado activo/inactivo |
| failed_login_attempts | INT | NOT NULL, DEFAULT 0 | Intentos fallidos consecutivos |
| locked_until | TIMESTAMP | NULLABLE | Fecha hasta la que esta bloqueado |
| last_login_at | TIMESTAMP | NULLABLE | Ultimo inicio de sesion |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion |
| updated_at | TIMESTAMP | NOT NULL | Fecha de ultima modificacion |

**Indices:** UNIQUE(email), INDEX(role), INDEX(is_active)

#### Entidad: UserStore (Asignacion Usuario-Tienda)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| user_id | UUID | FK -> User, NOT NULL | Referencia al usuario |
| store_id | UUID | FK -> Store, NOT NULL | Referencia a la tienda |
| created_at | TIMESTAMP | NOT NULL | Fecha de asignacion |

**Indices:** UNIQUE(user_id, store_id)

#### Entidad: Category (Categoria)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| name | VARCHAR(100) | NOT NULL, UNIQUE | Nombre de la categoria |
| description | VARCHAR(500) | | Descripcion |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Estado |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion |

**Indices:** UNIQUE(name)

#### Entidad: Brand (Marca)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| name | VARCHAR(100) | NOT NULL, UNIQUE | Nombre de la marca |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Estado |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion |

**Indices:** UNIQUE(name)

#### Entidad: Product (Producto)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| name | VARCHAR(200) | NOT NULL | Nombre del producto |
| brand_id | UUID | FK -> Brand, NOT NULL | Marca |
| category_id | UUID | FK -> Category, NOT NULL | Categoria |
| description | TEXT | | Descripcion enriquecida (max 5000 chars) |
| base_price | DECIMAL(10,2) | NOT NULL, CHECK >= 0 | Precio base |
| cost | DECIMAL(10,2) | NOT NULL, CHECK >= 0 | Costo |
| tax_rate | DECIMAL(5,4) | NOT NULL, DEFAULT 0.16 | Tasa de impuesto (0.16 = 16%) |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Estado activo/inactivo |
| created_by | UUID | FK -> User, NOT NULL | Usuario que creo el producto |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion |
| updated_at | TIMESTAMP | NOT NULL | Fecha de ultima modificacion |

**Indices:** INDEX(brand_id), INDEX(category_id), INDEX(is_active), FULLTEXT(name)

#### Entidad: ProductImage (Imagen de Producto)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| product_id | UUID | FK -> Product, NOT NULL | Producto asociado |
| color | VARCHAR(50) | NULLABLE | Color asociado (null = todas las variantes) |
| image_url | VARCHAR(500) | NOT NULL | URL de la imagen original |
| thumbnail_url | VARCHAR(500) | NOT NULL | URL de la miniatura 200x200 |
| optimized_url | VARCHAR(500) | NOT NULL | URL de la imagen optimizada 800x800 |
| sort_order | INT | NOT NULL, DEFAULT 0 | Orden de visualizacion |
| is_primary | BOOLEAN | NOT NULL, DEFAULT false | Es la imagen principal |
| created_at | TIMESTAMP | NOT NULL | Fecha de subida |

**Indices:** INDEX(product_id), INDEX(product_id, color)

#### Entidad: Size (Talla)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| value | VARCHAR(10) | NOT NULL, UNIQUE | Valor de la talla (22, 22.5, 23...) |
| sort_order | INT | NOT NULL | Orden de visualizacion |

#### Entidad: Color

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| name | VARCHAR(50) | NOT NULL, UNIQUE | Nombre del color |
| hex_code | VARCHAR(7) | | Codigo hexadecimal (#000000) |
| sort_order | INT | NOT NULL | Orden de visualizacion |

#### Entidad: ProductVariant (Variante de Producto)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| product_id | UUID | FK -> Product, NOT NULL | Producto padre |
| size_id | UUID | FK -> Size, NOT NULL | Talla |
| color_id | UUID | FK -> Color, NOT NULL | Color |
| sku | VARCHAR(50) | NOT NULL, UNIQUE | SKU unico generado |
| barcode | VARCHAR(20) | UNIQUE, NULLABLE | Codigo de barras EAN-13/UPC-A |
| price_override | DECIMAL(10,2) | NULLABLE | Sobreprecio (null = usa precio base) |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Estado |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion |
| updated_at | TIMESTAMP | NOT NULL | Fecha de ultima modificacion |

**Indices:** UNIQUE(product_id, size_id, color_id), UNIQUE(sku), UNIQUE(barcode), INDEX(product_id)

#### Entidad: StockLevel (Nivel de Stock)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| variant_id | UUID | FK -> ProductVariant, NOT NULL | Variante |
| store_id | UUID | FK -> Store, NOT NULL | Tienda |
| quantity | INT | NOT NULL, CHECK >= 0 | Cantidad en stock |
| low_stock_threshold | INT | NOT NULL, DEFAULT 5 | Umbral de stock bajo |
| updated_at | TIMESTAMP | NOT NULL | Ultima actualizacion |

**Indices:** UNIQUE(variant_id, store_id), INDEX(store_id), INDEX(quantity)

#### Entidad: StockMovement (Movimiento de Stock)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| variant_id | UUID | FK -> ProductVariant, NOT NULL | Variante afectada |
| store_id | UUID | FK -> Store, NOT NULL | Tienda |
| movement_type | ENUM | NOT NULL | entry, sale, return, adjustment, transfer_out, transfer_in |
| quantity | INT | NOT NULL | Cantidad (positiva o negativa) |
| stock_before | INT | NOT NULL | Stock antes del movimiento |
| stock_after | INT | NOT NULL | Stock despues del movimiento |
| reference_type | VARCHAR(50) | | Tipo de documento origen (sale, return, transfer, adjustment) |
| reference_id | UUID | | ID del documento origen |
| note | TEXT | | Nota descriptiva |
| user_id | UUID | FK -> User, NOT NULL | Usuario que realizo la accion |
| created_at | TIMESTAMP | NOT NULL | Fecha y hora del movimiento |

**Indices:** INDEX(variant_id, store_id), INDEX(movement_type), INDEX(reference_type, reference_id), INDEX(created_at), INDEX(user_id)

#### Entidad: StockTransfer (Transferencia de Stock)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| transfer_number | VARCHAR(20) | NOT NULL, UNIQUE | Numero TRF-YYYY-NNNNNN |
| source_store_id | UUID | FK -> Store, NOT NULL | Tienda origen |
| destination_store_id | UUID | FK -> Store, NOT NULL | Tienda destino |
| status | ENUM | NOT NULL, DEFAULT pending | pending, confirmed, cancelled |
| note | TEXT | | Nota |
| created_by | UUID | FK -> User, NOT NULL | Usuario que creo la transferencia |
| confirmed_at | TIMESTAMP | NULLABLE | Fecha de confirmacion |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion |

**Indices:** UNIQUE(transfer_number), INDEX(source_store_id), INDEX(destination_store_id), INDEX(status)

#### Entidad: TransferLine (Linea de Transferencia)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| transfer_id | UUID | FK -> StockTransfer, NOT NULL | Transferencia padre |
| variant_id | UUID | FK -> ProductVariant, NOT NULL | Variante transferida |
| quantity | INT | NOT NULL, CHECK > 0 | Cantidad transferida |

**Indices:** INDEX(transfer_id)

#### Entidad: StockAdjustment (Ajuste de Stock)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| variant_id | UUID | FK -> ProductVariant, NOT NULL | Variante ajustada |
| store_id | UUID | FK -> Store, NOT NULL | Tienda |
| quantity_before | INT | NOT NULL | Cantidad antes del ajuste |
| quantity_after | INT | NOT NULL | Cantidad despues del ajuste |
| reason | ENUM | NOT NULL | physical_count, damage, theft_loss, system_error, other |
| note | TEXT | NOT NULL | Nota descriptiva obligatoria |
| adjusted_by | UUID | FK -> User, NOT NULL | Usuario que realizo el ajuste |
| created_at | TIMESTAMP | NOT NULL | Fecha del ajuste |

**Indices:** INDEX(variant_id, store_id), INDEX(adjusted_by), INDEX(created_at)

#### Entidad: Sale (Venta)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| ticket_number | VARCHAR(20) | NOT NULL, UNIQUE | Numero de ticket TC-YYYY-NNNNNN |
| store_id | UUID | FK -> Store, NOT NULL | Tienda donde se realizo la venta |
| seller_id | UUID | FK -> User, NOT NULL | Vendedor |
| subtotal | DECIMAL(10,2) | NOT NULL | Subtotal antes de descuentos e impuestos |
| discount_amount | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Monto total de descuento |
| discount_type | ENUM | NULLABLE | percentage, fixed_amount |
| discount_value | DECIMAL(10,2) | NULLABLE | Valor del descuento (% o monto) |
| tax_amount | DECIMAL(10,2) | NOT NULL | Monto total de impuestos |
| total | DECIMAL(10,2) | NOT NULL | Total final |
| status | ENUM | NOT NULL, DEFAULT completed | completed, voided |
| voided_by | UUID | FK -> User, NULLABLE | Usuario que anulo la venta |
| voided_at | TIMESTAMP | NULLABLE | Fecha de anulacion |
| void_reason | TEXT | NULLABLE | Motivo de anulacion |
| created_at | TIMESTAMP | NOT NULL | Fecha y hora de la venta |

**Indices:** UNIQUE(ticket_number), INDEX(store_id), INDEX(seller_id), INDEX(created_at), INDEX(status)

#### Entidad: SaleLine (Linea de Venta)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| sale_id | UUID | FK -> Sale, NOT NULL | Venta padre |
| variant_id | UUID | FK -> ProductVariant, NOT NULL | Variante vendida |
| product_name | VARCHAR(200) | NOT NULL | Nombre del producto (snapshot) |
| variant_description | VARCHAR(100) | NOT NULL | Descripcion de variante (snapshot: "T27-Negro") |
| quantity | INT | NOT NULL, CHECK > 0 | Cantidad vendida |
| unit_price | DECIMAL(10,2) | NOT NULL | Precio unitario al momento de la venta |
| line_discount | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Descuento aplicado a esta linea |
| tax_rate | DECIMAL(5,4) | NOT NULL | Tasa de impuesto aplicada |
| line_subtotal | DECIMAL(10,2) | NOT NULL | Subtotal de la linea |
| line_tax | DECIMAL(10,2) | NOT NULL | Impuesto de la linea |
| line_total | DECIMAL(10,2) | NOT NULL | Total de la linea |

**Indices:** INDEX(sale_id), INDEX(variant_id)

#### Entidad: SalePayment (Pago de Venta)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| sale_id | UUID | FK -> Sale, NOT NULL | Venta asociada |
| payment_method_id | UUID | FK -> PaymentMethod, NOT NULL | Metodo de pago |
| amount | DECIMAL(10,2) | NOT NULL | Monto pagado con este metodo |
| amount_received | DECIMAL(10,2) | NULLABLE | Monto recibido (para efectivo) |
| change_amount | DECIMAL(10,2) | NULLABLE | Cambio devuelto (para efectivo) |

**Indices:** INDEX(sale_id)

#### Entidad: PaymentMethod (Metodo de Pago)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| name | VARCHAR(50) | NOT NULL, UNIQUE | Nombre (Efectivo, Tarjeta Credito, etc.) |
| icon | VARCHAR(50) | | Nombre del icono |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Estado |
| sort_order | INT | NOT NULL, DEFAULT 0 | Orden de visualizacion |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion |

#### Entidad: Return (Devolucion)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| return_number | VARCHAR(30) | NOT NULL, UNIQUE | Numero DEV-{TICKET}-{SEQ} |
| original_sale_id | UUID | FK -> Sale, NOT NULL | Venta original |
| store_id | UUID | FK -> Store, NOT NULL | Tienda donde se procesa |
| processed_by | UUID | FK -> User, NOT NULL | Vendedor que procesa |
| approved_by | UUID | FK -> User, NULLABLE | Gerente que aprobo (si requirio aprobacion) |
| reason | ENUM | NOT NULL | factory_defect, wrong_size, unsatisfied, transport_damage, other |
| reason_note | TEXT | | Nota adicional del motivo |
| refund_amount | DECIMAL(10,2) | NOT NULL | Monto total de reembolso |
| status | ENUM | NOT NULL | completed, cancelled |
| created_at | TIMESTAMP | NOT NULL | Fecha de la devolucion |

**Indices:** UNIQUE(return_number), INDEX(original_sale_id), INDEX(store_id), INDEX(created_at)

#### Entidad: ReturnLine (Linea de Devolucion)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| return_id | UUID | FK -> Return, NOT NULL | Devolucion padre |
| sale_line_id | UUID | FK -> SaleLine, NOT NULL | Linea de venta original |
| variant_id | UUID | FK -> ProductVariant, NOT NULL | Variante devuelta |
| quantity | INT | NOT NULL, CHECK > 0 | Cantidad devuelta |
| refund_amount | DECIMAL(10,2) | NOT NULL | Monto de reembolso de esta linea |

**Indices:** INDEX(return_id)

#### Entidad: StockAlert (Alerta de Stock)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| variant_id | UUID | FK -> ProductVariant, NOT NULL | Variante |
| store_id | UUID | FK -> Store, NOT NULL | Tienda |
| current_stock | INT | NOT NULL | Stock al momento de la alerta |
| threshold | INT | NOT NULL | Umbral configurado |
| status | ENUM | NOT NULL, DEFAULT active | active, acknowledged |
| acknowledged_by | UUID | FK -> User, NULLABLE | Usuario que atendio la alerta |
| acknowledged_note | TEXT | NULLABLE | Nota al atender |
| acknowledged_at | TIMESTAMP | NULLABLE | Fecha de atencion |
| created_at | TIMESTAMP | NOT NULL | Fecha de creacion de la alerta |

**Indices:** INDEX(store_id, status), INDEX(variant_id)

#### Entidad: AuditLog (Registro de Auditoria)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| user_id | UUID | FK -> User, NULLABLE | Usuario (null para acciones del sistema) |
| action_type | VARCHAR(50) | NOT NULL | Tipo de accion (product.create, stock.adjust, sale.create, etc.) |
| entity_type | VARCHAR(50) | NOT NULL | Tipo de entidad afectada |
| entity_id | UUID | NOT NULL | ID de la entidad afectada |
| store_id | UUID | FK -> Store, NULLABLE | Tienda asociada |
| old_values | JSONB | NULLABLE | Valores anteriores (para ediciones) |
| new_values | JSONB | NULLABLE | Valores nuevos |
| ip_address | VARCHAR(45) | | Direccion IP del cliente |
| user_agent | VARCHAR(500) | | User-Agent del navegador |
| created_at | TIMESTAMP | NOT NULL | Fecha y hora del evento |

**Indices:** INDEX(user_id), INDEX(action_type), INDEX(entity_type, entity_id), INDEX(store_id), INDEX(created_at)

#### Entidad: TicketSequence (Secuencia de Tickets)

| Campo | Tipo | Restricciones | Descripcion |
|-------|------|---------------|-------------|
| id | UUID | PK | Identificador unico |
| store_id | UUID | FK -> Store, NOT NULL | Tienda |
| year | INT | NOT NULL | Ano |
| last_sequence | INT | NOT NULL, DEFAULT 0 | Ultimo numero secuencial usado |

**Indices:** UNIQUE(store_id, year)

### 8.2 Diagrama de Relaciones

```
Store 1N UserStore N1 User
Store 1N StockLevel N1 ProductVariant
Store 1N Sale
Store 1N StockMovement
Store 1N StockTransfer (source/destination)
Store 1N StockAlert
Store 1N TicketSequence

Product 1N ProductVariant
Product 1N ProductImage
Product N1 Brand
Product N1 Category
Product N1 User (created_by)

ProductVariant N1 Size
ProductVariant N1 Color
ProductVariant 1N StockLevel
ProductVariant 1N StockMovement
ProductVariant 1N SaleLine
ProductVariant 1N ReturnLine

Sale 1N SaleLine
Sale 1N SalePayment
Sale 1N Return
Sale N1 User (seller)
Sale N1 Store

SalePayment N1 PaymentMethod

Return 1N ReturnLine
Return N1 Sale (original)
Return N1 User (processed_by)

StockTransfer 1N TransferLine
StockTransfer N1 Store (source)
StockTransfer N1 Store (destination)
```
