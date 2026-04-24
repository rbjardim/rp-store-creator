export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ message: "Discord ENV não configurado." });
  }

  const returnUrl =
    req.query.returnUrl ||
    `${process.env.FRONTEND_URL || "https://loja.campolimporp.com.br"}/checkout`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state: String(returnUrl),
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}