const { Category } = require('../models/models');

class CategoryController {
  async create(req, res) {
    const { name } = req.body;
    const categories = await Category.create({ name });
    return res.json(categories);
  }

  async getAll(req, res) {
    const categories = await Category.findAll();
    return res.json(categories);
  }
}

module.exports = new CategoryController();
