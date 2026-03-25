const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const { authRequired, adminOnly } = require("../middlewares/auth");

const router = express.Router();

// listar cupons
router.get("/", authRequired, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT id, code, discount_percent, active, created_at
      FROM coupons
      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar cupons:", error);
    res.status(500).json({ message: "Erro ao listar cupons." });
  }
});

// criar cupom
router.post("/", authRequired, adminOnly, async (req, res) => {
  try {
    const { code, discount_percent, active } = req.body;

    if (!code || !discount_percent) {
      return res.status(400).json({ message: "Código e desconto são obrigatórios." });
    }

    const id = crypto.randomUUID();

    await pool.execute(
      `
      INSERT INTO coupons (id, code, discount_percent, active)
      VALUES (?, ?, ?, ?)
      `,
      [
        id,
        String(code).trim().toUpperCase(),
        Number(discount_percent),
        active ? 1 : 0,
      ]
    );

    res.status(201).json({ message: "Cupom criado com sucesso." });
  } catch (error) {
    console.error("Erro ao criar cupom:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Já existe um cupom com esse código." });
    }

    res.status(500).json({ message: "Erro ao criar cupom." });
  }
});

// editar cupom
router.put("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discount_percent, active } = req.body;

    if (!code || !discount_percent) {
      return res.status(400).json({ message: "Código e desconto são obrigatórios." });
    }

    await pool.execute(
      `
      UPDATE coupons
      SET code = ?, discount_percent = ?, active = ?
      WHERE id = ?
      `,
      [
        String(code).trim().toUpperCase(),
        Number(discount_percent),
        active ? 1 : 0,
        id,
      ]
    );

    res.json({ message: "Cupom atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar cupom:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Já existe um cupom com esse código." });
    }

    res.status(500).json({ message: "Erro ao atualizar cupom." });
  }
});

// excluir cupom
router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(`DELETE FROM coupons WHERE id = ?`, [id]);

    res.json({ message: "Cupom excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir cupom:", error);
    res.status(500).json({ message: "Erro ao excluir cupom." });
  }
});

// validar cupom para o carrinho
router.post("/validate", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Informe o cupom." });
    }

    const [rows] = await pool.execute(
      `
      SELECT id, code, discount_percent, active
      FROM coupons
      WHERE UPPER(code) = UPPER(?)
      LIMIT 1
      `,
      [String(code).trim()]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Cupom não encontrado." });
    }

    const coupon = rows[0];

    if (!coupon.active) {
      return res.status(400).json({ message: "Cupom inativo." });
    }

    res.json({
      id: coupon.id,
      code: coupon.code,
      discount_percent: Number(coupon.discount_percent),
      active: !!coupon.active,
    });
  } catch (error) {
    console.error("Erro ao validar cupom:", error);
    res.status(500).json({ message: "Erro ao validar cupom." });
  }
});

module.exports = router;