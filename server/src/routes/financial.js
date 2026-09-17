const express = require("express");
const router = express.Router();

const {
  getFinancialSummary,
  getMonthlySummary,
  getHistory,
} = require("../services/financial");

router.get("/test", async (req, res) => {
  try {
    const summary = await getFinancialSummary();
    const monthly = await getMonthlySummary();
    const history = await getHistory(10);

    return res.json({
      success: true,
      summary,
      monthly,
      history,
    });
  } catch (error) {
    console.error("ERRO TESTE FINANCEIRO:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;