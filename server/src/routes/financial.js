const express = require("express");
const router = express.Router();

const {
  getFinancialSummary,
  getMonthlySummary,
  getHistory,
  createExpense,
} = require("../services/financial");

/*
|--------------------------------------------------------------------------
| Segurança das rotas financeiras
|--------------------------------------------------------------------------
*/

function validateInternalRequest(req, res, next) {
  const secret = req.headers["x-webhook-secret"];

  if (!process.env.INTERNAL_WEBHOOK_SECRET) {
    console.error("INTERNAL_WEBHOOK_SECRET não configurado.");

    return res.status(500).json({
      success: false,
      message: "Chave interna não configurada no servidor.",
    });
  }

  if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Não autorizado.",
    });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| Todas as rotas abaixo exigem a chave interna
|--------------------------------------------------------------------------
*/

router.use(validateInternalRequest);

/*
|--------------------------------------------------------------------------
| RESUMO FINANCEIRO
|--------------------------------------------------------------------------
|
| GET /api/financial/summary
|
*/

router.get("/summary", async (req, res) => {
  try {
    const summary = await getFinancialSummary();
    const monthly = await getMonthlySummary();

    return res.json({
      success: true,
      summary,
      monthly,
    });
  } catch (error) {
    console.error("ERRO RESUMO FINANCEIRO:", error);

    return res.status(500).json({
      success: false,
      message: "Erro ao carregar resumo financeiro.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| HISTÓRICO
|--------------------------------------------------------------------------
|
| GET /api/financial/history
| GET /api/financial/history?limit=20
|
*/

router.get("/history", async (req, res) => {
  try {
    const limit = req.query.limit || 20;

    const history = await getHistory(limit);

    return res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("ERRO HISTÓRICO FINANCEIRO:", error);

    return res.status(500).json({
      success: false,
      message: "Erro ao carregar histórico financeiro.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| REGISTRAR GASTO
|--------------------------------------------------------------------------
|
| POST /api/financial/expenses
|
*/

router.post("/expenses", async (req, res) => {
  try {
    const {
      amount,
      description,
      category,
      observation,
      discordUserId,
      discordUsername,
    } = req.body;

    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        success: false,
        message: "Informe o valor do gasto.",
      });
    }

    if (!description || !String(description).trim()) {
      return res.status(400).json({
        success: false,
        message: "Informe a descrição do gasto.",
      });
    }

    if (!discordUserId) {
      return res.status(400).json({
        success: false,
        message: "Usuário do Discord não informado.",
      });
    }

    const expense = await createExpense({
      amount,
      description,
      category,
      observation,
      discordUserId,
      discordUsername,
    });

    return res.status(201).json({
      success: true,
      message: "Gasto registrado com sucesso.",
      expense,
    });
  } catch (error) {
    console.error("ERRO AO REGISTRAR GASTO:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Erro ao registrar gasto.",
    });
  }
});

module.exports = router;