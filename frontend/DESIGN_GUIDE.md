# Guía de Diseño — COMAP Frontend

## Stack

- **Framework**: React 19.1.0
- **Estilos**: Tailwind CSS 4.2.1
- **Íconos**: Lucide React 0.577.0
- **Componentes**: Librería propia en `src/components/ui/`
- **Fuente**: `frontend/src/index.css` (variables CSS), `frontend/index.html` (imports)

---

## 1. Paleta de Colores

Los colores se definen como variables CSS en `src/index.css` y se referencian con `var(--token)` o con clases Tailwind como `bg-primary`, `text-muted-foreground`, etc.

### Modo Claro (`:root`)

| Token | Hex | Clase Tailwind | Uso |
|-------|-----|----------------|-----|
| `--background` | `#f8f7f4` | `bg-background` | Fondo de página |
| `--foreground` | `#1a1a2e` | `text-foreground` | Texto principal |
| `--card` | `#ffffff` | `bg-card` | Fondo de tarjetas |
| `--card-foreground` | `#1a1a2e` | `text-card-foreground` | Texto en tarjetas |
| `--primary` | `#1a3a6b` | `bg-primary` | Azul principal (botones, links, activos) |
| `--primary-foreground` | `#ffffff` | `text-primary-foreground` | Texto sobre primary |
| `--secondary` | `#eef2f7` | `bg-secondary` | Elementos secundarios |
| `--secondary-foreground` | `#1a1a2e` | `text-secondary-foreground` | Texto sobre secondary |
| `--muted` | `#f1f0ed` | `bg-muted` | Fondos desactivados/neutros |
| `--muted-foreground` | `#6b7280` | `text-muted-foreground` | Texto gris/secundario |
| `--accent` | `#e8edf5` | `bg-accent` | Hover y focus highlights |
| `--accent-foreground` | `#1a1a2e` | `text-accent-foreground` | Texto sobre accent |
| `--destructive` | `#dc2626` | `bg-destructive` | Errores, acciones de borrado |
| `--destructive-foreground` | `#ffffff` | `text-destructive-foreground` | Texto sobre destructive |
| `--success` | `#16a34a` | `bg-success` | Estados exitosos |
| `--warning` | `#d97706` | `bg-warning` | Advertencias |
| `--border` | `#d1d9e6` | `border-border` | Bordes generales |
| `--input` | `#d1d9e6` | `border-input` | Bordes de inputs |
| `--ring` | `#1a3a6b` | `ring-ring` | Anillo de foco |

### Modo Oscuro (`.dark`)

| Token | Hex | Uso |
|-------|-----|-----|
| `--background` | `#1a1a1a` | Fondo oscuro |
| `--foreground` | `#e8e8e8` | Texto claro |
| `--card` | `#242424` | Tarjetas en oscuro |
| `--card-foreground` | `#e8e8e8` | Texto en tarjetas oscuras |
| `--primary` | `#4f7ef5` | Azul brillante |
| `--primary-foreground` | `#ffffff` | Texto sobre primary |
| `--secondary` | `#2e2e2e` | Secondary oscuro |
| `--muted` | `#2e2e2e` | Muted oscuro |
| `--muted-foreground` | `#666666` | Texto gris oscuro |
| `--accent` | `#2e2e2e` | Hover oscuro |
| `--destructive` | `#f87171` | Rojo brillante |
| `--success` | `#34d399` | Verde brillante |
| `--warning` | `#fbbf24` | Ámbar brillante |
| `--border` | `#333333` | Bordes oscuros |
| `--input` | `#333333` | Bordes de input oscuros |
| `--ring` | `#4f7ef5` | Anillo foco azul brillante |

---

## 2. Tipografía

Las fuentes se importan desde Google Fonts en `index.html` y se mapean en `src/index.css`.

| Fuente | Variable CSS | Clase Tailwind | Pesos | Uso |
|--------|-------------|----------------|-------|-----|
| **Plus Jakarta Sans** | `--font-sans` | `font-sans` | 400, 500, 600, 700 | Cuerpo, UI, etiquetas |
| **Lora** | `--font-display` | `font-display` | 400, 600 | Títulos de display |

