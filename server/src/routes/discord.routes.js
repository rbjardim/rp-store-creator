const express = require("express");

const router = express.Router();

router.get("/login", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId) {
    return res
      .status(500)
      .json({ message: "DISCORD_CLIENT_ID não configurado." });
  }

  if (!redirectUri) {
    return res
      .status(500)
      .json({ message: "DISCORD_REDIRECT_URI não configurado." });
  }

  // 🔥 SEMPRE GARANTIR /checkout
  const returnUrl =
    req.query.returnUrl ||
    `${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state: returnUrl, // 🔥 SEM encodeURIComponent
  });

  return res.redirect(
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
});

router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state;

    if (!code) {
      return res
        .status(400)
        .json({ message: "Código do Discord não recebido." });
    }

    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({
        message: "Variáveis do Discord não configuradas.",
      });
    }

    // 🔥 troca código por token
    const tokenResponse = await fetch(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: redirectUri,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Erro token Discord:", tokenData);
      return res.status(400).json({
        message: "Erro ao autenticar com Discord.",
        details: tokenData,
      });
    }

    // 🔥 pega usuário
    const userResponse = await fetch(
      "https://discord.com/api/v10/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const discordUser = await userResponse.json();

    if (!userResponse.ok) {
      console.error("Erro usuário Discord:", discordUser);
      return res.status(400).json({
        message: "Erro ao buscar usuário do Discord.",
        details: discordUser,
      });
    }

    let returnUrl = state
      ? String(state)
      : `${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout`;

    if (!returnUrl.startsWith("http")) {
      returnUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout`;
    }

    let url;

    try {
      url = new URL(returnUrl);
    } catch (err) {
      console.error("Return URL inválida:", returnUrl);
      url = new URL(`${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout`);
    }

    url.searchParams.set("discord_id", discordUser.id);
    url.searchParams.set("discord_username", discordUser.username);
    url.searchParams.set(
      "discord_avatar",
      discordUser.avatar || ""
    );

    return res.redirect(url.toString());
  } catch (error) {
    console.error("Erro callback Discord:", error);
    return res.status(500).json({
      message: "Erro interno ao conectar Discord.",
    });
  }
});

module.exports = router;