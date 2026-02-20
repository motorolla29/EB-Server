const Router = require('express');
const router = new Router();
const uuid = require('uuid');

const authMiddleware = require('../middleware/authMiddleware');
const checkRole = require('../middleware/checkRoleMiddleware');
const ApiError = require('../error/ApiError');
const {
  uploadImageWithVariants,
  deleteImageWithVariants,
} = require('../services/cloud-storage-service');

// Универсальная точка загрузки изображений в cloud.ru
// Сейчас используется для каталога товаров, но может быть расширена.
router.post(
  '/catalog',
  authMiddleware,
  checkRole('ADMIN'),
  async (req, res, next) => {
    try {
      if (!req.files || !req.files.photo) {
        return next(ApiError.badRequest('No photo file provided'));
      }

      const photo = req.files.photo;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

      if (!allowedTypes.includes(photo.mimetype)) {
        return next(ApiError.badRequest('Invalid file type'));
      }

      const ext =
        photo.mimetype === 'image/png'
          ? 'png'
          : photo.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';

      const fileName = `${uuid.v4()}.${ext}`;

      const result = await uploadImageWithVariants({
        buffer: photo.data,
        filePath: photo.tempFilePath,
        mimeType: photo.mimetype,
        folder: 'catalog',
        baseFileName: fileName,
      });

      return res.json(result);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error uploading catalog image to cloud.ru:', error);
      return next(ApiError.internal('Error uploading image'));
    }
  }
);

// Удаление изображения каталога (оригинал + md__/sm__).
router.post(
  '/catalog/delete',
  authMiddleware,
  checkRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { fileName } = req.body;

      if (!fileName) {
        return next(ApiError.badRequest('Missing fileName'));
      }

      await deleteImageWithVariants({
        folder: 'catalog',
        baseFileName: fileName,
      });

      return res.json({ success: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error deleting catalog image from cloud.ru:', error);
      return next(ApiError.internal('Error deleting image'));
    }
  }
);

module.exports = router;

