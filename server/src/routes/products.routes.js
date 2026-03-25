const express = require("express");
const multer = require("multer");
const pool = require("../db");
const { authRequired, adminOnly } = require("../middlewares/auth");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

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
        p.active,
        p.sort_order,
        c.name AS category_name,
        CASE
          WHEN p.image_data IS NOT NULL THEN CONCAT('/api/products/', p.id, '/image')
          ELSE NULL
        END AS image_url
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

router.get("/:id/image", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `
      SELECT image_data, image_mime_type
      FROM products
      WHERE id = ?
      `,
      [id]
    );

    if (!rows.length || !rows[0].image_data) {
      return res.status(404).send("Imagem não encontrada.");
    }

    res.setHeader("Content-Type", rows[0].image_mime_type || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(rows[0].image_data);
  } catch (error) {
    console.error("Erro ao buscar imagem do produto:", error);
    res.status(500).send("Erro ao buscar imagem.");
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

    const imageData = req.file ? req.file.buffer : null;
    const imageMimeType = req.file ? req.file.mimetype : null;

    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

      await pool.execute(
    `
    INSERT INTO products
    (
      name,
      price,
      old_price,
      discount,
      tag,
      category_id,
      image_url,
      image_data,
      image_mime_type,
      active,
      sort_order,
      description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      name,
      Number(price),
      old_price ? Number(old_price) : null,
      discount ? Number(discount) : null,
      tag || null,
      category_id || null,
      null,
      imageData,
      imageMimeType,
      active === "true" ? 1 : 0,
      sort_order ? Number(sort_order) : 0,
      description || null,
    ]
  );

    res.status(201).json({ message: "Produto criado com sucesso." });
    } catch (error) {
      console.error("🔥 ERRO AO CRIAR PRODUTO:");
      console.error(error);
      console.error("Mensagem:", error.message);
      console.error("SQL Message:", error.sqlMessage);
      console.error("Code:", error.code);

      res.status(500).json({
        message: "Erro ao criar produto.",
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
      });
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
      imageSql = ", image_data = ?, image_mime_type = ?, image_url = NULL";
      params.push(req.file.buffer, req.file.mimetype);
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