### Escala de Tamaños

| Clase Tailwind | Tamaño | Uso típico |
|----------------|--------|------------|
| `text-xs` | 12px | Etiquetas, breadcrumbs, cabeceras de tabla |
| `text-sm` | 14px | Cuerpo, labels de formulario, descripciones |
| `text-base` | 16px | Cuerpo estándar |
| `text-lg` | 18px | Títulos de tarjeta |
| `text-xl` | 20px | Encabezados de sección |
| `text-2xl` | 24px | Títulos de página |

### Pesos

| Clase | Peso | Uso |
|-------|------|-----|
| `font-normal` | 400 | Texto regular |
| `font-medium` | 500 | Labels, textos de énfasis leve |
| `font-semibold` | 600 | Títulos de tarjeta, encabezados |
| `font-bold` | 700 | Títulos principales |

---

## 3. Espaciado y Radios

### Radios de Borde

| Clase | Valor | Uso |
|-------|-------|-----|
| `rounded-sm` | 6px | Elementos pequeños, etiquetas |
| `rounded-md` | 8px | Botones `sm` y `lg` |
| `rounded-lg` | 12px | Botones default, inputs, selects |
| `rounded-xl` | 16px | Tarjetas, modales, dialogs |
| `rounded-full` | 9999px | Avatares, badges circulares |

### Espaciado Frecuente

| Clase | Valor | Uso |
|-------|-------|-----|
| `p-2` / `gap-2` | 8px | Espaciado interno pequeño |
| `p-4` / `gap-4` | 16px | Espaciado estándar |
| `p-6` / `gap-6` | 24px | Padding de cards y headers |
| `py-16` | 64px | Estados vacíos y loading |

---

## 4. Componentes UI

Todos los componentes viven en `src/components/ui/` y aceptan prop `className` para extensión.

### Button (`button.jsx`)

**Variantes:**

| Variante | Descripción |
|----------|-------------|
| `default` | Fondo `primary`, texto blanco |
| `destructive` | Fondo `destructive`, texto blanco |
| `outline` | Borde, hover `bg-accent` |
| `secondary` | Fondo `secondary`, hover 80% opacidad |
| `ghost` | Transparente, hover `bg-accent` |
| `link` | Solo texto, subrayado en hover |

**Tamaños:**

| Tamaño | Alto | Padding |
|--------|------|---------|
| `sm` | h-9 | px-3 |
| `default` | h-10 | px-4 py-2 |
| `lg` | h-11 | px-8 |
| `icon` | h-10 w-10 | — |

Estilo base: `rounded-lg text-sm font-medium transition-all duration-200`

---

### Input / Label / Textarea (`input.jsx`)

- **Input**: `h-10 px-3 py-2 rounded-lg border border-input bg-background text-sm`
- **Label**: `text-sm font-medium`
- **Textarea**: igual que Input, con `min-h-[80px]`
- Focus: `ring-2 ring-ring ring-offset-2`
- Disabled: `opacity-50 cursor-not-allowed`

---

### Card (`card.jsx`)

```
Card          → rounded-xl border border-border bg-card shadow-sm
CardHeader    → p-6 flex flex-col space-y-1.5
CardTitle     → text-lg font-semibold tracking-tight leading-none
CardDescription → text-sm text-muted-foreground
CardContent   → p-6 pt-0
CardFooter    → flex items-center p-6 pt-0
```

---

### Badge (`badge.jsx`)

Estilo base: `inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium border`

Los fondos usan opacidad al 15% del color de la variante.

| Variante | Color |
|----------|-------|
| `default` | Azul (`primary`) |
| `success` | Verde (`success`) |
| `warning` | Ámbar (`warning`) |
| `destructive` | Rojo (`destructive`) |
| `secondary` | Secundario |
| `outline` | Solo borde |

---

### Dialog (`dialog.jsx`)

