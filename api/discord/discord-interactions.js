import nacl from "tweetnacl";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).end();
    }

    const rawBody = await getRawBody(req);

    const signature = req.headers["x-signature-ed25519"];
    const timestamp = req.headers["x-signature-timestamp"];

    if (!signature || !timestamp || !process.env.DISCORD_PUBLIC_KEY) {
      console.error("Faltando assinatura, timestamp ou PUBLIC KEY");
      return res.status(401).end("missing signature");
    }

    const isValid = nacl.sign.detached.verify(
      Buffer.concat([
        Buffer.from(timestamp),
        rawBody,
      ]),
      Buffer.from(signature, "hex"),
      Buffer.from(process.env.DISCORD_PUBLIC_KEY, "hex")
    );

    if (!isValid) {
      console.error("Assinatura inválida");
      return res.status(401).end("invalid request signature");
    }

    const interaction = JSON.parse(rawBody.toString());

    // 🔁 PING (obrigatório)
    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    // 🔘 BOTÕES
    if (interaction.type === 3) {
      const customId = interaction.data.custom_id;
      const channelId = interaction.channel_id;

      // 🔒 FECHAR TICKET
      if (customId === "ticket_close") {
        res.status(200).json({
          type: 4,
          data: {
            content: "🔒 Fechando ticket...",
            flags: 64,
          },
        });

        setTimeout(async () => {
          try {
            await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              },
            });
          } catch (e) {
            console.error("Erro ao deletar canal:", e);
          }
        }, 1000);

        return;
      }

      // ➕ ADD USER
      if (customId === "ticket_add_user") {
        return res.status(200).json({
          type: 9,
          data: {
            title: "Adicionar usuário",
            custom_id: "modal_add_user",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: "user_id",
                    label: "ID do usuário",
                    style: 1,
                    required: true,
                  },
                ],
              },
            ],
          },
        });
      }

      // ➖ REMOVE USER
      if (customId === "ticket_remove_user") {
        return res.status(200).json({
          type: 9,
          data: {
            title: "Remover usuário",
            custom_id: "modal_remove_user",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: "user_id",
                    label: "ID do usuário",
                    style: 1,
                    required: true,
                  },
                ],
              },
            ],
          },
        });
      }
    }

    // 📩 MODAIS
    if (interaction.type === 5) {
      const modalId = interaction.data.custom_id;
      const channelId = interaction.channel_id;
      const userId =
        interaction.data.components[0].components[0].value;

      // ➕ ADICIONAR
      if (modalId === "modal_add_user") {
        await fetch(
          `https://discord.com/api/v10/channels/${channelId}/permissions/${userId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: 1,
              allow: String(1024 | 2048 | 65536),
              deny: "0",
            }),
          }
        );

        return res.status(200).json({
          type: 4,
          data: {
            content: `✅ Usuário <@${userId}> adicionado ao ticket.`,
          },
        });
      }

      // ➖ REMOVER
      if (modalId === "modal_remove_user") {
        await fetch(
          `https://discord.com/api/v10/channels/${channelId}/permissions/${userId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );

        return res.status(200).json({
          type: 4,
          data: {
            content: `❌ Usuário <@${userId}> removido do ticket.`,
          },
        });
      }
    }

    return res.status(200).json({
      type: 4,
      data: {
        content: "Interação não reconhecida.",
        flags: 64,
      },
    });
  } catch (err) {
    console.error("ERRO DISCORD:", err);

    return res.status(500).json({
      type: 4,
      data: {
        content: "❌ Erro interno.",
        flags: 64,
      },
    });
  }
}