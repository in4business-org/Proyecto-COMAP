const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'archivos-comap';

const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'key');

function logStorage(op, path, start) {
  const ms = (performance.now() - start).toFixed(0);
  const tag = ms > 500 ? 'SLOW' : ms > 200 ? 'WARN' : 'OK';
  console.log(`  [${tag}] supabase.${op}("${path}") -> ${ms}ms`);
}

class SupabaseStorageService {
  async uploadFile(path, buffer, mimetype) {
    const start = performance.now();
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, buffer, {
        contentType: mimetype,
        upsert: true
      });
    logStorage('upload', path, start);

    if (error) {
       console.error('Error subiendo a Supabase:', error);
       throw error;
    }
    return data;
  }

  async downloadFile(path) {
    const start = performance.now();
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(path);
    logStorage('download', path, start);

    if (error) {
       console.error('Error descargando de Supabase:', error);
       throw error;
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async listFiles(folderPath) {
    const start = performance.now();
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath);
    logStorage('list', folderPath, start);

    if (error) {
        console.error('Error listando en Supabase:', error);
        return [];
    }
    return data;
  }

  async deleteFile(path) {
    const start = performance.now();
    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([path]);
    logStorage('delete', path, start);

    if (error) {
        console.error('Error borrando en Supabase:', error);
        throw error;
    }
    return data;
  }
  
  /**
   * @param {string} path 
   */
  getPublicUrl(path) {
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path);
    return data.publicUrl;
  }
}

module.exports = new SupabaseStorageService();
