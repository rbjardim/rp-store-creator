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

    if (req.headers["x-webhook-secret"] !== process.env.INTERNAL_WEBHOOK_SECRET) {
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

    const firstItem = items?.[0];
    const firstImageUrl = getFullImageUrl(firstItem?.image_url);

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
        content: `📦 Nova doação aprovada para <@${order.discord_id}>`,
        embeds: [
          {
            title: "🎉 Nova doação aprovada!",
            description:
              "Uma nova doação foi confirmada na **Loja de Doações do Campo Limpo**.",
            color: 5763719,
            fields: [
              {
                name: "👤 Comprador",
                value: `${order.customer_name}\n${order.customer_email}`,
                inline: true,
              },
              {
                name: "🎮 ID Personagem",
                value: String(order.character_id),
                inline: true,
              },
              {
                name: "💬 Discord",
                value: `<@${order.discord_id}>\n\`${order.discord_username}\``,
                inline: true,
              },
              {
                name: "🛒 Item(ns)",
                value: itemsText || "Nenhum item informado",
                inline: false,
              },
              {
                name: "💰 Total",
                value: formatBRL(order.total_amount),
                inline: true,
              },
              {
                name: "💳 Pagamento",
                value: String(paymentMethod),
                inline: true,
              },
              {
                name: "🧾 ID Pagamento",
                value: String(payment.id),
                inline: false,
              },
            ],
            image: firstImageUrl ? { url: firstImageUrl } : undefined,
            footer: {
              text: `Pedido #${order.id}`,
            },
            timestamp: new Date().toISOString(),
          },
        ],
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
              content:
                `Olá, <@${order.discord_id}>! 🎉\n\n` +
                `Sua doação na **Loja de Doações do Campo Limpo** foi confirmada com sucesso.\n` +
                `O item adquirido já foi registrado em nosso sistema. Guarde esta mensagem como comprovante. ❤️`,
              embeds: [
                {
                  title: `✅ Item adquirido: ${item.product_name}`,
                  description:
                    `Muito obrigado por apoiar o **Campo Limpo Roleplay**!\n\n` +
                    `Caso precise de suporte, informe o número do pedido para a equipe.`,
                  color: 5763719,
                  fields: [
                    {
                      name: "🎮 ID Personagem",
                      value: String(order.character_id),
                      inline: true,
                    },
                    {
                      name: "📦 Quantidade",
                      value: String(item.quantity),
                      inline: true,
                    },
                    {
                      name: "💰 Valor",
                      value: formatBRL(item.line_total),
                      inline: true,
                    },
                    {
                      name: "💳 Forma de pagamento",
                      value: String(paymentMethod),
                      inline: true,
                    },
                    {
                      name: "🧾 Pedido",
                      value: `#${order.id}`,
                      inline: true,
                    },
                  ],
                  image: imageUrl ? { url: imageUrl } : undefined,
                  footer: {
                    text: "Loja de Doações • Campo Limpo Roleplay",
                  },
                  timestamp: new Date().toISOString(),
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