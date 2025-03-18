const Router = require('express');
const router = new Router();
const imagekit = require('../config/imagekit');

router.get('/auth', (req, res) => {
  const authenticationParameters = imagekit.getAuthenticationParameters();
  res.json(authenticationParameters);
});
router.post('/delete', async (req, res) => {
  const { fileName } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'Missing fileName' });
  }

  try {
    const query = `name:'${fileName}'`;
    const listResponse = await imagekit.listFiles({ searchQuery: query });

    const file = listResponse.find((f) => f.name === fileName);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    await imagekit.deleteFile(file.fileId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
