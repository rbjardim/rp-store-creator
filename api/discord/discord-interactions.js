import nacl from "tweetnacl";

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function validateDiscordRequest(req, rawBody) {
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  if (!signature || !timestamp || !process.env.DISCORD_PUBLIC_KEY) return false;

  return nacl.sign.detached.verify(
    Buffer.concat([Buffer.from(timestamp), rawBody]),
    Buffer.from(signature, "hex"),
    Buffer.from(process.env.DISCORD_PUBLIC_KEY, "hex")
  );
}

async function discordFetch(url, options = {}) {
  return fetch(`https://discord.com/api/v10${url}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      ...(options.headers || {}),
    },
  });
}

async function getAllMessages(channelId) {
  let messages = [];
  let before;

  while (true) {
    const url = before
      ? `/channels/${channelId}/messages?limit=100&before=${before}`
      : `/channels/${channelId}/messages?limit=100`;

    const res = await discordFetch(url);
    const data = await res.json();

    if (!res.ok || !Array.isArray(data) || data.length === 0) break;

    messages.push(...data);
    before = data[data.length - 1].id;

    if (data.length < 100) break;
  }

  return messages.reverse();
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPurchaseId(messages) {
  for (const msg of messages) {
    for (const embed of msg.embeds || []) {
      const footerText = embed.footer?.text || "";
      const match = footerText.match(/Pedido\s*#?([a-zA-Z0-9-_]+)/i);
      if (match) return match[1];
    }
  }

  return "sem-id";
}

async function sendTranscript(channelName, channelId, closedBy) {
  const backupChannelId = process.env.DISCORD_TRANSCRIPT_CHANNEL_ID;

  if (!backupChannelId) {
    console.error("DISCORD_TRANSCRIPT_CHANNEL_ID não configurado");
    return;
  }

  const messages = await getAllMessages(channelId);
  const purchaseId = getPurchaseId(messages);

  const htmlMessages = messages
    .map((msg) => {
      const name = msg.author?.global_name || msg.author?.username || "Desconhecido";

      const avatar = msg.author?.avatar
        ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
        : "https://cdn.discordapp.com/embed/avatars/0.png";

      const date = new Date(msg.timestamp).toLocaleString("pt-BR");

      const content = escapeHtml(msg.content || "").replaceAll("\n", "<br>");

      const attachments = msg.attachments?.length
        ? msg.attachments
            .map(
              (a) =>
                `<div class="attachment"><a href="${escapeHtml(a.url)}" target="_blank">${escapeHtml(
                  a.filename || a.url
                )}</a></div>`
            )
            .join("")
        : "";

      return `
        <div class="msg">
          <img src="${avatar}" class="avatar"/>
          <div class="body">
            <div>
              <b>${escapeHtml(name)}</b>
              <span>${date}</span>
            </div>
            <div class="content">${content || "<i>Mensagem vazia</i>"}</div>
            ${attachments}
          </div>
        </div>
      `;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Transcript da compra #${escapeHtml(purchaseId)}</title>
  <style>
    body { background:#313338; color:#dbdee1; font-family:Arial,sans-serif; margin:0; }
    .header { background:#1e1f22; padding:24px; border-bottom:1px solid #3f4147; }
    .header h1 { margin:0 0 8px; color:#fff; }
    .header p { margin:4px 0; color:#b5bac1; }
    .container { padding:24px; }
    .msg { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,.05); }
    .avatar { width:42px; height:42px; border-radius:50%; }
    .body span { color:#949ba4; font-size:12px; margin-left:8px; }
    .content { margin-top:4px; line-height:1.45; word-break:break-word; }
    .attachment a { color:#00a8fc; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Transcript da compra #${escapeHtml(purchaseId)}</h1>
    <p><strong>Canal:</strong> ${escapeHtml(channelName)}</p>
    <p><strong>ID do canal:</strong> ${channelId}</p>
    <p><strong>Fechado por:</strong> ${closedBy}</p>
    <p><strong>Data:</strong> ${new Date().toLocaleString("pt-BR")}</p>
  </div>
  <div class="container">
    ${htmlMessages || "<p>Nenhuma mensagem encontrada.</p>"}
  </div>
</body>
</html>
`;

  const fileName = `transcript-compra-${purchaseId}.html`;

  const form = new FormData();

  form.append(
    "payload_json",
    JSON.stringify({
      content: "📄 Gerando transcript...",
    })
  );

  form.append(
    "files[0]",
    new Blob([html], { type: "text/html" }),
    fileName
  );

  const uploadRes = await discordFetch(`/channels/${backupChannelId}/messages`, {
    method: "POST",
    body: form,
  });

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    console.error("Erro ao enviar transcript:", uploadData);
    return;
  }

  const transcriptUrl = uploadData.attachments?.[0]?.url;

  if (!transcriptUrl) {
    console.error("Transcript enviado, mas URL não encontrada:", uploadData);
    return;
  }

  await discordFetch(`/channels/${backupChannelId}/messages/${uploadData.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: "",
      embeds: [
        {
          title: `📄 Transcript da compra #${purchaseId}`,
          description:
            `O ticket foi fechado e o transcript foi salvo como backup.\n\n` +
            `Clique no botão abaixo para abrir o transcript.`,
          color: 16755200,
          fields: [
            {
              name: "Canal",
              value: `\`${channelName}\``,
              inline: true,
            },
            {
              name: "Fechado por",
              value: `<@${closedBy}>`,
              inline: true,
            },
            {
              name: "ID da compra",
              value: `#${purchaseId}`,
              inline: true,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Abrir transcript",
              url: transcriptUrl,
              emoji: { name: "📄" },
            },
          ],
        },
      ],
    }),
  });
}

