const express = require("express");

const router = express.Router();

router.get("/login", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId) {
    return res.status(500).json({ message: "DISCORD_CLIENT_ID não configurado." });
  }

  if (!redirectUri) {
    return res.status(500).json({ message: "DISCORD_REDIRECT_URI não configurado." });
  }

  const returnUrl =
    req.query.returnUrl ||
    `${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state: String(returnUrl),
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state;

    if (!code) {
      return res.status(400).json({ message: "Código do Discord não recebido." });
    }

    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({
        message: "Variáveis do Discord não configuradas.",
      });
    }

    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const tokenText = await tokenResponse.text();

    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error("Resposta TOKEN não é JSON:", tokenText.slice(0, 500));
      return res.status(400).json({
        message: "Discord retornou resposta inválida ao buscar token.",
      });
    }

    if (!tokenResponse.ok) {
      console.error("Erro token Discord:", tokenData);
      return res.status(400).json({
        message: "Erro ao autenticar com Discord.",
        details: tokenData,
      });
    }

    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      },
    });

    const userText = await userResponse.text();

    let discordUser;
    try {
      discordUser = JSON.parse(userText);
    } catch {
      console.error("Resposta USER não é JSON:", userText.slice(0, 500));
      return res.status(400).json({
        message: "Discord retornou resposta inválida ao buscar usuário.",
      });
    }

    if (!userResponse.ok) {
      console.error("Erro usuário Discord:", discordUser);
      return res.status(400).json({
        message: "Erro ao buscar usuário do Discord.",
        details: discordUser,
      });
    }

    let returnUrl =
      state || `${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout`;

    if (!String(returnUrl).startsWith("http")) {
      returnUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout`;
    }

    const url = new URL(String(returnUrl));

    url.searchParams.set("discord_id", discordUser.id);
    url.searchParams.set("discord_username", discordUser.username);
    url.searchParams.set("discord_avatar", discordUser.avatar || "");

    return res.redirect(url.toString());
  } catch (error) {
    console.error("Erro callback Discord:", error.message);
    console.error(error.stack);
    return res.status(500).json({
      message: "Erro interno ao conectar Discord.",
    });
  }
});

module.exports = router;