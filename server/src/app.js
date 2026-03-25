const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const pool = require("./db");
const authRoutes = require("./routes/auth.routes");
const settingsRoutes = require("./routes/settings.routes");
const categoriesRoutes = require("./routes/categories.routes");
const productsRoutes = require("./routes/products.routes");
const usersRoutes = require("./routes/users.routes");
const couponsRoutes = require("./routes/coupons.routes");
const checkoutRoutes = require("./routes/checkout.routes");

console.log("Iniciando app.js...");
console.log("JWT_SECRET:", process.env.JWT_SECRET);

const app = express();

// parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// servir arquivos enviados
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

// debug temporário
app.use((req, res, next) => {
  console.log("METHOD:", req.method, "URL:", req.url);
  console.log("CONTENT-TYPE:", req.headers["content-type"]);
  next();
});

app.get("/", (req, res) => {
  res.send("API da loja online está rodando.");
});

app.post("/api/test-body", (req, res) => {
  console.log("TEST BODY:", req.body);
  res.json({ body: req.body });
});

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT 1 AS ok");
    res.json({
      ok: true,
      message: "API online e banco conectado",
      database: rows[0],
    });
  } catch (error) {
    console.error("Erro no banco:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao conectar no banco",
      error: error.message,
    });
  }
});

// rotas
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/checkout", checkoutRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`API rodando em http://127.0.0.1:${PORT}`);
});