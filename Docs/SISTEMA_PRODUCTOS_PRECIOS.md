# 📱 Sistema Escalable de Productos y Precios

## 🎯 Visión General

El nuevo sistema permite:
- ✅ Crear productos dinámicamente en la BD
- ✅ Agregar múltiples variantes (tamaños, sabores) con precios diferentes
- ✅ Categorizar productos (Pizzas, Bebidas, Extras, etc.)
- ✅ Mostrar menú en tiempo real desde la BD
- ✅ Cambiar precios sin tocar código

## 🏗️ Estructura de Base de Datos

```
┌─────────────────┐
│   productos     │
├─────────────────┤
│ productoId (PK) │
│ productoNombre  │ ← Pizza Paisa
│ categoria       │ ← "Pizzas"
│ descripcion     │
│ activo          │
└─────────────────┘
         │
         │ 1:N
         ↓
┌──────────────────────────┐
│  producto_variantes      │
├──────────────────────────┤
│ varianteId (PK)          │
│ productoId (FK)          │
│ nombre                   │ ← "Pequeña", "Mediana", "Grande"
│ precio                   │ ← 15000, 28000, 40000
│ descripcion              │
│ activo                   │
└──────────────────────────┘
```

## 🚀 Backend API Endpoints

### Productos

#### Obtener todas las categorías
```bash
GET /productos/categorias
→ ["Pizzas", "Bebidas", "Extras", "Hamburguesas"]
```

#### Obtener todos los productos
```bash
GET /productos
GET /productos?categoria=Pizzas
GET /productos?activo=true
```

**Respuesta:**
```json
[
  {
    "productoId": 1,
    "productoNombre": "Pizza Paisa",
    "categoria": "Pizzas",
    "descripcion": "Pizza con carnes y salsas colombianas",
    "activo": true,
    "variantes": [
      {
        "varianteId": 1,
        "nombre": "Pequeña",
        "precio": 15000,
        "descripcion": "Pizza pequeña",
        "activo": true
      },
      {
        "varianteId": 2,
        "nombre": "Mediana",
        "precio": 28000,
        "descripcion": "Pizza mediana",
        "activo": true
      }
    ]
  }
]
```

#### Obtener producto específico
```bash
GET /productos/:id
GET /productos/1
```

#### Obtener variantes de un producto
```bash
GET /productos/:id/variantes
GET /productos/1/variantes
```

#### Crear producto con variantes
```bash
POST /productos
```

**Body:**
```json
{
  "productoNombre": "Pizza Hawaiana",
  "categoria": "Pizzas",
  "descripcion": "Pizza con piña y jamón",
  "activo": true,
  "variantes": [
    {
      "nombre": "Pequeña",
      "precio": 15000,
      "descripcion": "Pizza pequeña"
    },
    {
      "nombre": "Mediana",
      "precio": 28000,
      "descripcion": "Pizza mediana"
    }
  ]
}
```

#### Agregar variante a producto existente
```bash
POST /productos/:id/variantes
```

**Body:**
```json
{
  "nombre": "Extra Grande",
  "precio": 50000,
  "descripcion": "Pizza extra grande"
}
```

#### Actualizar producto
```bash
PATCH /productos/:id
```

**Body:**
```json
{
  "descripcion": "Nueva descripción",
  "activo": false
}
```

#### Eliminar producto (y sus variantes)
```bash
DELETE /productos/:id
```

## 📱 Frontend Hooks

### `useProductos()`
```typescript
const { productos, loading, error, fetchProductos } = useProductos();

// Obtener productos de una categoría
await fetchProductos('Pizzas', true);

// Resultado: Producto[] con variantes
```

### `useProductosPorCategoria()`
```typescript
const { categorias, loading, error, fetchCategorias } = useProductosPorCategoria();

await fetchCategorias();
// categorias: ["Pizzas", "Bebidas", "Extras"]
```

### `useProductoVariantes(productoId)`
```typescript
const { variantes, loading, error, fetchVariantes } = useProductoVariantes(1);

await fetchVariantes();
// variantes: ProductoVariante[]
```

## 🎨 Componentes Frontend

### Menu Component
Componente completo para mostrar menú con categorías, productos y variantes.