async function setUserPermission(channelId, userId) {
  return discordFetch(`/channels/${channelId}/permissions/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: 1,
      allow: String(1024 | 2048 | 65536),
      deny: "0",
    }),
  });
}

async function removeUserPermission(channelId, userId) {
  return discordFetch(`/channels/${channelId}/permissions/${userId}`, {
    method: "DELETE",
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const rawBody = await getRawBody(req);

    if (!validateDiscordRequest(req, rawBody)) {
      return res.status(401).end("invalid request signature");
    }

    const interaction = JSON.parse(rawBody.toString());

    if (interaction.type === 1) {
      return res.json({ type: 1 });
    }

    if (interaction.type === 3) {
      const id = interaction.data.custom_id;
      const channelId = interaction.channel_id;
      const userId = interaction.member.user.id;

      if (id === "ticket_close") {
        await sendTranscript(
          interaction.channel?.name || "ticket",
          channelId,
          userId
        );

        await discordFetch(`/channels/${channelId}`, {
          method: "DELETE",
        });

        return res.json({
          type: 4,
          data: {
            content: "🔒 Ticket fechado e transcript salvo.",
            flags: 64,
          },
        });
      }

      if (id === "ticket_add_user") {
        return res.json({
          type: 4,
          data: {
            content: "Selecionar usuário:",
            flags: 64,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 5,
                    custom_id: "add_select",
                    placeholder: "Selecionar membro",
                    min_values: 1,
                    max_values: 1,
                  },
                ],
              },
            ],
          },
        });
      }

      if (id === "ticket_remove_user") {
        return res.json({
          type: 4,
          data: {
            content: "Remover usuário:",
            flags: 64,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 5,
                    custom_id: "remove_select",
                    placeholder: "Selecionar membro",
                    min_values: 1,
                    max_values: 1,
                  },
                ],
              },
            ],
          },
        });
      }

      if (id === "add_select") {
        const selectedUserId = interaction.data.values[0];
        await setUserPermission(channelId, selectedUserId);

        return res.json({
          type: 4,
          data: {
            content: `✅ <@${selectedUserId}> adicionado ao ticket.`,
            flags: 64,
          },
        });
      }

      if (id === "remove_select") {
        const selectedUserId = interaction.data.values[0];
        await removeUserPermission(channelId, selectedUserId);

        return res.json({
          type: 4,
          data: {
            content: `❌ <@${selectedUserId}> removido do ticket.`,
            flags: 64,
          },
        });
      }
    }

    return res.json({
      type: 4,
      data: {
        content: "Interação não reconhecida.",
        flags: 64,
      },
    });
  } catch (err) {
    console.error("ERRO DISCORD:", err);

    return res.json({
      type: 4,
      data: {
        content: "❌ Erro interno.",
        flags: 64,
      },
    });
  }
}