const express = require("express");

const router = express.Router();

const DISCORD_API = "https://discord.com/api/v10";

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "https://loja.campolimporp.com.br";
}

function getRedirectUri() {
  return (
    process.env.DISCORD_REDIRECT_URI ||
    "https://api.campolimporp.com.br/api/discord/callback"
  );
}

router.get("/login", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ message: "DISCORD_CLIENT_ID não configurado." });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "identify email",
    prompt: "consent",
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get("/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${getFrontendUrl()}/?discord_error=missing_code`);
    }

    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
      return res.redirect(`${getFrontendUrl()}/?discord_error=missing_config`);
    }

    const tokenBody = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: getRedirectUri(),
    });

    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody,
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Erro token Discord:", tokenData);
      return res.redirect(`${getFrontendUrl()}/?discord_error=token`);
    }

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const user = await userResponse.json();

    if (!userResponse.ok || !user.id) {
      console.error("Erro user Discord:", user);
      return res.redirect(`${getFrontendUrl()}/?discord_error=user`);
    }

    const username = user.discriminator && user.discriminator !== "0"
      ? `${user.username}#${user.discriminator}`
      : user.username;

    const params = new URLSearchParams({
      discord_id: user.id,
      discord_username: username || "Discord",
    });

    if (user.email) {
      params.set("discord_email", user.email);
    }

    return res.redirect(`${getFrontendUrl()}/?${params.toString()}`);
  } catch (error) {
    console.error("Erro callback Discord:", error);
    return res.redirect(`${getFrontendUrl()}/?discord_error=server`);
  }
});

module.exports = router;
