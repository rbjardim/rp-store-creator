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

async function discordFetch(url, options = {}) {
  return fetch(`https://discord.com/api/v10${url}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      ...(options.headers || {}),
    },
  });
}

// 🔥 BUSCAR TODAS MENSAGENS
async function getAllMessages(channelId) {
  let messages = [];
  let before;

  while (true) {
    const url = before
      ? `/channels/${channelId}/messages?limit=100&before=${before}`
      : `/channels/${channelId}/messages?limit=100`;

    const res = await discordFetch(url);
    const data = await res.json();

    if (!res.ok || !data.length) break;

    messages.push(...data);
    before = data[data.length - 1].id;

    if (data.length < 100) break;
  }

  return messages.reverse();
}

// 🔥 GERAR HTML
function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sendTranscript(channelName, channelId, closedBy) {
  const backupChannelId = process.env.DISCORD_TRANSCRIPT_CHANNEL_ID;

  const messages = await getAllMessages(channelId);

  const htmlMessages = messages
    .map((msg) => {
      const name = msg.author.global_name || msg.author.username;
      const avatar = msg.author.avatar
        ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
        : "https://cdn.discordapp.com/embed/avatars/0.png";

      const content = escapeHtml(msg.content || "").replaceAll("\n", "<br>");

      return `
      <div class="msg">
        <img src="${avatar}" class="avatar"/>
        <div>
          <b>${name}</b>
          <div>${content || "<i>vazio</i>"}</div>
        </div>
      </div>`;
    })
    .join("");

  const html = `
  <html>
  <head>
    <style>
      body { background:#2b2d31;color:#fff;font-family:sans-serif;padding:20px }
      .msg { display:flex; gap:10px; margin-bottom:10px }
      .avatar { width:40px;height:40px;border-radius:50% }
    </style>
  </head>
  <body>
    <h2>Transcript do Ticket</h2>
    <p>Canal: ${channelName}</p>
    <p>Fechado por: ${closedBy}</p>
    <hr/>
    ${htmlMessages}
  </body>
  </html>
  `;

  const form = new FormData();

  form.append(
    "payload_json",
    JSON.stringify({
      content: `📄 Transcript do ticket <#${channelId}>`,
    })
  );

  form.append(
    "files[0]",
    new Blob([html], { type: "text/html" }),
    `transcript-${channelId}.html`
  );

  await discordFetch(`/channels/${backupChannelId}/messages`, {
    method: "POST",
    body: form,
  });
}

// 🔥 PERMISSÕES
async function setUserPermission(channelId, userId) {
  return discordFetch(`/channels/${channelId}/permissions/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: 1,
      allow: String(1024 | 2048 | 65536),
    }),
  });
}

async function removeUserPermission(channelId, userId) {
  return discordFetch(`/channels/${channelId}/permissions/${userId}`, {
    method: "DELETE",
  });
}

// 🔥 HANDLER
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

      // 🔒 FECHAR + TRANSCRIPT
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
            content: "🔒 Ticket fechado e salvo.",
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
                  },
                ],
              },
            ],
          },
        });
      }

      if (id === "add_select") {
        const u = interaction.data.values[0];
        await setUserPermission(channelId, u);

        return res.json({
          type: 4,
          data: { content: `Adicionado <@${u}>`, flags: 64 },
        });
      }

      if (id === "remove_select") {
        const u = interaction.data.values[0];
        await removeUserPermission(channelId, u);

        return res.json({
          type: 4,
          data: { content: `Removido <@${u}>`, flags: 64 },
        });
      }
    }

    return res.json({ type: 4, data: { content: "OK", flags: 64 } });
  } catch (err) {
    console.error(err);
    return res.json({
      type: 4,
      data: { content: "Erro", flags: 64 },
    });
  }
}