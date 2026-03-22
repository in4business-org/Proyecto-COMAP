const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'archivos-comap';

const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'key');

class SupabaseStorageService {
  /**
   * @param {string} path - path in bucket (e.g. 'folder/file.pdf')
   * @param {Buffer} buffer - file content
   * @param {string} mimetype - file mime type
   */
  async uploadFile(path, buffer, mimetype) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, buffer, {
        contentType: mimetype,
        upsert: true
      });
    
    if (error) {
       console.error('Error subiendo a Supabase:', error);
       throw error;
    }
    return data;
  }

  /**
   * @param {string} path - path in bucket 
   * @returns {Promise<Buffer>}
   */
  async downloadFile(path) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(path);
      
    if (error) {
       console.error('Error descargando de Supabase:', error);
       throw error;
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  
  /**
   * @param {string} folderPath 
   */
  async listFiles(folderPath) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath);
      
    if (error) {
        console.error('Error listando en Supabase:', error);
        return [];
    }
    return data;
  }
  
  /**
   * @param {string} path 
   */
  async deleteFile(path) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([path]);
      
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
