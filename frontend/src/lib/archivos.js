const MB = 1024 * 1024

/** Revisa tipo y tamaño. Devuelve un texto con el problema, o null si está bien. */
export function problemaArchivo(file, { tipos = ['pdf', 'jpg', 'jpeg', 'png'], maxMb = 10 } = {}) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (!tipos.includes(ext)) {
    const lista = tipos.filter((t) => t !== 'jpeg').map((t) => t.toUpperCase()).join(', ').replace(/, ([^,]*)$/, ' o $1')
    return `"${file.name}": tiene que ser ${lista}`
  }
  if (file.size > maxMb * MB) return `"${file.name}" pesa más de ${maxMb} MB`
  return null
}
