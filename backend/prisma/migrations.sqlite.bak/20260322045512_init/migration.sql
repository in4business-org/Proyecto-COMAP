-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "razon_social" TEXT,
    "domicilio_constituido" TEXT,
    "domicilio_fiscal" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "giro" TEXT,
    "codigo_ciiu" TEXT,
    "fecha_balance" TEXT,
    "tipo_contribuyente" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "fecha_creacion" TEXT NOT NULL,
    "fecha_presentacion" TEXT,
    "anio_presentacion" INTEGER,
    "duracion_seguimiento" INTEGER,
    "cotizacion_ui" REAL,
    "cotizacion_usd" REAL,
    "expediente" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proyecto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "archivo" TEXT,
    "nota_usuario" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistItem_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT,
    "periodo" TEXT,
    "archivo" TEXT,
    "descripcion" TEXT,
    "numero_factura" TEXT,
    "proveedor" TEXT,
    "rut" TEXT,
    "fecha" TEXT,
    "monto" REAL,
    "moneda" TEXT,
    "cantidad" INTEGER DEFAULT 1,
    "categoria" TEXT,
    "rut_receptor" TEXT,
    "razon_social_receptor" TEXT,
    "texto_extraido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Factura_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_rut_key" ON "Empresa"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_proyectoId_periodo_item_id_key" ON "ChecklistItem"("proyectoId", "periodo", "item_id");
