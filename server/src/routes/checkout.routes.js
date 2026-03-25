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

router.post("/create-preference", async (req, res) => {
  let connection;

  try {
    const { items, customerName, customerEmail } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ message: "Nome do cliente é obrigatório" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Carrinho vazio" });
    }

    const formattedItems = items.map((item) => ({
      title: String(item.name || "").trim(),
      quantity: Number(item.quantity),
      currency_id: "BRL",
      unit_price: toMoney(item.price),
    }));

    const hasInvalidItem = formattedItems.some(
      (item) =>
        !item.title ||
        Number.isNaN(item.quantity) ||
        Number.isNaN(item.unit_price) ||
        item.quantity <= 0 ||
        item.unit_price <= 0
    );

    if (hasInvalidItem) {
      return res.status(400).json({
        message: "Há itens inválidos no carrinho",
      });
    }

    const totalAmount = formattedItems.reduce((total, item) => {
      return total + item.quantity * item.unit_price;
    }, 0);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orderResult] = await connection.execute(
      `
      INSERT INTO orders (
        customer_name,
        customer_email,
        total_amount,
        status
      ) VALUES (?, ?, ?, ?)
      `,
      [
        customerName.trim(),
        customerEmail ? customerEmail.trim() : null,
        totalAmount,
        "pending",
      ]
    );

    const orderId = orderResult.insertId;
    const externalReference = String(orderId);

    for (const item of formattedItems) {
      const lineTotal = item.quantity * item.unit_price;

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
          lineTotal,
        ]
      );
    }

    const preference = new mercadopago.Preference(client);

    const result = await preference.create({
      body: {
        items: formattedItems,
        external_reference: externalReference,
        back_urls: {
          success: "https://campolimporp.com.br/sucesso",
          failure: "https://campolimporp.com.br/erro",
          pending: "https://campolimporp.com.br/pendente",
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
        customerName.trim(),
        "order_created",
        `Pedido criado com ${formattedItems.length} item(ns). Aguardando pagamento.`,
        totalAmount,
        "pending",
      ]
    );

    await connection.commit();

    return res.json({
      orderId,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Erro Mercado Pago ao criar preferência:", error);

    return res.status(500).json({
      message: "Erro ao criar pagamento",
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post("/webhook", async (req, res) => {
  let connection;

  try {
    console.log("Webhook Mercado Pago recebido:", req.body);

    const paymentId = req.body?.data?.id;
    const type = req.body?.type;

    if (type !== "payment" || !paymentId) {
      return res.sendStatus(200);
    }

    const paymentApi = new mercadopago.Payment(client);

    const paymentResponse = await paymentApi.get({
      id: paymentId,
    });

    const payment = paymentResponse?.response || paymentResponse;

    console.log("Pagamento consultado:", payment);

    const paymentStatus = payment?.status || null;
    const externalReference = payment?.external_reference || null;
    const transactionAmount = Number(payment?.transaction_amount || 0);

    if (!externalReference) {
      console.warn("Pagamento sem external_reference:", paymentId);
      return res.sendStatus(200);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orders] = await connection.execute(
      `
      SELECT id, customer_name, status
      FROM orders
      WHERE id = ?
      LIMIT 1
      `,
      [externalReference]
    );

    if (!orders.length) {
      console.warn("Pedido não encontrado para external_reference:", externalReference);
      await connection.commit();
      return res.sendStatus(200);
    }

    const order = orders[0];

    const [items] = await connection.execute(
      `
      SELECT product_name, quantity, unit_price, line_total
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
      `,
      [order.id]
    );

    const itemsDescription = items
      .map(
        (item) =>
          `${item.product_name} x${item.quantity} - R$ ${Number(item.line_total).toFixed(2)}`
      )
      .join(" | ");

    if (paymentStatus === "approved") {
      if (order.status !== "paid") {
        await connection.execute(
          `
          UPDATE orders
          SET
            status = 'paid',
            payment_id = ?,
            total_amount = ?
          WHERE id = ?
          `,
          [String(paymentId), transactionAmount, order.id]
        );

        await connection.execute(
          `
          INSERT INTO payment_logs (
            order_id,
            customer_name,
            action,
            description,
            amount,
            payment_id,
            payment_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            order.id,
            order.customer_name,
            "payment_approved",
            `Cliente ${order.customer_name} pediu: ${itemsDescription}`,
            transactionAmount,
            String(paymentId),
            paymentStatus,
          ]
        );

        console.log(`Pagamento aprovado e pedido ${order.id} atualizado.`);
      }
    } else {
      await connection.execute(
        `
        INSERT INTO payment_logs (
          order_id,
          customer_name,
          action,
          description,
          amount,
          payment_id,
          payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          order.id,
          order.customer_name,
          "payment_update",
          `Atualização de pagamento. Itens: ${itemsDescription}`,
          transactionAmount,
          String(paymentId),
          paymentStatus,
        ]
      );
    }

    await connection.commit();
    return res.sendStatus(200);
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Erro no webhook do Mercado Pago:", error);
    return res.sendStatus(500);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;