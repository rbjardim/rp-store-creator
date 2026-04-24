export default async function handler(req, res) {
  try {
    const code = req.query.code;
    const state = req.query.state;

    if (!code) {
      return res.status(400).json({ message: "Código do Discord não recebido." });
    }

    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
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

    const discordUser = await userResponse.json();

    if (!userResponse.ok) {
      return res.status(400).json({
        message: "Erro ao buscar usuário do Discord.",
        details: discordUser,
      });
    }

    const returnUrl =
      state || `${process.env.FRONTEND_URL || "https://loja.campolimporp.com.br"}/checkout`;

    const url = new URL(String(returnUrl));

    url.searchParams.set("discord_id", discordUser.id);
    url.searchParams.set("discord_username", discordUser.username);
    url.searchParams.set("discord_avatar", discordUser.avatar || "");

    return res.redirect(url.toString());
  } catch (error) {
    console.error("Erro callback Discord Vercel:", error);
    return res.status(500).json({ message: "Erro interno ao conectar Discord." });
  }
}