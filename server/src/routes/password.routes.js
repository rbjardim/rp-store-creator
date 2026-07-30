const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const pool = require("../db");

const router = express.Router();

const GENERIC_MESSAGE =
  "Caso o e-mail esteja cadastrado, enviaremos as instruções.";

function getFrontendUrl() {
  return String(
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/$/, "");
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

  if (missingVariables.length) {
    throw new Error(
      `Variáveis SMTP ausentes: ${missingVariables.join(", ")}`
    );
  }

  const transporter = createEmailTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Redefinição de senha — Painel administrativo",
    text: [
      "Foi solicitada uma redefinição de senha para sua conta.",
      "",
      `Acesse o link abaixo para criar uma nova senha:`,
      resetUrl,
      "",
      "O link é válido por 30 minutos.",
      "",
      "Caso você não tenha solicitado a alteração, ignore este e-mail.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>Redefinição de senha</h2>

        <p>
          Foi solicitada uma redefinição de senha para sua conta do painel
          administrativo.
        </p>

        <p>
          Clique no botão abaixo para criar uma nova senha:
        </p>

        <p style="margin: 28px 0;">
          <a
            href="${resetUrl}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background: #111;
              color: #fff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            Redefinir minha senha
          </a>
        </p>

        <p>
          Esse link é válido por <strong>30 minutos</strong>.
        </p>

        <p style="font-size: 13px; color: #666;">
          Caso você não tenha solicitado a alteração, ignore este e-mail.
        </p>
      </div>
    `,
  });
}

// Solicitar recuperação de senha
router.post("/forgot-password", async (req, res) => {
  let connection;

  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Informe o e-mail.",
      });
    }

    /*
     * Altere "users", "id" e "email" caso sua tabela
     * ou suas colunas tenham outros nomes.
     */
    const [users] = await pool.execute(
      `
      SELECT id, email
      FROM users
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [email]
    );

    // Não revela se o e-mail existe ou não.
    if (!users.length) {
      return res.json({
        message: GENERIC_MESSAGE,
      });
    }

    const user = users[0];

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Invalida solicitações anteriores ainda não utilizadas.
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
     * Envia o e-mail antes do commit.
     * Se o envio falhar, o token não será salvo.
     */
    await sendResetEmail(user.email, resetUrl);

    await connection.commit();

    return res.json({
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Erro ao desfazer solicitação de senha:",
          rollbackError
        );
      }
    }

    console.error("Erro no forgot-password:", error);

    return res.status(500).json({
      message: "Não foi possível enviar o e-mail de recuperação.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Salvar a nova senha
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
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = ?
        AND used_at IS NULL
        AND expires_at > NOW()
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

    /*
     * Caso sua coluna seja "password_hash", altere abaixo:
     *
     * SET password_hash = ?
     */
    const [updateResult] = await connection.execute(
      `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
      `,
      [passwordHash, resetToken.user_id]
    );

    if (!updateResult.affectedRows) {
      throw new Error("Usuário da recuperação não foi encontrado.");
    }

    // Marca o token atual como utilizado.
    await connection.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = ?
      `,
      [resetToken.id]
    );

    // Invalida qualquer outro token ativo desse usuário.
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

    return res.json({
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

    console.error("Erro no reset-password:", error);

    return res.status(500).json({
      message: "Não foi possível redefinir a senha.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;