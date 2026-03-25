const express = require("express");
const pool = require("../db");
const { authRequired, adminOnly } = require("../middlewares/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, slug, sort_order, created_at FROM categories ORDER BY sort_order ASC, name ASC"
    );

    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar categorias:", error);
    res.status(500).json({ message: "Erro ao listar categorias." });
  }
});

router.post("/", authRequired, adminOnly, async (req, res) => {
  try {
    const { name, slug, sort_order } = req.body;

    await pool.execute(
      "INSERT INTO categories (id, name, slug, sort_order, created_at) VALUES (UUID(), ?, ?, ?, NOW())",
      [name, slug, Number(sort_order || 0)]
    );

    res.json({ message: "Categoria criada com sucesso." });
  } catch (error) {
    console.error("Erro ao criar categoria:", error);
    res.status(500).json({ message: "Erro ao criar categoria." });
  }
});

router.put("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, sort_order } = req.body;

    await pool.execute(
      "UPDATE categories SET name = ?, slug = ?, sort_order = ? WHERE id = ?",
      [name, slug, Number(sort_order || 0), id]
    );

    res.json({ message: "Categoria atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar categoria:", error);
    res.status(500).json({ message: "Erro ao atualizar categoria." });
  }
});

router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute("DELETE FROM categories WHERE id = ?", [id]);

    res.json({ message: "Categoria removida com sucesso." });
  } catch (error) {
    console.error("Erro ao remover categoria:", error);
    res.status(500).json({ message: "Erro ao remover categoria." });
  }
});

module.exports = router;