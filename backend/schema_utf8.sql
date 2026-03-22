-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fecha_creacion" TEXT NOT NULL,
    "fecha_presentacion" TEXT,
    "anio_presentacion" INTEGER,
    "duracion_seguimiento" INTEGER,
    "cotizacion_ui" DOUBLE PRECISION,
    "cotizacion_usd" DOUBLE PRECISION,
    "expediente" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "archivo" TEXT,
    "nota_usuario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT,
    "periodo" TEXT,
    "archivo" TEXT,
    "descripcion" TEXT,
    "numero_factura" TEXT,
    "proveedor" TEXT,
    "rut" TEXT,
    "fecha" TEXT,
    "monto" DOUBLE PRECISION,
    "moneda" TEXT,
    "cantidad" INTEGER DEFAULT 1,
    "categoria" TEXT,
    "rut_receptor" TEXT,
    "razon_social_receptor" TEXT,
    "texto_extraido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_rut_key" ON "Empresa"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_proyectoId_periodo_item_id_key" ON "ChecklistItem"("proyectoId", "periodo", "item_id");

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

