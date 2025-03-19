const Router = require('express');
const router = new Router();
const checkRole = require('../middleware/checkRoleMiddleware');
const imagekit = require('../config/imagekit');

const MAX_RETRIES = 5; // Максимальное количество попыток удаления фото
const RETRY_DELAY = 2000; // Задержка между попытками удаления фото (1 секунда)

router.get('/auth', checkRole('ADMIN'), (req, res) => {
  const authenticationParameters = imagekit.getAuthenticationParameters();
  res.json(authenticationParameters);
});

router.post('/delete', checkRole('ADMIN'), async (req, res) => {
  const { fileName } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'Missing fileName' });
  }

  try {
    let nextMarker = null;
    let file = null;

    while (!file) {
      const response = await imagekit.listFiles({
        searchQuery: `name:'${fileName}'`,
        limit: 1000,
        marker: nextMarker,
      });

      if (!response.length) break; // Если пустой ответ — выходим

      file = response.find((f) => f.name === fileName);
      if (file) break;

      nextMarker = response.nextMarker;
      if (!nextMarker) break; // Если дальше нет маркера — выходим

      // Защита от лимитов API ImageKit (10 запросов в секунду)
      await new Promise((r) => setTimeout(r, 50));
    }

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Функция для попытки удаления с повторными попытками
    const deleteFileWithRetries = async (fileId, retries = 0) => {
      try {
        await imagekit.deleteFile(fileId);
        return true;
      } catch (error) {
        if (retries < MAX_RETRIES) {
          console.warn(
            `Error deleting file. Attempting ${
              retries + 1
            } of ${MAX_RETRIES}. Retrying in ${RETRY_DELAY}ms`
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY)); // Задержка перед повторной попыткой
          return deleteFileWithRetries(fileId, retries + 1);
        } else {
          throw new Error(
            `Failed to delete file after ${MAX_RETRIES} attempts`
          );
        }
      }
    };

    const success = await deleteFileWithRetries(file.fileId);

    if (success) {
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
