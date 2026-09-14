const express = require("express");
const pool = require("../db");
const router = express.Router();

function authorized(req, res, next) {
  const expected = process.env.GAME_DELIVERY_SECRET;
  const provided = req.headers["x-delivery-secret"];

  console.log("[DELIVERY AUTH]", {
    expectedConfigured: !!expected,
    providedConfigured: !!provided,
    expectedLength: expected ? expected.length : 0,
    providedLength: provided ? provided.length : 0,
    sameSecret: expected === provided,
  });

  if (!expected || provided !== expected) {
    return res.status(401).json({ message: "Não autorizado." });
  }

  next();
}

router.post("/claim", authorized, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.body?.limit) || 20, 1), 50);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM store_deliveries
       WHERE status IN ('pending','failed') AND attempts < 10
       ORDER BY id ASC LIMIT ? FOR UPDATE`, [limit]
    );
    if (!rows.length) { await connection.commit(); return res.json([]); }
    const ids = rows.map(r => r.id);
    await connection.query(
      `UPDATE store_deliveries SET status='processing', attempts=attempts+1, last_attempt_at=NOW()
       WHERE id IN (${ids.map(()=>'?').join(',')})`, ids
    );
    await connection.commit();
    res.json(rows);
  } catch (e) {
    await connection.rollback();
    console.error("Erro ao reservar entregas:", e);
    res.status(500).json({ message: "Erro ao reservar entregas." });
  } finally { connection.release(); }
});

router.post("/:id/complete", authorized, async (req, res) => {
  await pool.execute(
    `UPDATE store_deliveries SET status='delivered', delivered_at=NOW(), last_error=NULL WHERE id=?`,
    [req.params.id]
  );
  res.json({ ok: true });
});

router.post("/:id/fail", authorized, async (req, res) => {
  const error = String(req.body?.error || "Falha não informada").slice(0, 1000);
  await pool.execute(
    `UPDATE store_deliveries SET status='failed', last_error=? WHERE id=?`,
    [error, req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
