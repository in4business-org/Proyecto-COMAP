-- CreateTable
CREATE TABLE "UsuarioEmpresa" (
    "id" TEXT NOT NULL,
    "usuarioSub" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "escritura" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsuarioEmpresa_usuarioSub_idx" ON "UsuarioEmpresa"("usuarioSub");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioEmpresa_usuarioSub_empresaId_key" ON "UsuarioEmpresa"("usuarioSub", "empresaId");

-- AddForeignKey
ALTER TABLE "UsuarioEmpresa" ADD CONSTRAINT "UsuarioEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
