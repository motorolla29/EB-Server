const Router = require('express');
const router = new Router();
const checkRole = require('../middleware/checkRoleMiddleware');
const {
  deleteImageWithVariants,
} = require('../services/cloud-storage-service');

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

router.post('/delete', checkRole('ADMIN'), async (req, res) => {
  const { fileName } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'Missing fileName' });
  }

  try {
    const deleteWithRetry = async (attempt = 0) => {
      try {
        await deleteImageWithVariants({
          folder: 'catalog',
          baseFileName: fileName,
        });
        return true;
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          // eslint-disable-next-line no-console
          console.warn(
            `Error deleting image from cloud.ru. Attempt ${
              attempt + 1
            } of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return deleteWithRetry(attempt + 1);
        }
        throw error;
      }
    };

    await deleteWithRetry(0);

    return res.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting image from cloud.ru:', error);
    return res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
