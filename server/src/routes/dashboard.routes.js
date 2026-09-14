const express = require("express");
const pool = require("../db");
const { authRequired, adminOnly } = require("../middlewares/auth");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| DASHBOARD ADMIN
|--------------------------------------------------------------------------
| Retorna:
| - totais gerais
| - pedidos
| - pedidos pagos
| - cupons utilizados
| - valor total recebido
| - vendas do dia
| - data de expiração
|--------------------------------------------------------------------------
*/

router.get("/", authRequired, adminOnly, async (req, res) => {
  try {
    const [orders] = await pool.execute(`
      SELECT
        id,
        id AS order_number,
        customer_name,
        customer_email,
        character_id,
        discord_id,
        discord_username,

        status,
        status AS payment_status,

        subtotal_amount AS subtotal,
        discount_amount,
        discount_percent AS coupon_discount,
        total_amount AS total,

        CASE
          WHEN status = 'paid' THEN total_amount
          ELSE 0
        END AS paid_amount,

        coupon_code,
        payment_id,

        created_at,

        CASE
          WHEN status = 'paid' THEN paid_at
          ELSE NULL
        END AS paid_at,

        payment_method,

        expires_at

      FROM orders
      ORDER BY created_at DESC, id DESC
    `);

    const [totalsRows] = await pool.execute(`
      SELECT
        COUNT(*) AS orders,

        SUM(
          CASE
            WHEN status = 'paid' THEN 1
            ELSE 0
          END
        ) AS paid_orders,

        COALESCE(
          SUM(
            CASE
              WHEN status = 'paid' THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS total_payments,

        COALESCE(
          SUM(
            CASE
              WHEN status = 'paid'
               AND DATE(paid_at) = CURDATE()
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS sales_today,

        SUM(
          CASE
            WHEN coupon_code IS NOT NULL
             AND TRIM(coupon_code) <> ''
            THEN 1
            ELSE 0
          END
        ) AS coupons_used,

        SUM(
          CASE
            WHEN status = 'pending' THEN 1
            ELSE 0
          END
        ) AS pending_orders

      FROM orders
    `);

    const totals = totalsRows[0] || {};

    return res.json({
      totals: {
        orders: Number(totals.orders || 0),
        paid_orders: Number(totals.paid_orders || 0),
        total_payments: Number(totals.total_payments || 0),
        sales_today: Number(totals.sales_today || 0),
        coupons_used: Number(totals.coupons_used || 0),
        pending_orders: Number(totals.pending_orders || 0),
      },

      orders: orders.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal || 0),
        discount_amount: Number(order.discount_amount || 0),
        coupon_discount: Number(order.coupon_discount || 0),
        total: Number(order.total || 0),
        paid_amount: Number(order.paid_amount || 0),
      })),
    });
  } catch (error) {
    console.error("Erro ao carregar dashboard administrativo:", error);

    return res.status(500).json({
      message: "Erro ao carregar dashboard administrativo.",
      error: error.message,
    });
  }
});

module.exports = router;
