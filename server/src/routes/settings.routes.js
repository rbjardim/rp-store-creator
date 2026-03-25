const express = require("express");
const pool = require("../db");
const { authRequired, adminOnly } = require("../middlewares/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT `key`, `value` FROM store_settings");

    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    res.json(settings);
  } catch (error) {
    console.error("Erro ao listar configurações:", error);
    res.status(500).json({ message: "Erro ao listar configurações." });
  }
});

router.put("/", authRequired, adminOnly, async (req, res) => {
  try {
    const entries = Object.entries(req.body);

    for (const [key, value] of entries) {
      await pool.execute(
        "UPDATE store_settings SET `value` = ? WHERE `key` = ?",
        [String(value ?? ""), key]
      );
    }

    res.json({ message: "Configurações salvas com sucesso." });
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    res.status(500).json({ message: "Erro ao salvar configurações." });
  }
});

module.exports = router;