const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const pool = require("../db");

const router = express.Router();

const RESET_TOKEN_DURATION_MINUTES = 30;

const GENERIC_MESSAGE =
  "Caso o e-mail esteja cadastrado, enviaremos as instruções.";

function getFrontendUrl() {
  return String(
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function createEmailTransporter() {
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

async function sendResetEmail(email, resetUrl) {
  const requiredVariables = [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
  ];

  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Variáveis SMTP ausentes: ${missingVariables.join(", ")}`
    );
  }

  const transporter = createEmailTransporter();

  try {
    console.log("Preparando envio de recuperação para:", email);
    console.log("SMTP_HOST:", process.env.SMTP_HOST);
    console.log("SMTP_PORT:", process.env.SMTP_PORT || "587");
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("SMTP_FROM:", process.env.SMTP_FROM);

    await transporter.verify();

    console.log("Conexão SMTP verificada.");

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Redefinição de senha — Campo Limpo RP",

      text: [
        "Foi solicitada uma redefinição de senha para sua conta.",
        "",
        "Acesse o link abaixo para criar uma nova senha:",
        resetUrl,
        "",
        `O link é válido por ${RESET_TOKEN_DURATION_MINUTES} minutos.`,
        "",
        "Caso você não tenha solicitado a alteração, ignore este e-mail.",
      ].join("\n"),

      html: `
        <div
          style="
            background-color: #f3f4f6;
            padding: 32px 16px;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
          "
        >
          <div
            style="
              max-width: 560px;
              margin: 0 auto;
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              padding: 32px;
            "
          >
            <h2 style="margin-top: 0;">
              Redefinição de senha
            </h2>

            <p>
              Foi solicitada uma redefinição de senha para sua conta do
              painel administrativo.
            </p>

            <p style="margin: 28px 0;">
              <a
                href="${resetUrl}"
                style="
                  display: inline-block;
                  padding: 12px 20px;
                  background-color: #111827;
                  color: #ffffff;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: bold;
                "
              >
                Redefinir minha senha
              </a>
            </p>

            <p>
              Esse link é válido por
              <strong>${RESET_TOKEN_DURATION_MINUTES} minutos</strong>.
            </p>

            <p style="font-size: 13px; color: #6b7280;">
              Caso você não tenha solicitado a alteração, ignore este
              e-mail. Sua senha atual continuará funcionando.
            </p>

            <hr
              style="
                border: 0;
                border-top: 1px solid #e5e7eb;
                margin: 24px 0;
              "
            />

            <p style="font-size: 12px; color: #9ca3af;">
              Campo Limpo RP
            </p>
          </div>
        </div>
      `,
    });

    console.log("E-mail enviado com sucesso:", info.messageId);
  } finally {
    transporter.close();
  }
}

/*
|--------------------------------------------------------------------------
| SOLICITAR RECUPERAÇÃO DE SENHA
|--------------------------------------------------------------------------
*/

router.post("/forgot-password", async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Informe o e-mail.",
      });
    }

    const [users] = await pool.execute(
      `
      SELECT
        id,
        login,
        email,
        active
      FROM users
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [email]
    );

    const user = users[0];

    /*
     * Não informa se o e-mail existe, se está inativo ou não.
     */
    if (!user || !user.active) {
      return res.status(200).json({
        message: GENERIC_MESSAGE,
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_DURATION_MINUTES * 60 * 1000
    );

    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    /*
     * Invalida tokens anteriores ainda não utilizados.
     */
    await connection.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ?
        AND used_at IS NULL
      `,
      [user.id]
    );

    await connection.execute(
      `
      INSERT INTO password_reset_tokens (
        user_id,
        token_hash,
        expires_at
      )
      VALUES (?, ?, ?)
      `,
      [user.id, tokenHash, expiresAt]
    );

    const resetUrl =
      `${getFrontendUrl()}/admin/redefinir-senha` +
      `?token=${encodeURIComponent(token)}`;

    /*
     * Se o envio falhar, a transação será desfeita
     * e o token não ficará válido no banco.
     */
    await sendResetEmail(user.email, resetUrl);

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Erro ao desfazer solicitação de recuperação:",
          rollbackError
        );
      }
    }

    console.error("========= FORGOT PASSWORD =========");
    console.error("message:", error.message);
    console.error("code:", error.code);
    console.error("errno:", error.errno);
    console.error("sqlState:", error.sqlState);
    console.error("sqlMessage:", error.sqlMessage);
    console.error("stack:", error.stack);
    console.error("===================================");

    return res.status(500).json({
      message: "Não foi possível enviar o e-mail de recuperação.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/*
|--------------------------------------------------------------------------
| REDEFINIR SENHA
|--------------------------------------------------------------------------
*/

router.post("/reset-password", async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");

    if (!token) {
      return res.status(400).json({
        message: "Token de recuperação não informado.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "A senha deve ter pelo menos 8 caracteres.",
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        message: "A senha informada é muito longa.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const [tokens] = await connection.execute(
      `
      SELECT
        prt.id,
        prt.user_id
      FROM password_reset_tokens prt
      INNER JOIN users u
        ON u.id = prt.user_id
      WHERE prt.token_hash = ?
        AND prt.used_at IS NULL
        AND prt.expires_at > NOW()
        AND u.active = 1
      LIMIT 1
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (!tokens.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: "O link de recuperação é inválido ou expirou.",
      });
    }

    const resetToken = tokens[0];

    const passwordHash = await bcrypt.hash(password, 12);

    const [updateResult] = await connection.execute(
      `
      UPDATE users
      SET
        password_hash = ?,
        updated_at = NOW()
      WHERE id = ?
      LIMIT 1
      `,
      [passwordHash, resetToken.user_id]
    );

    if (updateResult.affectedRows !== 1) {
      throw new Error(
        `Não foi possível atualizar o usuário ${resetToken.user_id}.`
      );
    }

    /*
     * Marca o token atual como utilizado.
     */
    await connection.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = ?
      `,
      [resetToken.id]
    );

    /*
     * Invalida qualquer outro token ativo do usuário.
     */
    await connection.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ?
        AND used_at IS NULL
      `,
      [resetToken.user_id]
    );

    await connection.commit();
    transactionStarted = false;

    console.log(
      "Senha redefinida com sucesso para o usuário:",
      resetToken.user_id
    );

    return res.status(200).json({
      message: "Senha redefinida com sucesso.",
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Erro ao desfazer alteração de senha:",
          rollbackError
        );
      }
    }

    console.error("========= RESET PASSWORD =========");
    console.error("message:", error.message);
    console.error("code:", error.code);
    console.error("errno:", error.errno);
    console.error("sqlState:", error.sqlState);
    console.error("sqlMessage:", error.sqlMessage);
    console.error("stack:", error.stack);
    console.error("==================================");

    return res.status(500).json({
      message: "Não foi possível redefinir a senha.",
      /*
       * Durante o teste, você pode manter esta propriedade.
       * Depois que funcionar, remova o campo debug.
       */
      debug: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;