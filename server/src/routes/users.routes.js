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

router.put("/me/password", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Informe a senha atual e a nova senha.",
      });
    }

    // 🔐 validação forte da senha
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula, número e caractere especial.",
      });
    }

    // busca senha atual
    const [rows] = await pool.execute(
      "SELECT password_hash FROM users WHERE id = ?",
      [userId]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // verifica senha atual
    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Senha atual incorreta.",
      });
    }

    // evita repetir senha
    const samePassword = await bcrypt.compare(
      newPassword,
      user.password_hash
    );

    if (samePassword) {
      return res.status(400).json({
        message: "A nova senha deve ser diferente da atual.",
      });
    }

    // criptografa nova senha
    const newHash = await bcrypt.hash(newPassword, 10);

    // atualiza
    await pool.execute(
      "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
      [newHash, userId]
    );

    return res.json({
      message: "Senha alterada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    return res.status(500).json({
      message: "Erro ao alterar senha.",
    });
  }
});

module.exports = router;