- **Ancho**: `max-w-lg` (512px), margen `mx-4`
- **Fondo**: `bg-card border rounded-xl ring-1 ring-border`
- **Overlay**: `bg-black/50 backdrop-blur-sm` (móvil)
- **Sombra**: `shadow-lg shadow-black/20`
- **Botón cerrar**: posicionado `right-4 top-4`
- **Footer**: `flex justify-end gap-3 mt-6`
- **Animación entrada**: `animate-scale-in`

---

### Loading / EmptyState (`loading.jsx`)

**Spinner**: Lucide `Loader2` con `animate-spin text-muted-foreground`

**LoadingState**:
```
flex flex-col items-center justify-center py-16 gap-4
text-sm text-muted-foreground
```

**EmptyState**:
```
flex flex-col items-center justify-center py-16 gap-4 text-center
Ícono: bg-muted rounded-xl p-4
Título: text-base font-medium
Descripción: text-sm text-muted-foreground max-w-md
```

---

## 5. Íconos

- **Librería**: Lucide React v0.577.0
- **Tamaño estándar**: 28×28px (`size={28}`)
- **Tamaño en texto**: 16px para íconos inline
- **Logos de empresa**: Iniciales en badges cuadrados de 26×26px con color

---

## 6. Animaciones

Definidas en `src/index.css` (líneas 162–182):

| Clase | Duración | Easing | Uso |
|-------|----------|--------|-----|
| `animate-fade-up` | 0.5s | cubic-bezier(0.16, 1, 0.3, 1) | Entrada de página/sección |
| `animate-fade-in` | 0.4s | ease-out | Revelado de contenido |
| `animate-scale-in` | 0.4s | cubic-bezier(0.16, 1, 0.3, 1) | Apertura de diálogos |

Transiciones comunes:
- `transition-all duration-200` — elementos generales
- `transition-colors duration-200` — cambios de color

---

## 7. Diseño Responsivo (mobile-first)

| Prefijo | Breakpoint | Notas |
|---------|-----------|-------|
| *(sin prefijo)* | 0px+ | Base móvil |
| `sm:` | 640px | Columnas opcionales en tablas |
| `md:` | 768px | Layouts de 2 columnas |
| `lg:` | 1024px | Sidebar estático, layouts de escritorio |
| `xl:` | 1280px | Pantallas grandes |

**Sidebar**: overlay en móvil (`-translate-x-full`) → estático en `lg:`

---

## 8. Patrones de Diseño

### Tablas
- Header: `bg-muted/50 text-[11px] font-medium uppercase tracking-wider text-muted-foreground`
- Filas: hover `bg-accent transition-colors`
- Separador: `border-b border-border`
- Columnas opcionales: `hidden sm:table-cell`

### Formularios
- Layout: grid con columnas, campos a `span-1` o `span-2`
- Label: `text-sm font-medium`
- Focus: `ring-2 ring-ring ring-offset-2`
- Campos requeridos: indicados en el label

### Sidebar
- Activo: `bg-accent text-foreground`
- Inactivo: `text-muted-foreground hover:text-foreground hover:bg-accent`
- Empresa con proyectos: secciones expandibles anidadas

### Dark Mode
- Implementado con clase `.dark` en `<html>`
- Persistido en `localStorage`
- Inicializado antes de React (script en `index.html`) para evitar flash
- Toggle en la barra lateral (`Sidebar.jsx`)

---

## 9. Utilidades Clave

| Archivo | Función | Descripción |
|---------|---------|-------------|
| `src/lib/utils.js` | `cn(...classes)` | Merge inteligente de clases Tailwind (clsx + tailwind-merge) |
| `src/context/ThemeContext.jsx` | `useTheme()` | Contexto de tema claro/oscuro |

### Uso de `cn()`
```jsx
import { cn } from '@/lib/utils'

<div className={cn(
  'base-classes',
  condition && 'conditional-class',
  className  // prop externa
)} />
```

---

## 10. Dependencias de UI

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| tailwindcss | 4.2.1 | Framework CSS |
| lucide-react | 0.577.0 | Íconos |
| recharts | 3.8.1 | Gráficos |
| clsx | 2.1.1 | Clases condicionales |
| tailwind-merge | 3.5.0 | Merge de clases Tailwind |
| class-variance-authority | 0.7.1 | Sistema de variantes |