```tsx
import { Menu } from '../components/Menu';

<Menu
  onSelectItem={(producto, variante, cantidad) => {
    console.log(`Agregar ${cantidad}x ${producto.productoNombre} - ${variante.nombre}`);
  }}
/>
```

### ProductSelector Component
Selector individual de productos con variantes.

```tsx
import { ProductSelector } from '../components/ProductSelector';

<ProductSelector
  categoria="Pizzas"
  onSelect={(producto, variante) => {
    console.log(variante.precio);
  }}
/>
```

## 🌱 Seed Inicial de Datos

### Opción 1: Usar el seed script
```bash
# En Backend
npm run seed
```

Esto crea automáticamente:
- Pizzas (Paisa, Hawaiana, Vegetariana) con 3 tamaños cada una
- Bebidas (Coca-Cola, Sprite, Jugo) con variantes
- Extras (Alitas, Papas)
- Hamburguesas con variantes

### Opción 2: Crear manualmente con POST
```bash
curl -X POST http://localhost:3000/productos \
  -H "Content-Type: application/json" \
  -d '{
    "productoNombre": "Pizza Pepperoni",
    "categoria": "Pizzas",
    "descripcion": "Clásica pizza de pepperoni",
    "variantes": [
      {"nombre": "Pequeña", "precio": 15000},
      {"nombre": "Mediana", "precio": 28000},
      {"nombre": "Grande", "precio": 40000}
    ]
  }'
```

## 📝 Crear Orden con Variantes

### Payload antiguo (legacy):
```json
{
  "tipoPedido": "mesa",
  "productos": [
    {
      "tipo": "Pizza",
      "tamano": "grande",
      "sabor1": "paisa",
      "cantidad": 1
    }
  ]
}
```

### Payload nuevo (recomendado):
```json
{
  "tipoPedido": "mesa",
  "productos": [
    {
      "tipo": "Pizza",
      "productoId": 1,
      "varianteId": 3,
      "cantidad": 1
    }
  ]
}
```

## 🔄 Flujo Completo de Uso

1. **Frontend** obtiene categorías: `GET /productos/categorias`
2. **Frontend** obtiene productos por categoría: `GET /productos?categoria=Pizzas`
3. **Usuario** selecciona un producto y variante con cantidad
4. **Frontend** crea orden con `varianteId`: `POST /ordenes`
5. **Backend** busca la variante, obtiene precio dinámicamente
6. **Orden** se guarda con referencia a variante

## 💡 Ventajas del Nuevo Sistema

| Aspecto | Antiguo | Nuevo |
|---------|---------|-------|
| Precios | Hardcodeados en código | En BD, actualizables en tiempo real |
| Productos | Fijos en DTO | Dinámicos, agregables sin redeploy |
| Categorías | No existen | Organizadas por categoría |
| Variantes | Solo tamaño de pizza | Múltiples variantes por producto |
| Escalabilidad | Limitada | Ilimitada |
| Cambio de precios | Requiere redeploy | Actualización instantánea |

## 📊 Ejemplo de Menú Dinámico

```
┌─────────────────────────────────────────┐
│  🍕 MENU                                │
├─────────────────────────────────────────┤
│ [Todos] [Pizzas] [Bebidas] [Extras]     │
├─────────────────────────────────────────┤
│ Pizza Paisa                             │
│ Deliciosa pizza con carnes              │
│  ├─ Pequeña (15,000)        [+] [-] ✓  │
│  ├─ Mediana (28,000)        [+] [-] ✓  │
│  └─ Grande (40,000)         [+] [-] ✓  │
│                                         │
│ Pizza Hawaiana                          │
│ Pizza con piña y jamón                  │
│  ├─ Pequeña (15,000)        [+] [-] ✓  │
│  ├─ Mediana (28,000)        [+] [-] ✓  │
│  └─ Grande (40,000)         [+] [-] ✓  │
│                                         │
│ Coca-Cola                               │
│ Refresco Coca-Cola                      │
│  ├─ Pequeña 250ml (2,500)   [+] [-] ✓  │
│  ├─ Mediana 400ml (3,500)   [+] [-] ✓  │
│  └─ Grande 600ml (5,000)    [+] [-] ✓  │
└─────────────────────────────────────────┘
```
