const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const { authRequired, adminOnly } = require("../middlewares/auth");

const router = express.Router();

router.get("/", authRequired, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, login, email, role, active, created_at FROM users ORDER BY created_at DESC"
    );

    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ message: "Erro ao listar usuários." });
  }
});

router.post("/", authRequired, adminOnly, async (req, res) => {
  try {
    const { login, email, password, role } = req.body;

    const password_hash = await bcrypt.hash(password, 10);

    await pool.execute(
      `INSERT INTO users (id, login, email, password_hash, role, active, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, ?, 1, NOW(), NOW())`,
      [login, email, password_hash, role || "admin"]
    );

    res.json({ message: "Usuário criado com sucesso." });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ message: "Erro ao criar usuário." });
  }
});

router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute("DELETE FROM users WHERE id = ?", [id]);

    res.json({ message: "Usuário removido com sucesso." });
  } catch (error) {
    console.error("Erro ao remover usuário:", error);
    res.status(500).json({ message: "Erro ao remover usuário." });
  }
});

module.exports = router;