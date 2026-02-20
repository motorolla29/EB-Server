const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const {
  CLOUD_S3_ENDPOINT,
  CLOUD_REGION,
  CLOUD_BUCKET_NAME,
  CLOUD_PUBLIC_BASE_URL,
  CLOUD_KEY_ID,
  CLOUD_KEY_SECRET,
} = process.env;

const s3Client = new S3Client({
  region: CLOUD_REGION,
  endpoint: CLOUD_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: CLOUD_KEY_ID,
    secretAccessKey: CLOUD_KEY_SECRET,
  },
});

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const getExtensionFromMime = (mimeType) => {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
};

const buildKey = (folder, fileName) =>
  folder ? `${folder.replace(/\/+$/, '')}/${fileName}` : fileName;

async function uploadSingleObject(buffer, key, contentType) {
  const command = new PutObjectCommand({
    Bucket: CLOUD_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  });

  await s3Client.send(command);
}

async function deleteSingleObject(key) {
  const command = new DeleteObjectCommand({
    Bucket: CLOUD_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Загрузка изображения в cloud.ru с генерацией xs__/sm__/md__ вариантов.
 * Оригинал ограничивается максимальной стороной 2000px для оптимизации.
 *
 * @param {Object} params
 * @param {Buffer} [params.buffer] - исходный файл
 * @param {string} [params.filePath] - путь к временного файлу (если buffer пустой)
 * @param {string} params.mimeType - MIME-тип файла
 * @param {string} params.folder - папка в бакете (catalog, user-avatars, stores и т.п.)
 * @param {string} params.baseFileName - имя оригинального файла БЕЗ пути (например, "96b3adcf.png")
 */
async function uploadImageWithVariants({
  buffer,
  filePath,
  mimeType,
  folder,
  baseFileName,
}) {
  if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error('Unsupported image type');
  }

  if (!buffer || !buffer.length) {
    if (!filePath) {
      throw new Error('Input buffer is empty and filePath is not provided');
    }
    buffer = await fs.promises.readFile(filePath);
  }

  const extFromName = path.extname(baseFileName).replace('.', '');
  const mimeExt = getExtensionFromMime(mimeType);
  const finalExt = extFromName || mimeExt;

  if (!finalExt) {
    throw new Error('Cannot determine file extension');
  }

  const baseNameWithoutExt = path.basename(baseFileName, path.extname(baseFileName));
  const finalBaseFileName = `${baseNameWithoutExt}.${finalExt}`;

  const image = sharp(buffer);
  const metadata = await image.metadata();

  const targetFormat = finalExt === 'jpg' ? 'jpeg' : finalExt;
  
  // Улучшенные опции компрессии для лучшего соотношения размер/качество
  const commonOptions =
    targetFormat === 'jpeg'
      ? { 
          quality: 80, // Снижено с 85 для лучшей компрессии
          mozjpeg: true, 
          chromaSubsampling: '4:2:0', // Более агрессивная субдискретизация вместо 4:4:4
          progressive: true // Прогрессивный JPEG для лучшей компрессии
        }
      : targetFormat === 'png'
      ? { 
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true // Пробуем палитру если возможно
        }
      : targetFormat === 'webp'
      ? { quality: 80, effort: 6 }
      : {};

  // Ограничиваем максимальную сторону оригинала до 4000px для обеспечения зума
  // При этом оптимизация качества (quality 80, progressive JPEG) сохраняет размер файла разумным
  const MAX_ORIGINAL_DIMENSION = 4000;
  let originalWidth = metadata.width;
  let originalHeight = metadata.height;
  let needsResize = false;

  if (originalWidth > MAX_ORIGINAL_DIMENSION || originalHeight > MAX_ORIGINAL_DIMENSION) {
    if (originalWidth > originalHeight) {
      originalWidth = MAX_ORIGINAL_DIMENSION;
      originalHeight = Math.round((metadata.height * MAX_ORIGINAL_DIMENSION) / metadata.width);
    } else {
      originalHeight = MAX_ORIGINAL_DIMENSION;
      originalWidth = Math.round((metadata.width * MAX_ORIGINAL_DIMENSION) / metadata.height);
    }
    needsResize = true;
  }

  // Оригинал — ограничиваем размер и оптимизируем
  let originalImage = image.clone();
  if (needsResize) {
    originalImage = originalImage.resize({ width: originalWidth, height: originalHeight, fit: 'inside' });
  }
  const originalBuffer = await originalImage
    .toFormat(targetFormat, commonOptions)
    .toBuffer();

  // md-версия: ширина до ~450px
  const mdBuffer = await sharp(buffer)
    .resize({ width: 450, withoutEnlargement: true })
    .toFormat(targetFormat, commonOptions)
    .toBuffer();

  // sm-версия: ширина до ~200px
  const smBuffer = await sharp(buffer)
    .resize({ width: 200, withoutEnlargement: true })
    .toFormat(targetFormat, commonOptions)
    .toBuffer();

  // xs-версия: ширина до ~80px для thumbs
  const xsBuffer = await sharp(buffer)
    .resize({ width: 80, withoutEnlargement: true })
    .toFormat(targetFormat, commonOptions)
    .toBuffer();

  const originalKey = buildKey(folder, finalBaseFileName);
  const mdKey = buildKey(folder, `md__${finalBaseFileName}`);
  const smKey = buildKey(folder, `sm__${finalBaseFileName}`);
  const xsKey = buildKey(folder, `xs__${finalBaseFileName}`);

  const contentType =
    finalExt === 'jpg' ? 'image/jpeg' : `image/${finalExt.toLowerCase()}`;

  await Promise.all([
    uploadSingleObject(originalBuffer, originalKey, contentType),
    uploadSingleObject(mdBuffer, mdKey, contentType),
    uploadSingleObject(smBuffer, smKey, contentType),
    uploadSingleObject(xsBuffer, xsKey, contentType),
  ]);

  const publicBase = CLOUD_PUBLIC_BASE_URL?.replace(/\/+$/, '') || '';

  return {
    fileName: finalBaseFileName,
    urls: {
      original: `${publicBase}/${originalKey}`,
      md: `${publicBase}/${mdKey}`,
      sm: `${publicBase}/${smKey}`,
      xs: `${publicBase}/${xsKey}`,
    },
  };
}

/**
 * Удаление изображения и его xs__/sm__/md__ вариантов из cloud.ru.
 *
 * @param {Object} params
 * @param {string} params.folder
 * @param {string} params.baseFileName
 */
async function deleteImageWithVariants({ folder, baseFileName }) {
  if (!baseFileName) return;

  const originalKey = buildKey(folder, baseFileName);
  const mdKey = buildKey(folder, `md__${baseFileName}`);
  const smKey = buildKey(folder, `sm__${baseFileName}`);
  const xsKey = buildKey(folder, `xs__${baseFileName}`);

  const keys = [originalKey, mdKey, smKey, xsKey];

  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteSingleObject(key);
      } catch (e) {
        // Гасим 404 и похожие ошибки, чтобы не заваливать весь запрос
        // eslint-disable-next-line no-console
        console.warn(`Failed to delete object ${key}:`, e.message);
      }
    })
  );
}

module.exports = {
  uploadImageWithVariants,
  deleteImageWithVariants,
};

