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
console.log("JWT_SECRET configurado:", !!process.env.JWT_SECRET);

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://rp-store-creator.vercel.app",
  "https://loja.campolimporp.com.br",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin não permitida: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.use((req, res, next) => {
  console.log("METHOD:", req.method, "URL:", req.url);
  console.log("ORIGIN:", req.headers.origin);
  console.log("CONTENT-TYPE:", req.headers["content-type"]);
  next();
});

app.get("/", (req, res) => {
  res.status(200).send("API da loja online está rodando.");
});

app.post("/api/test-body", (req, res) => {
  console.log("TEST BODY:", req.body);
  res.json({ body: req.body });
});

// Health check simples para o Render
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "API online",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Health check separado para testar o banco manualmente
app.get("/api/health/db", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT 1 AS ok");
    res.status(200).json({
      ok: true,
      message: "Banco conectado",
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

app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/checkout", checkoutRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API rodando na porta ${PORT}`);
});