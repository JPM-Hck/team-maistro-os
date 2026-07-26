# Team Maistro OS

Sistema web para conectar tareas, inventario, compras y recursos de una empresa de remodelaciones.

## Checkpoints implementados

La primera entrega demuestra el flujo completo de planeación de una tarea:

1. Carga una tarea de 20 m² de mármol.
2. Calcula materiales usando receta, consumo y merma.
3. Descuenta reservas activas y stock de seguridad.
4. Detecta el faltante de mármol y genera una requisición.
5. Registra la recepción de la compra.
6. Revalida el inventario dentro de una operación transaccional.
7. Reserva materiales y cambia la tarea a `ready`.

La migración de Supabase implementa el mismo flujo para datos persistentes y evita reservas dobles con bloqueo
de filas e idempotencia.

La operación persistente agrega:

- CRUD de proyectos con baja lógica.
- Trabajadores, tarifas históricas y asignaciones sin traslapes.
- Catálogo de inventario, movimientos auditables y uso por proyecto.
- Asistencia diaria con aprobación.
- Nómina semanal con tarifas por hora, día o semana y cierre inmutable.

Cuando Supabase está configurado, el dashboard exige autenticación y no recurre silenciosamente a datos
temporales. Los trabajadores de nómina son registros operativos independientes de las cuentas que inician sesión.

## Cálculo demostrable

Para 20 m²:

- Mármol: `20 × 1 × (1 + 0.08) = 21.60 m²`
- Adhesivo: `20 × 0.25 = 5 bultos`
- Boquilla: `20 × 0.04 = 0.80 kg`

El stock disponible se calcula como:

```text
disponible = existencia física - reservas activas - stock de seguridad
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS y CSS responsive
- Supabase Auth + PostgreSQL + Row Level Security
- Vitest para reglas de dominio
- Vercel como objetivo de despliegue cuando el MVP sea estable

## Arquitectura

```text
src/app              páginas, estilos y autenticación
src/components       interfaz interactiva del flujo
src/domain           reglas puras, tipos, fórmulas y pruebas
src/infrastructure   adaptadores hacia Supabase
src/lib/supabase     clientes browser/server y renovación de sesión
supabase             migración, RLS, función transaccional y datos demo
```

Las fórmulas no viven en componentes. La función `planTask` puede probarse sin navegador y la operación
`reserve_task_materials` repite las validaciones en PostgreSQL antes de modificar inventario.

## Ejecutar localmente

Requisitos: Node.js 20.9 o superior y pnpm mediante Corepack.

```bash
corepack pnpm install
corepack pnpm test
corepack pnpm dev
```

Sin variables de Supabase, la página principal muestra una guía de configuración. Con Supabase conectado,
`/login` autentica al usuario y el dashboard carga información real protegida por RLS.

## Conectar Supabase

1. Crear un proyecto vacío en Supabase.
2. Copiar `.env.example` a `.env.local`.
3. Agregar la URL y publishable key.
4. Ejecutar, en orden, todas las migraciones de `supabase/migrations`.
5. Cargar `supabase/seed.sql` en un entorno de desarrollo.
6. Crear el primer usuario en Supabase Auth.
7. Insertar su `id` en `profiles` con rol `administrator`.
8. Copiar las dos variables públicas al entorno de Vercel y volver a desplegar.

Variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

La service role nunca debe exponerse al navegador ni subirse al repositorio.

## Roles iniciales

- `administrator`: configuración, aprobación y auditoría.
- `supervisor`: proyectos, tareas y responsables.
- `warehouse`: inventario, recepciones y requisiciones.

RLS valida permisos en la base; ocultar un botón no se considera autorización.

Los salarios y la nómina viven en tablas separadas del trabajador. Solo `administrator` puede consultarlos.
Supervisión gestiona proyectos, asignaciones y asistencias; almacén registra movimientos sin acceder a salarios.

## Pruebas cubiertas

- Cantidad cero.
- Receta de mármol a dos decimales.
- Faltante y requisición automática.
- Compra parcial.
- Compra completa y reserva.
- Idempotencia para impedir reservas dobles.
- Herramienta crítica no disponible.
- Dependencia circular.
- Fechas de proyecto y asignación inválidas.
- Traslapes de asignaciones y tarifas.
- Salidas que comprometen reservas o stock de seguridad.
- Asistencia incompleta o no aprobada.
- Cambio de tarifa dentro de una misma semana.
- Horas extra al doble y nómina no negativa.

## Uso responsable de IA

La IA ayudó a estructurar la interfaz y los casos de prueba. La propuesta se corrigió para:

- mantener las fórmulas fuera de React;
- revalidar inventario dentro de PostgreSQL;
- usar una clave de idempotencia;
- conservar stock de seguridad;
- impedir que una compra pendiente continúe sin volver a verificar existencias.

## Siguientes checkpoints

1. Conectar y validar el proyecto real de Supabase.
2. Completar herramientas, asignaciones y cronograma topológico.
3. Cerrar tareas con calidad, costos y productividad.
4. Ejecutar QA académico final.
