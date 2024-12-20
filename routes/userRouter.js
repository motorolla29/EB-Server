const Router = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const router = new Router();
const { body } = require('express-validator');

router.post(
  '/registration',
  body('name').isLength({ min: 2 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6, max: 32 }),
  userController.registration
);
router.post('/login', userController.login);
router.post('/logout', userController.logout);
router.get('/activate/:link', userController.activate);
router.get('/refresh', userController.refresh);
router.get('/delete', authMiddleware, userController.delete);
router.post('/avatar/set', authMiddleware, userController.setAvatar);
router.post('/avatar/delete', authMiddleware, userController.deleteAvatar);

module.exports = router;
