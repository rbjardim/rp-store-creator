const express = require("express");
const mercadopago = require("mercadopago");
const pool = require("../db");

const router = express.Router();

const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

function toMoney(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function round2(value) {
  return Number(Number(value).toFixed(2));
}

router.post("/create-preference", async (req, res) => {
  let connection;

  try {
    console.log("CHECKOUT NOVO EXECUTADO");
    console.log("BODY:", req.body);

    const { items, couponCode, customer } = req.body;

    const customerName = String(customer?.name || "").trim();
    const customerEmail = String(customer?.email || "").trim();
    const characterId = String(customer?.characterId || "").trim();
    const discordId = String(customer?.discordId || "").trim();
    const discordUsername = String(customer?.discordUsername || "").trim();

    if (!customerName) {
      return res.status(400).json({ message: "Informe seu nome completo." });
    }

    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({ message: "Informe um e-mail válido." });
    }

    if (!characterId) {
      return res.status(400).json({ message: "Informe o ID do personagem." });
    }

    if (!discordId || !discordUsername) {
      return res.status(400).json({ message: "Conecte sua conta do Discord antes de finalizar a compra." });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Carrinho vazio" });
    }

    const normalizedItems = items.map((item) => ({
      title: String(item.name || "").trim(),
      quantity: Number(item.quantity),
      currency_id: "BRL",
      unit_price: toMoney(item.price),
    }));

    const hasInvalidItem = normalizedItems.some(
      (item) =>
        !item.title ||
        Number.isNaN(item.quantity) ||
        Number.isNaN(item.unit_price) ||
        item.quantity <= 0 ||
        item.unit_price <= 0
    );

    if (hasInvalidItem) {
      return res.status(400).json({ message: "Itens inválidos no carrinho" });
    }

    const subtotal = round2(
      normalizedItems.reduce((total, item) => {
        return total + item.quantity * item.unit_price;
      }, 0)
    );

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let coupon = null;
    let discountPercent = 0;
    let discountAmount = 0;

    if (couponCode && String(couponCode).trim()) {
      const [couponRows] = await connection.execute(
        `
        SELECT id, code, discount_percent, active
        FROM coupons
        WHERE UPPER(code) = UPPER(?)
        LIMIT 1
        `,
        [String(couponCode).trim()]
      );

      if (!couponRows.length) {
        await connection.rollback();
        return res.status(400).json({ message: "Cupom não encontrado." });
      }

      coupon = couponRows[0];

      if (!coupon.active) {
        await connection.rollback();
        return res.status(400).json({ message: "Cupom inativo." });
      }

      discountPercent = Number(coupon.discount_percent || 0);
      discountAmount = round2((subtotal * discountPercent) / 100);
    }

    const totalAmount = round2(subtotal - discountAmount);

    if (totalAmount <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Total inválido após aplicar o cupom." });
    }

    // distribui o desconto proporcionalmente entre os itens
    let remainingDiscount = discountAmount;

    const formattedItems = normalizedItems.map((item, index) => {
      const itemTotal = round2(item.unit_price * item.quantity);

      let itemDiscount = 0;
      if (discountAmount > 0) {
        if (index === normalizedItems.length - 1) {
          itemDiscount = remainingDiscount;
        } else {
          itemDiscount = round2((itemTotal / subtotal) * discountAmount);
          remainingDiscount = round2(remainingDiscount - itemDiscount);
        }
      }

      const finalLineTotal = round2(itemTotal - itemDiscount);
      const finalUnitPrice = round2(finalLineTotal / item.quantity);

      return {
        title: item.title,
        quantity: item.quantity,
        currency_id: "BRL",
        unit_price: finalUnitPrice,
        original_unit_price: item.unit_price,
        line_total: finalLineTotal,
      };
    });

    const [orderResult] = await connection.execute(
      `
      INSERT INTO orders (
        customer_name,
        customer_email,
        character_id,
        discord_id,
        discord_username,
        total_amount,
        status,
        coupon_code,
        discount_percent,
        discount_amount,
        subtotal_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        customerName,
        customerEmail,
        characterId,
        discordId,
        discordUsername,
        totalAmount,
        "pending",
        coupon ? coupon.code : null,
        discountPercent || 0,
        discountAmount || 0,
        subtotal,
      ]
    );

    const orderId = orderResult.insertId;
    const externalReference = String(orderId);

    for (const item of formattedItems) {
      await connection.execute(
        `
        INSERT INTO order_items (
          order_id,
          product_name,
          quantity,
          unit_price,
          line_total
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.title,
          item.quantity,
          item.unit_price,
          item.line_total,
        ]
      );
    }

    const preference = new mercadopago.Preference(client);

    const result = await preference.create({
      body: {
        items: formattedItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          currency_id: item.currency_id,
          unit_price: item.unit_price,
        })),
        external_reference: externalReference,
        back_urls: {
          success: "https://loja.campolimporp.com.br/sucesso",
          failure: "https://loja.campolimporp.com.br/erro",
          pending: "https://loja.campolimporp.com.br/pendente",
        },
        auto_return: "approved",
        notification_url: "https://api.campolimporp.com.br/api/checkout/webhook",
      },
    });

    await connection.execute(
      `
      UPDATE orders
      SET
        preference_id = ?,
        init_point = ?,
        external_reference = ?
      WHERE id = ?
      `,
      [
        result.id || null,
        result.init_point || null,
        externalReference,
        orderId,
      ]
    );

    await connection.execute(
      `
      INSERT INTO payment_logs (
        order_id,
        customer_name,
        action,
        description,
        amount,
        payment_status
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        orderId,
        customerName,
        "order_created",
        coupon
          ? `Pedido criado com ${formattedItems.length} item(ns) | Cupom ${coupon.code} aplicado | Personagem ID ${characterId} | Discord ${discordUsername} (${discordId})`
          : `Pedido criado com ${formattedItems.length} item(ns) | Personagem ID ${characterId} | Discord ${discordUsername} (${discordId})`,
        totalAmount,
        "pending",
      ]
    );

    await connection.commit();

    return res.json({
      orderId,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
      subtotal,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      coupon_code: coupon ? coupon.code : null,
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Erro ao criar pagamento:", error);

    return res.status(500).json({
      message: "Erro ao criar pagamento",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;