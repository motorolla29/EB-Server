const Router = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const router = new Router();
const { body } = require('express-validator');

router.post(
  '/registration',
  body('name').isLength({ min: 2, max: 32 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6, max: 32 }),
  userController.registration
);
router.post('/login', userController.login);
router.post('/logout', userController.logout);
router.get('/activate/:link', userController.activate);
router.post('/resend-activation', userController.activationLinkResend);
router.get('/refresh', userController.refresh);
router.get('/delete', authMiddleware, userController.delete);
router.post('/avatar/set', authMiddleware, userController.setAvatar);
router.post('/avatar/delete', authMiddleware, userController.deleteAvatar);
router.post(
  '/update-personal-data',
  authMiddleware,
  userController.updatePersonalData
);
router.post(
  '/update-contact-data',
  authMiddleware,
  userController.updateContactData
);
router.post('/send-password-reset-code', userController.sendPasswordResetCode);
router.post(
  '/verify-password-reset-code',
  userController.verifyPasswordResetCode
);
router.post('/update-password', userController.updatePassword);

module.exports = router;
