const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    console.log("Body recebido no login:", req.body);

    const { login, password } = req.body || {};

    if (!login || !password) {
      return res.status(400).json({ message: "Login e senha são obrigatórios." });
    }

    const [rows] = await pool.execute(
      "SELECT id, login, email, password_hash, role, active FROM users WHERE login = ? LIMIT 1",
      [login]
    );

    console.log("Usuário encontrado:", rows);

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: "Usuário ou senha inválidos." });
    }

    if (!user.active) {
      return res.status(403).json({ message: "Usuário inativo." });
    }

    console.log("Comparando senha com hash...");
    const validPassword = await bcrypt.compare(password, user.password_hash);
    console.log("Senha válida?", validPassword);

    if (!validPassword) {
      return res.status(401).json({ message: "Usuário ou senha inválidos." });
    }

    console.log("Gerando token...");
    const token = jwt.sign(
      {
        id: user.id,
        login: user.login,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erro real no login:", error);
    return res.status(500).json({
      message: "Erro interno no login.",
      error: error.message,
      stack: error.stack
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token não informado." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.execute(
      "SELECT id, login, email, role, active FROM users WHERE id = ? LIMIT 1",
      [decoded.id]
    );

    const user = rows[0];

    if (!user || !user.active) {
      return res.status(401).json({ message: "Usuário não encontrado ou inativo." });
    }

    return res.json({
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
});

module.exports = router;