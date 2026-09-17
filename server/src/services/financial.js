const pool = require("../db");

/**
 * Converte qualquer valor para número.
 */
function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Resumo financeiro geral.
 *
 * Receita = pedidos pagos da loja
 * Despesas = financial_expenses
 * Saldo = receita - despesas
 */
async function getFinancialSummary() {
  const [orderRows] = await pool.execute(`
    SELECT
      COUNT(*) AS sales_count,
      COALESCE(SUM(total_amount), 0) AS revenue
    FROM orders
    WHERE status = 'paid'
  `);

  const [expenseRows] = await pool.execute(`
    SELECT
      COUNT(*) AS expenses_count,
      COALESCE(SUM(amount), 0) AS expenses
    FROM financial_expenses
  `);

  const revenue = toNumber(orderRows[0]?.revenue);
  const expenses = toNumber(expenseRows[0]?.expenses);

  return {
    revenue,
    expenses,
    balance: revenue - expenses,

    salesCount: Number(orderRows[0]?.sales_count || 0),
    expensesCount: Number(expenseRows[0]?.expenses_count || 0),
  };
}

/**
 * Resumo somente do mês atual.
 */
async function getMonthlySummary() {
  const [orderRows] = await pool.execute(`
    SELECT
      COUNT(*) AS sales_count,
      COALESCE(SUM(total_amount), 0) AS revenue
    FROM orders
    WHERE status = 'paid'
      AND paid_at IS NOT NULL
      AND YEAR(paid_at) = YEAR(CURRENT_DATE())
      AND MONTH(paid_at) = MONTH(CURRENT_DATE())
  `);

  const [expenseRows] = await pool.execute(`
    SELECT
      COUNT(*) AS expenses_count,
      COALESCE(SUM(amount), 0) AS expenses
    FROM financial_expenses
    WHERE YEAR(created_at) = YEAR(CURRENT_DATE())
      AND MONTH(created_at) = MONTH(CURRENT_DATE())
  `);

  const revenue = toNumber(orderRows[0]?.revenue);
  const expenses = toNumber(expenseRows[0]?.expenses);

  return {
    revenue,
    expenses,
    result: revenue - expenses,

    salesCount: Number(orderRows[0]?.sales_count || 0),
    expensesCount: Number(expenseRows[0]?.expenses_count || 0),
  };
}

/**
 * Registra uma nova despesa.
 */
async function createExpense({
  amount,
  description,
  category = null,
  observation = null,
  discordUserId,
  discordUsername,
}) {
  const numericAmount = toNumber(amount);

  if (numericAmount <= 0) {
    throw new Error("O valor do gasto deve ser maior que zero.");
  }

  const cleanDescription = String(description || "").trim();

  if (!cleanDescription) {
    throw new Error("A descrição do gasto é obrigatória.");
  }

  if (!discordUserId) {
    throw new Error("Usuário do Discord não identificado.");
  }

  const [result] = await pool.execute(
    `
      INSERT INTO financial_expenses
      (
        amount,
        description,
        category,
        observation,
        discord_user_id,
        discord_username
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      numericAmount,
      cleanDescription,
      category ? String(category).trim() : null,
      observation ? String(observation).trim() : null,
      String(discordUserId),
      discordUsername ? String(discordUsername) : null,
    ]
  );

  return {
    id: result.insertId,
    amount: numericAmount,
    description: cleanDescription,
    category: category ? String(category).trim() : null,
    observation: observation ? String(observation).trim() : null,
    discordUserId: String(discordUserId),
    discordUsername: discordUsername
      ? String(discordUsername)
      : null,
  };
}

/**
 * Retorna as movimentações mais recentes.
 *
 * Junta:
 * - vendas aprovadas (orders)
 * - gastos (financial_expenses)
 */
async function getHistory(limit = 20) {
  const safeLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || 20, 1),
    50
  );

  // LIMIT não é recebido diretamente do usuário.
  // O valor acima sempre é convertido para inteiro e limitado a 50.
  const [rows] = await pool.query(`
    SELECT *
    FROM (
      SELECT
        CONCAT('sale-', id) AS movement_id,
        'entrada' AS movement_type,
        total_amount AS amount,
        CONCAT('Venda da loja - Pedido #', id) AS description,
        'Loja' AS category,
        NULL AS observation,
        discord_id AS discord_user_id,
        discord_username,
        paid_at AS movement_date,
        id AS order_id

      FROM orders

      WHERE status = 'paid'
        AND paid_at IS NOT NULL

      UNION ALL

      SELECT
        CONCAT('expense-', id) AS movement_id,
        'saida' AS movement_type,
        amount,
        description,
        category,
        observation,
        discord_user_id,
        discord_username,
        created_at AS movement_date,
        NULL AS order_id

      FROM financial_expenses
    ) AS financial_history

    ORDER BY movement_date DESC

    LIMIT ${safeLimit}
  `);

  return rows.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
  }));
}

module.exports = {
  getFinancialSummary,
  getMonthlySummary,
  createExpense,
  getHistory,
};