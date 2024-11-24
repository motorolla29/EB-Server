const Router = require('express');
const categoryController = require('../controllers/categoryController');
const checkRole = require('../middleware/checkRoleMiddleware');
const router = new Router();

router.post('/', checkRole('ADMIN'), categoryController.create);
router.get('/', categoryController.getAll);

module.exports = router;
