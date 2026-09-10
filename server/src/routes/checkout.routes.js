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
    const { items, couponCode, customer, vipRecipients = {} } = req.body;
    const customerName = String(customer?.name || "").trim();
    const customerEmail = String(customer?.email || "").trim();
    const characterId = String(customer?.characterId || "").trim();
    const discordId = String(customer?.discordId || "").trim();
    const discordUsername = String(customer?.discordUsername || "").trim();

    if (!customerName) return res.status(400).json({ message: "Informe seu nome." });
    if (!customerEmail) return res.status(400).json({ message: "Informe seu email." });
    if (!/^\d+$/.test(characterId)) return res.status(400).json({ message: "Informe um ID de personagem válido." });
    if (!discordId || !discordUsername) return res.status(400).json({ message: "Conecte o Discord." });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: "Carrinho vazio." });

    const requested = items.map(i => ({ id: String(i.id || ""), quantity: Math.max(1, Number(i.quantity) || 1) }));
    if (requested.some(i => !i.id)) return res.status(400).json({ message: "Produto inválido no carrinho." });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const ids = [...new Set(requested.map(i => i.id))];
    const [products] = await connection.query(
      `SELECT id,name,price,image_data,delivery_type,delivery_value,delivery_amount,delivery_days,vip_max_members
       FROM products WHERE active=1 AND id IN (${ids.map(()=>'?').join(',')})`, ids
    );
    if (products.length !== ids.length) throw new Error("Um ou mais produtos não existem ou estão inativos.");
    const byId = new Map(products.map(p => [String(p.id), p]));

    const normalizedItems = [];
    for (const reqItem of requested) {
      const product = byId.get(reqItem.id);
      const item = {
        product_id: String(product.id), title: product.name, quantity: reqItem.quantity,
        currency_id: "BRL", unit_price: toMoney(product.price),
        image_url: product.image_data ? `/api/products/${product.id}/image` : null,
        delivery_type: product.delivery_type || "none", delivery_value: product.delivery_value || null,
        delivery_amount: Number(product.delivery_amount || 1), delivery_days: Number(product.delivery_days || 0),
        vip_max_members: Number(product.vip_max_members || 0), recipients: []
      };
      if (item.delivery_type === "vip_fac") {
        const raw = Array.isArray(vipRecipients[item.product_id]) ? vipRecipients[item.product_id] : [];
        item.recipients = [...new Set(raw.map(v => String(v).trim()).filter(v => /^\d+$/.test(v)))];
        const maxAllowed = Math.max(1, item.vip_max_members) * item.quantity;
        if (!item.recipients.length) throw new Error(`Informe os IDs que receberão ${item.title}.`);
        if (item.recipients.length > maxAllowed) throw new Error(`${item.title} permite no máximo ${maxAllowed} ID(s).`);
        if (item.recipients.length !== raw.map(v=>String(v).trim()).filter(Boolean).length) {
          throw new Error(`${item.title}: existem IDs inválidos ou repetidos.`);
        }
      }
      normalizedItems.push(item);
    }

    const subtotal = round2(normalizedItems.reduce((t,i)=>t+i.quantity*i.unit_price,0));
    let discountPercent=0, discountAmount=0, coupon=null;
    if (couponCode) {
      const [rows] = await connection.execute(`SELECT * FROM coupons WHERE UPPER(code)=UPPER(?) LIMIT 1`, [couponCode]);
      if (rows.length && rows[0].active) { coupon=rows[0]; discountPercent=Number(coupon.discount_percent||0); discountAmount=round2(subtotal*discountPercent/100); }
    }
    const totalAmount=round2(subtotal-discountAmount);
    const [orderResult]=await connection.execute(
      `INSERT INTO orders (customer_name,customer_email,character_id,discord_id,discord_username,total_amount,status,coupon_code,discount_percent,discount_amount,subtotal_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [customerName,customerEmail,characterId,discordId,discordUsername,totalAmount,"pending",coupon?coupon.code:null,discountPercent,discountAmount,subtotal]
    );
    const orderId=orderResult.insertId;

    for (const item of normalizedItems) {
      const [itemResult] = await connection.execute(
        `INSERT INTO order_items (order_id,product_id,product_name,image_url,quantity,unit_price,line_total,delivery_type,delivery_value,delivery_amount,delivery_days,vip_max_members)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [orderId,item.product_id,item.title,item.image_url,item.quantity,item.unit_price,round2(item.quantity*item.unit_price),item.delivery_type,item.delivery_value,item.delivery_amount,item.delivery_days,item.vip_max_members]
      );
      for (const recipient of item.recipients) {
        await connection.execute(`INSERT INTO order_item_recipients (order_item_id,character_id) VALUES (?,?)`, [itemResult.insertId, recipient]);
      }
    }

    const preference=new mercadopago.Preference(client);
    const result=await preference.create({body:{
      items: normalizedItems.map(i=>({title:i.title,quantity:i.quantity,currency_id:"BRL",unit_price:i.unit_price})),
      external_reference:String(orderId),
      notification_url:"https://api.campolimporp.com.br/api/checkout/webhook",
      back_urls:{success:"https://loja.campolimporp.com.br/sucesso",failure:"https://loja.campolimporp.com.br/erro",pending:"https://loja.campolimporp.com.br/pendente"},
      auto_return:"approved"
    }});
    await connection.execute(`UPDATE orders SET preference_id=?, init_point=?, external_reference=? WHERE id=?`, [result.id||null,result.init_point||null,String(orderId),orderId]);
    await connection.commit();
    res.json({orderId,init_point:result.init_point,sandbox_init_point:result.sandbox_init_point});
  } catch(error) {
    if(connection) await connection.rollback();
    console.error("Erro checkout:",error);
    res.status(400).json({message:error.message||"Erro ao criar pagamento."});
  } finally { if(connection) connection.release(); }
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


    // Gera a fila de entrega apenas uma vez por item/destinatário.
    for (const item of items) {
      if (!item.delivery_type || item.delivery_type === "none") continue;

      let recipients = [String(order.character_id)];
      if (item.delivery_type === "vip_fac") {
        const [recipientRows] = await connection.execute(
          `SELECT character_id FROM order_item_recipients WHERE order_item_id = ?`, [item.id]
        );
        recipients = recipientRows.map(r => String(r.character_id));
      }

      for (const recipient of recipients) {
        const type = item.delivery_type === "vip_fac" ? "group" : item.delivery_type;
        const amount = ["item","coins"].includes(type)
          ? Number(item.delivery_amount || 1) * Number(item.quantity || 1)
          : Number(item.delivery_amount || 1);
        const dedupeKey = `${orderId}:${item.id}:${recipient}:${type}`;
        await connection.execute(
          `INSERT IGNORE INTO store_deliveries
           (dedupe_key,order_id,order_item_id,character_id,delivery_type,delivery_value,delivery_amount,delivery_days,status)
           VALUES (?,?,?,?,?,?,?,?, 'pending')`,
          [dedupeKey,orderId,item.id,recipient,type,item.delivery_value,amount,Number(item.delivery_days||0)]
        );
      }
    }

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