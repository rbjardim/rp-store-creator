import nacl from "tweetnacl";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function validateDiscordRequest(req, rawBody) {
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  if (!signature || !timestamp || !process.env.DISCORD_PUBLIC_KEY) {
    return false;
  }

  return nacl.sign.detached.verify(
    Buffer.concat([Buffer.from(timestamp), rawBody]),
    Buffer.from(signature, "hex"),
    Buffer.from(process.env.DISCORD_PUBLIC_KEY, "hex")
  );
}

async function setUserPermission(channelId, userId) {
  return fetch(
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
}

async function removeUserPermission(channelId, userId) {
  return fetch(
    `https://discord.com/api/v10/channels/${channelId}/permissions/${userId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    }
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).end();
    }

    const rawBody = await getRawBody(req);

    if (!validateDiscordRequest(req, rawBody)) {
      console.error("Assinatura inválida ou ENV faltando");
      return res.status(401).end("invalid request signature");
    }

    const interaction = JSON.parse(rawBody.toString());

    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    if (interaction.type === 3) {
      const customId = interaction.data.custom_id;
      const channelId = interaction.channel_id;

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

      if (customId === "ticket_add_user") {
        return res.status(200).json({
          type: 4,
          data: {
            content: "Selecione o membro que deseja **adicionar** ao ticket:",
            flags: 64,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 5,
                    custom_id: "ticket_add_user_select",
                    placeholder: "Buscar membro para adicionar",
                    min_values: 1,
                    max_values: 1,
                  },
                ],
              },
            ],
          },
        });
      }

      if (customId === "ticket_remove_user") {
        return res.status(200).json({
          type: 4,
          data: {
            content: "Selecione o membro que deseja **remover** do ticket:",
            flags: 64,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 5,
                    custom_id: "ticket_remove_user_select",
                    placeholder: "Buscar membro para remover",
                    min_values: 1,
                    max_values: 1,
                  },
                ],
              },
            ],
          },
        });
      }

      if (customId === "ticket_add_user_select") {
        const userId = interaction.data.values[0];

        await setUserPermission(channelId, userId);

        return res.status(200).json({
          type: 4,
          data: {
            content: `✅ Usuário <@${userId}> adicionado ao ticket.`,
            flags: 64,
          },
        });
      }

      if (customId === "ticket_remove_user_select") {
        const userId = interaction.data.values[0];

        await removeUserPermission(channelId, userId);

        return res.status(200).json({
          type: 4,
          data: {
            content: `❌ Usuário <@${userId}> removido do ticket.`,
            flags: 64,
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

    return res.status(200).json({
      type: 4,
      data: {
        content: "❌ Erro interno ao processar interação.",
        flags: 64,
      },
    });
  }
}