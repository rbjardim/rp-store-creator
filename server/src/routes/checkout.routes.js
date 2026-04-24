const express = require("express");
const mercadopago = require("mercadopago");
const axios = require("axios");
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

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function cleanChannelName(name) {
  return String(name || "usuario")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function getFullImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (String(imageUrl).startsWith("http")) return imageUrl;

  const apiBase = process.env.API_PUBLIC_URL || "https://api.campolimporp.com.br";
  return `${apiBase.replace(/\/$/, "")}${imageUrl}`;
}

async function createDiscordChannelAndNotify(order, items, payment) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const categoryId = process.env.DISCORD_CATEGORY_ID;

  if (!botToken || !guildId || !categoryId) {
    console.log("Discord bot/env não configurado.");
    return null;
  }

  const paymentMethod =
    payment.payment_method_id || payment.payment_type_id || "Não informado";

  const channelName = `doacao-${cleanChannelName(order.discord_username)}`;

  const channelRes = await axios.post(
    `https://discord.com/api/v10/guilds/${guildId}/channels`,
    {
      name: channelName,
      type: 0,
      parent_id: categoryId,
    },
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const channelId = channelRes.data.id;

  const itemsText = items
    .map(
      (i) =>
        `• **${i.product_name}** x${i.quantity} — ${formatBRL(i.line_total)}`
    )
    .join("\n");

  await axios.post(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      content: `
🎉 **Nova doação aprovada!**

👤 **Nome:** ${order.customer_name}
📧 **Email:** ${order.customer_email}
🎮 **ID Personagem:** ${order.character_id}
💬 **Discord:** <@${order.discord_id}>

🛒 **Itens:**
${itemsText}

💰 **Total:** ${formatBRL(order.total_amount)}
💳 **Forma de pagamento:** ${paymentMethod}
🧾 **Pagamento ID:** ${payment.id}
      `,
    },
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  // DM para usuário
  try {
    const dmRes = await axios.post(
      "https://discord.com/api/v10/users/@me/channels",
      {
        recipient_id: order.discord_id,
      },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const dmChannelId = dmRes.data.id;

    for (const item of items) {
      const imageUrl = getFullImageUrl(item.image_url);

      await axios.post(
        `https://discord.com/api/v10/channels/${dmChannelId}/messages`,
        {
          content: `✅ **Item adquirido com sucesso!**`,
          embeds: [
            {
              title: item.product_name,
              description: `
🎮 **ID Personagem:** ${order.character_id}
📧 **Email:** ${order.customer_email}

📦 **Quantidade:** ${item.quantity}
💰 **Preço:** ${formatBRL(item.line_total)}
💳 **Forma de pagamento:** ${paymentMethod}

Obrigado pela sua doação! ❤️
              `,
              color: 5763719,
              image: imageUrl ? { url: imageUrl } : undefined,
              footer: {
                text: `Pedido #${order.id}`,
              },
            },
          ],
        },
        {
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (dmError) {
    console.log(
      "Não foi possível enviar DM:",
      dmError.response?.data || dmError.message
    );
  }

  return channelId;
}

router.post("/create-preference", async (req, res) => {
  let connection;

  try {
    const {
      items,
      couponCode,
      customer,
      customerName: rawName,
      customerEmail: rawEmail,
      characterId: rawCharacterId,
      discordId: rawDiscordId,
      discordUsername: rawDiscordUsername,
    } = req.body;

    const customerName = String(customer?.name || rawName || "").trim();
    const customerEmail = String(customer?.email || rawEmail || "").trim();
    const characterId = String(customer?.characterId || rawCharacterId || "").trim();
    const discordId = String(customer?.discordId || rawDiscordId || "").trim();
    const discordUsername = String(
      customer?.discordUsername || rawDiscordUsername || ""
    ).trim();

    if (!customerName) return res.status(400).json({ message: "Informe seu nome." });
    if (!customerEmail) return res.status(400).json({ message: "Informe seu email." });
    if (!characterId) return res.status(400).json({ message: "Informe o ID do personagem." });
    if (!discordId || !discordUsername) {
      return res.status(400).json({ message: "Conecte o Discord." });
    }
    if (!items || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "Carrinho vazio." });
    }

    const normalizedItems = items.map((item) => ({
      title: String(item.name || "").trim(),
      quantity: Number(item.quantity),
      currency_id: "BRL",
      unit_price: toMoney(item.price),
      image_url: item.image_url || null,
    }));

    const subtotal = round2(
      normalizedItems.reduce((t, i) => t + i.quantity * i.unit_price, 0)
    );

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let discountPercent = 0;
    let discountAmount = 0;
    let coupon = null;

    if (couponCode) {
      const [rows] = await connection.execute(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) LIMIT 1`,
        [couponCode]
      );

      if (rows.length && rows[0].active) {
        coupon = rows[0];
        discountPercent = Number(coupon.discount_percent || 0);
        discountAmount = round2((subtotal * discountPercent) / 100);
      }
    }

    const totalAmount = round2(subtotal - discountAmount);

    const [orderResult] = await connection.execute(
      `INSERT INTO orders (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerName,
        customerEmail,
        characterId,
        discordId,
        discordUsername,
        totalAmount,
        "pending",
        coupon ? coupon.code : null,
        discountPercent,
        discountAmount,
        subtotal,
      ]
    );

    const orderId = orderResult.insertId;

    for (const item of normalizedItems) {
      await connection.execute(
        `INSERT INTO order_items (
          order_id,
          product_name,
          image_url,
          quantity,
          unit_price,
          line_total
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.title,
          item.image_url,
          item.quantity,
          item.unit_price,
          round2(item.quantity * item.unit_price),
        ]
      );
    }

    const preference = new mercadopago.Preference(client);

    const result = await preference.create({
      body: {
        items: normalizedItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          currency_id: "BRL",
          unit_price: item.unit_price,
        })),
        external_reference: String(orderId),
        notification_url:
          "https://api.campolimporp.com.br/api/checkout/webhook",
        back_urls: {
        success: "https://loja.campolimporp.com.br/sucesso",
        failure: "https://loja.campolimporp.com.br/erro",
        pending: "https://loja.campolimporp.com.br/pendente",
      },
      auto_return: "approved",
      },
    });

    await connection.execute(
      `UPDATE orders
       SET preference_id = ?, init_point = ?, external_reference = ?
       WHERE id = ?`,
      [result.id || null, result.init_point || null, String(orderId), orderId]
    );

    await connection.commit();

    return res.json({
      orderId,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Erro checkout:", error);
    return res.status(500).json({
      message: "Erro ao criar pagamento.",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/webhook", async (req, res) => {
  let connection;

  try {
    const paymentId = req.query["data.id"] || req.body?.data?.id;

    if (!paymentId) return res.sendStatus(200);

    const mpRes = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = mpRes.data;

    if (payment.status !== "approved") {
      return res.sendStatus(200);
    }

    const orderId = payment.external_reference;

    if (!orderId) return res.sendStatus(200);

    connection = await pool.getConnection();

    const [orders] = await connection.execute(
      `SELECT * FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );

    if (!orders.length) return res.sendStatus(200);

    const order = orders[0];

    if (order.status === "paid") return res.sendStatus(200);

    const [items] = await connection.execute(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
    );

    await connection.execute(
      `UPDATE orders
       SET status = ?, payment_id = ?
       WHERE id = ?`,
      ["paid", String(payment.id), orderId]
    );

    try {
      const discordRes = await axios.post(
        `${process.env.DISCORD_PROXY_URL}/api/discord/order-paid`,
        {
          order,
          items,
          payment,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": process.env.INTERNAL_WEBHOOK_SECRET,
          },
        }
      );

      const channelId = discordRes.data?.channelId || null;

      if (channelId) {
        await connection.execute(
          `UPDATE orders
           SET discord_channel_id = ?
           WHERE id = ?`,
          [channelId, orderId]
        );
      }
    } catch (discordError) {
      console.error("🔥 ERRO DISCORD PROXY:", {
        message: discordError.message,
        status: discordError.response?.status,
        data: discordError.response?.data,
      });
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("🔥 ERRO COMPLETO WEBHOOK:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    return res.sendStatus(200);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;