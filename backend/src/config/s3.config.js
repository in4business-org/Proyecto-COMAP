const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = process.env.S3_BUCKET;

// IMPORTANTE: Vercel (y cualquier plataforma sobre AWS Lambda) RESERVA los nombres
// AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, así que en producción usamos
// S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY. Como fallback aceptamos los
// nombres AWS_* (cómodo en local). En EC2/ECS con IAM Role no hace falta ninguno.
const REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new S3Client({
  region: REGION,
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
});

function logStorage(op, key, start) {
  const ms = (performance.now() - start).toFixed(0);
  const tag = ms > 500 ? 'SLOW' : ms > 200 ? 'WARN' : 'OK';
  console.log(`  [${tag}] s3.${op}("${key}") -> ${ms}ms`);
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

class S3StorageService {
  /**
   * Sube un archivo. Mantiene la misma firma que el viejo servicio de Supabase.
   * @param {string} key  ruta/clave del objeto (ej: "proyectos/1/2/periodo/factura.pdf")
   * @param {Buffer} buffer
   * @param {string} mimetype
   */
  async uploadFile(key, buffer, mimetype) {
    const start = performance.now();
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      })
    );
    logStorage('upload', key, start);
    return { key };
  }

  /**
   * Descarga un archivo y lo devuelve como Buffer.
   * Lanza error si no existe (los callers lo capturan con try/catch).
   * @param {string} key
   * @returns {Promise<Buffer>}
   */
  async downloadFile(key) {
    const start = performance.now();
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const buffer = await streamToBuffer(res.Body);
    logStorage('download', key, start);
    return buffer;
  }

  /**
   * Lista los archivos directamente dentro de "folderPath" (no recursivo).
   * Devuelve [{ name }] con name = nombre de archivo relativo a la carpeta,
   * para mantener compatibilidad con el código que usa Supabase `.list()`.
   * @param {string} folderPath
   * @returns {Promise<Array<{ name: string }>>}
   */
  async listFiles(folderPath) {
    const start = performance.now();
    const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    const out = [];
    let ContinuationToken;
    try {
      do {
        const res = await s3.send(
          new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            Delimiter: '/',
            ContinuationToken,
          })
        );
        for (const obj of res.Contents || []) {
          const name = obj.Key.slice(prefix.length);
          if (name) out.push({ name });
        }
        ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (ContinuationToken);
    } catch (error) {
      console.error('Error listando en S3:', error);
      return [];
    }
    logStorage('list', folderPath, start);
    return out;
  }

  /**
   * Borra un archivo.
   * @param {string} key
   */
  async deleteFile(key) {
    const start = performance.now();
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    logStorage('delete', key, start);
    return { key };
  }

  /**
   * Genera una URL firmada temporal para descargar el objeto.
   * (Reemplaza a getPublicUrl de Supabase; el bucket S3 es privado.)
   * @param {string} key
   * @param {number} expiresIn  segundos (default 1 hora)
   */
  async getSignedUrl(key, expiresIn = 3600) {
    return getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn }
    );
  }
}

module.exports = new S3StorageService();
