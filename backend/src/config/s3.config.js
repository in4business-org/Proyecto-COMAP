const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.S3_BUCKET || 'comap-archivos';

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function logStorage(op, path, start) {
  const ms = (performance.now() - start).toFixed(0);
  const tag = ms > 500 ? 'SLOW' : ms > 200 ? 'WARN' : 'OK';
  console.log(`  [${tag}] s3.${op}("${path}") -> ${ms}ms`);
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

class S3StorageService {
  async uploadFile(path, buffer, mimetype) {
    const start = performance.now();
    try {
      const result = await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: path,
          Body: buffer,
          ContentType: mimetype,
        })
      );
      logStorage('upload', path, start);
      return { path, etag: result.ETag };
    } catch (error) {
      console.error('Error subiendo a S3:', error);
      throw error;
    }
  }

  async downloadFile(path) {
    const start = performance.now();
    try {
      const result = await s3.send(
        new GetObjectCommand({ Bucket: bucketName, Key: path })
      );
      const buffer = await streamToBuffer(result.Body);
      logStorage('download', path, start);
      return buffer;
    } catch (error) {
      console.error('Error descargando de S3:', error);
      throw error;
    }
  }

  async listFiles(folderPath) {
    const start = performance.now();
    try {
      const prefix = folderPath ? (folderPath.endsWith('/') ? folderPath : `${folderPath}/`) : '';
      const result = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
        })
      );
      logStorage('list', folderPath, start);
      const contents = result.Contents || [];
      return contents.map((obj) => ({
        name: obj.Key.replace(prefix, ''),
        id: obj.Key,
        updated_at: obj.LastModified,
        metadata: { size: obj.Size },
      }));
    } catch (error) {
      console.error('Error listando en S3:', error);
      return [];
    }
  }

  async deleteFile(path) {
    const start = performance.now();
    try {
      const result = await s3.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: path })
      );
      logStorage('delete', path, start);
      return result;
    } catch (error) {
      console.error('Error borrando en S3:', error);
      throw error;
    }
  }

  /**
   * @param {string} path
   * @returns {Promise<string>} URL firmada válida 1 hora
   */
  async getPublicUrl(path) {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucketName, Key: path }),
      { expiresIn: 3600 }
    );
    return url;
  }
}

module.exports = new S3StorageService();
