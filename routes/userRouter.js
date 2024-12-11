const Router = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const router = new Router();

router.post('/registration', userController.registration);
router.post('/login', userController.login);
router.get('/auth', authMiddleware, userController.check);
router.get('/delete', authMiddleware, userController.delete);
router.post('/avatar/set', authMiddleware, userController.setAvatar);
router.post('/avatar/delete', authMiddleware, userController.deleteAvatar);

module.exports = router;
