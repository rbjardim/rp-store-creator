const express = require("express");
const mercadopago = require("mercadopago");

const router = express.Router();

const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

router.post("/create-preference", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Carrinho vazio" });
    }

    const preference = new mercadopago.Preference(client);

    const result = await preference.create({
      body: {
        items: items.map((item) => ({
          title: item.name,
          quantity: Number(item.quantity),
          currency_id: "BRL",
          unit_price: Number(item.price),
        })),
      },
    });

    return res.json({
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    });
  } catch (error) {
    console.error("Erro Mercado Pago:", error);
    return res.status(500).json({
      message: "Erro ao criar pagamento",
      error: error.message,
    });
  }
});

module.exports = router;