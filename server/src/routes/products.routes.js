const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../db");
const { authRequired, adminOnly } = require("../middlewares/auth");

const router = express.Router();

// caminho absoluto da pasta de upload
const uploadDir = path.resolve(__dirname, "../uploads/products");

// cria a pasta automaticamente se não existir
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage });

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.old_price,
        p.discount,
        p.tag,
        p.category_id,
        p.image_url,
        p.active,
        p.sort_order,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.sort_order ASC, p.name ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ message: "Erro ao listar produtos." });
  }
});

router.post("/", authRequired, adminOnly, upload.single("image"), async (req, res) => {
  try {
    const {
      name,
      price,
      old_price,
      discount,
      tag,
      category_id,
      active,
      sort_order,
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: "Nome e preço são obrigatórios." });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

    await pool.execute(
      `
      INSERT INTO products
      (name, price, old_price, discount, tag, category_id, image_url, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        Number(price),
        old_price ? Number(old_price) : null,
        discount ? Number(discount) : null,
        tag || null,
        category_id || null,
        imageUrl,
        active === "true" ? 1 : 0,
        sort_order ? Number(sort_order) : 0,
      ]
    );

    res.status(201).json({ message: "Produto criado com sucesso." });
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ message: "Erro ao criar produto." });
  }
});

router.put("/:id", authRequired, adminOnly, upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      price,
      old_price,
      discount,
      tag,
      category_id,
      active,
      sort_order,
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: "Nome e preço são obrigatórios." });
    }

    let imageSql = "";
    const params = [
      name,
      Number(price),
      old_price ? Number(old_price) : null,
      discount ? Number(discount) : null,
      tag || null,
      category_id || null,
      active === "true" ? 1 : 0,
      sort_order ? Number(sort_order) : 0,
    ];

    if (req.file) {
      imageSql = ", image_url = ?";
      params.push(`/uploads/products/${req.file.filename}`);
    }

    params.push(id);

    await pool.execute(
      `
      UPDATE products
      SET
        name = ?,
        price = ?,
        old_price = ?,
        discount = ?,
        tag = ?,
        category_id = ?,
        active = ?,
        sort_order = ?
        ${imageSql}
      WHERE id = ?
      `,
      params
    );

    res.json({ message: "Produto atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ message: "Erro ao atualizar produto." });
  }
});

router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute("DELETE FROM products WHERE id = ?", [id]);

    res.json({ message: "Produto excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    res.status(500).json({ message: "Erro ao excluir produto." });
  }
});

module.exports = router;