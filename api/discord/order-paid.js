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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Método não permitido" });
    }

    const secret = req.headers["x-webhook-secret"];

    if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { order, items, payment } = req.body;

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const categoryId = process.env.DISCORD_CATEGORY_ID;

    if (!botToken || !guildId || !categoryId) {
      return res.status(500).json({ message: "Discord ENV não configurado" });
    }

    const paymentMethod =
      payment.payment_method_id || payment.payment_type_id || "Não informado";

    const channelName = `doacao-${cleanChannelName(order.discord_username)}`;

    const channelRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: channelName,
          type: 0,
          parent_id: categoryId,
        }),
      }
    );

    const channelData = await channelRes.json();

    if (!channelRes.ok) {
      return res.status(channelRes.status).json({
        message: "Erro ao criar canal",
        details: channelData,
      });
    }

    const channelId = channelData.id;

    const itemsText = items
      .map(
        (i) =>
          `• **${i.product_name}** x${i.quantity} — ${formatBRL(i.line_total)}`
      )
      .join("\n");

    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    });

    try {
      const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient_id: order.discord_id,
        }),
      });

      const dmData = await dmRes.json();

      if (dmRes.ok) {
        for (const item of items) {
          const imageUrl = getFullImageUrl(item.image_url);

          await fetch(`https://discord.com/api/v10/channels/${dmData.id}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: "✅ **Item adquirido com sucesso!**",
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
            }),
          });
        }
      }
    } catch {}

    return res.status(200).json({ channelId });
  } catch (error) {
    return res.status(500).json({
      message: "Erro interno no proxy Discord",
      error: error.message,
    });
  }
}