export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).end();
    }

    const interaction = req.body;

    // Discord ping (obrigatório)
    if (interaction.type === 1) {
      return res.json({ type: 1 });
    }

    // Clique de botão
    if (interaction.type === 3) {
      const { custom_id } = interaction.data;
      const channelId = interaction.channel_id;
      const userId = interaction.member.user.id;

      // 🔒 FECHAR TICKET
      if (custom_id === "ticket_close") {
        await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        });

        return res.json({
          type: 4,
          data: {
            content: "🔒 Ticket fechado.",
            flags: 64,
          },
        });
      }

      // ➕ ADICIONAR USUÁRIO
      if (custom_id === "ticket_add_user") {
        return res.json({
          type: 9, // abre modal
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
                    min_length: 17,
                    max_length: 20,
                    required: true,
                  },
                ],
              },
            ],
          },
        });
      }

      // ➖ REMOVER USUÁRIO
      if (custom_id === "ticket_remove_user") {
        return res.json({
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

    // 📥 RESPOSTA DOS MODAIS
    if (interaction.type === 5) {
      const modalId = interaction.data.custom_id;
      const channelId = interaction.channel_id;

      const userId =
        interaction.data.components[0].components[0].value;

      // ➕ ADD USER
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
              allow: "1024",
              type: 1,
            }),
          }
        );

        return res.json({
          type: 4,
          data: {
            content: `✅ Usuário <@${userId}> adicionado.`,
          },
        });
      }

      // ➖ REMOVE USER
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

        return res.json({
          type: 4,
          data: {
            content: `❌ Usuário <@${userId}> removido.`,
          },
        });
      }
    }

    return res.status(200).end();
  } catch (err) {
    console.error(err);
    return res.status(500).end();
  }
}