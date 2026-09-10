const express = require("express");
const multer = require("multer");
const pool = require("../db");
const { authRequired, adminOnly } = require("../middlewares/auth");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

function parseActive(value) {
  return value === true ||
    value === "true" ||
    value === 1 ||
    value === "1"
    ? 1
    : 0;
}

function parseDeliveries(rawDeliveries) {
  if (!rawDeliveries) return [];

  let deliveries = rawDeliveries;

  if (typeof rawDeliveries === "string") {
    try {
      deliveries = JSON.parse(rawDeliveries);
    } catch (error) {
      throw new Error("O campo deliveries está em formato inválido.");
    }
  }

  if (!Array.isArray(deliveries)) {
    throw new Error("O campo deliveries deve ser uma lista.");
  }

  const allowedTypes = new Set([
    "item",
    "vehicle",
    "group",
    "vip_fac",
    "coins",
  ]);

  const allowedRecipientModes = new Set([
    "buyer",
    "all_members",
  ]);

  return deliveries.map((delivery, index) => {
    const deliveryType = String(delivery?.delivery_type || "").trim();
    const deliveryValue = String(delivery?.delivery_value || "").trim();
    const recipientMode = String(
      delivery?.recipient_mode || (deliveryType === "vip_fac" ? "all_members" : "buyer")
    ).trim();

    if (!allowedTypes.has(deliveryType)) {
      throw new Error(`Tipo de recompensa inválido na recompensa ${index + 1}.`);
    }

    if (!deliveryValue) {
      throw new Error(
        `Informe o código, grupo, item ou modelo da recompensa ${index + 1}.`
      );
    }

    if (!allowedRecipientModes.has(recipientMode)) {
      throw new Error(
        `Destino inválido na recompensa ${index + 1}.`
      );
    }

    return {
      delivery_type: deliveryType,
      delivery_value: deliveryValue,
      delivery_amount: Math.max(
        1,
        Number.parseInt(delivery?.delivery_amount, 10) || 1
      ),
      delivery_days: Math.max(
        0,
        Number.parseInt(delivery?.delivery_days, 10) || 0
      ),
      recipient_mode: recipientMode,
      sort_order: Number.isFinite(Number(delivery?.sort_order))
        ? Number(delivery.sort_order)
        : index,
    };
  });
}

async function replaceProductDeliveries(connection, productId, deliveries) {
  await connection.execute(
    "DELETE FROM product_deliveries WHERE product_id = ?",
    [productId]
  );

  for (let index = 0; index < deliveries.length; index += 1) {
    const delivery = deliveries[index];

    await connection.execute(
      `
      INSERT INTO product_deliveries
      (
        product_id,
        delivery_type,
        delivery_value,
        delivery_amount,
        delivery_days,
        recipient_mode,
        sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        productId,
        delivery.delivery_type,
        delivery.delivery_value,
        delivery.delivery_amount,
        delivery.delivery_days,
        delivery.recipient_mode,
        index,
      ]
    );
  }
}

router.get("/", async (req, res) => {
  try {
    const isAdminView = req.query.admin === "true";

    const sql = `
      SELECT 
        p.id,
        p.name,
        p.price,
        p.old_price,
        p.discount,
        p.tag,
        p.category_id,
        p.active,
        p.sort_order,
        p.description,
        p.delivery_type,
        p.delivery_value,
        p.delivery_amount,
        p.delivery_days,
        p.vip_max_members,
        c.name AS category_name,
        CASE
          WHEN p.image_data IS NOT NULL THEN CONCAT('/api/products/', p.id, '/image')
          ELSE NULL
        END AS image_url
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ${isAdminView ? "" : "WHERE p.active = 1"}
      ORDER BY p.sort_order ASC, p.name ASC
    `;

    const [rows] = await pool.execute(sql);

    if (!rows.length) {
      return res.json([]);
    }

    const productIds = rows.map((product) => product.id);
    const placeholders = productIds.map(() => "?").join(", ");

    const [deliveryRows] = await pool.execute(
      `
      SELECT
        id,
        product_id,
        delivery_type,
        delivery_value,
        delivery_amount,
        delivery_days,
        recipient_mode,
        sort_order
      FROM product_deliveries
      WHERE product_id IN (${placeholders})
      ORDER BY product_id ASC, sort_order ASC, id ASC
      `,
      productIds
    );

    const deliveriesByProduct = new Map();

    for (const delivery of deliveryRows) {
      const productId = String(delivery.product_id);

      if (!deliveriesByProduct.has(productId)) {
        deliveriesByProduct.set(productId, []);
      }

      deliveriesByProduct.get(productId).push({
        id: delivery.id,
        delivery_type: delivery.delivery_type,
        delivery_value: delivery.delivery_value,
        delivery_amount: Number(delivery.delivery_amount || 1),
        delivery_days: Number(delivery.delivery_days || 0),
        recipient_mode: delivery.recipient_mode || "buyer",
        sort_order: Number(delivery.sort_order || 0),
      });
    }

    const products = rows.map((product) => ({
      ...product,
      deliveries: deliveriesByProduct.get(String(product.id)) || [],
    }));

    return res.json(products);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    return res.status(500).json({ message: "Erro ao listar produtos." });
  }
});

router.get("/:id/image", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `
      SELECT image_data, image_mime_type
      FROM products
      WHERE id = ?
      `,
      [id]
    );

    if (!rows.length || !rows[0].image_data) {
      return res.status(404).send("Imagem não encontrada.");
    }

    res.setHeader(
      "Content-Type",
      rows[0].image_mime_type || "application/octet-stream"
    );
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(rows[0].image_data);
  } catch (error) {
    console.error("Erro ao buscar imagem do produto:", error);
    return res.status(500).send("Erro ao buscar imagem.");
  }
});

router.post(
  "/",
  authRequired,
  adminOnly,
  upload.single("image"),
  async (req, res) => {
    let connection;

    try {
      const {
        name,
        price,
        old_price,
        discount,
        tag,
        category_id,
        active,
        sort_order,
        description,
        vip_max_members,
        deliveries: rawDeliveries,
      } = req.body;

      if (!name || !price) {
        return res
          .status(400)
          .json({ message: "Nome e preço são obrigatórios." });
      }

      const deliveries = parseDeliveries(rawDeliveries);
      const hasAllMembersReward = deliveries.some(
        (delivery) =>
          delivery.delivery_type === "vip_fac" ||
          delivery.recipient_mode === "all_members"
      );

      const vipMaxMembers = Math.max(
        0,
        Number.parseInt(vip_max_members, 10) || 0
      );

      if (hasAllMembersReward && vipMaxMembers <= 0) {
        return res.status(400).json({
          message:
            "Informe o máximo de membros para produtos com entrega a todos os membros.",
        });
      }

      const id = uuidv4();

      const imageData = req.file ? req.file.buffer : null;
      const imageMimeType = req.file ? req.file.mimetype : null;
      const activeValue = parseActive(active);

      // Mantém as colunas antigas sincronizadas com a primeira recompensa.
      // Isso evita quebrar partes do sistema que ainda serão atualizadas.
      const firstDelivery = deliveries[0] || null;

      connection = await pool.getConnection();
      await connection.beginTransaction();

      await connection.execute(
        `
        INSERT INTO products
        (
          id,
          name,
          price,
          old_price,
          discount,
          tag,
          category_id,
          image_url,
          image_data,
          image_mime_type,
          active,
          sort_order,
          description,
          delivery_type,
          delivery_value,
          delivery_amount,
          delivery_days,
          vip_max_members
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          name,
          Number(price),
          old_price ? Number(old_price) : null,
          discount ? Number(discount) : null,
          tag || null,
          category_id || null,
          null,
          imageData,
          imageMimeType,
          activeValue,
          sort_order ? Number(sort_order) : 0,
          description || null,
          firstDelivery?.delivery_type || "none",
          firstDelivery?.delivery_value || null,
          firstDelivery?.delivery_amount || 1,
          firstDelivery?.delivery_days || 0,
          vipMaxMembers,
        ]
      );

      await replaceProductDeliveries(connection, id, deliveries);

      await connection.commit();

      return res.status(201).json({
        message: "Produto criado com sucesso.",
        id,
        deliveries,
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {}
      }

      console.error("🔥 ERRO AO CRIAR PRODUTO:");
      console.error(error);

      return res.status(500).json({
        message: "Erro ao criar produto.",
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/:id",
  authRequired,
  adminOnly,
  upload.single("image"),
  async (req, res) => {
    let connection;

    try {
      const { id } = req.params;

      const {
        name,
        price,
        old_price,
        discount,
        tag,
        category_id,
        active,
        sort_order,
        description,
        vip_max_members,
        deliveries: rawDeliveries,
      } = req.body;

      if (!name || !price) {
        return res
          .status(400)
          .json({ message: "Nome e preço são obrigatórios." });
      }

      const deliveries = parseDeliveries(rawDeliveries);
      const hasAllMembersReward = deliveries.some(
        (delivery) =>
          delivery.delivery_type === "vip_fac" ||
          delivery.recipient_mode === "all_members"
      );

      const vipMaxMembers = Math.max(
        0,
        Number.parseInt(vip_max_members, 10) || 0
      );

      if (hasAllMembersReward && vipMaxMembers <= 0) {
        return res.status(400).json({
          message:
            "Informe o máximo de membros para produtos com entrega a todos os membros.",
        });
      }

      const activeValue = parseActive(active);
      const firstDelivery = deliveries[0] || null;

      console.log("ACTIVE RECEBIDO:", active, typeof active);
      console.log("ACTIVE CONVERTIDO:", activeValue);
      console.log("RECOMPENSAS RECEBIDAS:", deliveries.length);

      connection = await pool.getConnection();
      await connection.beginTransaction();

      let imageSql = "";

      const params = [
        name,
        Number(price),
        old_price ? Number(old_price) : null,
        discount ? Number(discount) : null,
        tag || null,
        category_id || null,
        activeValue,
        sort_order ? Number(sort_order) : 0,
        description || null,
        firstDelivery?.delivery_type || "none",
        firstDelivery?.delivery_value || null,
        firstDelivery?.delivery_amount || 1,
        firstDelivery?.delivery_days || 0,
        vipMaxMembers,
      ];

      if (req.file) {
        imageSql = ", image_data = ?, image_mime_type = ?, image_url = NULL";
        params.push(req.file.buffer, req.file.mimetype);
      }

      params.push(id);

      const [result] = await connection.execute(
        `
        UPDATE products
        SET
          name = ?,
          price = ?,
          old_price = ?,
          discount = ?,
          tag = ?,
          category_id = ?,
          active = ?,
          sort_order = ?,
          description = ?,
          delivery_type = ?,
          delivery_value = ?,
          delivery_amount = ?,
          delivery_days = ?,
          vip_max_members = ?
          ${imageSql}
        WHERE id = ?
        `,
        params
      );

      if (!result.affectedRows) {
        await connection.rollback();
        return res.status(404).json({
          message: "Produto não encontrado.",
        });
      }

      await replaceProductDeliveries(connection, id, deliveries);

      await connection.commit();

      return res.json({
        message: "Produto atualizado com sucesso.",
        deliveries,
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {}
      }

      console.error("Erro ao atualizar produto:", error);

      return res.status(500).json({
        message: "Erro ao atualizar produto.",
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  let connection;

  try {
    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      "DELETE FROM product_deliveries WHERE product_id = ?",
      [id]
    );

    await connection.execute(
      "DELETE FROM products WHERE id = ?",
      [id]
    );

    await connection.commit();

    return res.json({ message: "Produto excluído com sucesso." });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error("Erro ao excluir produto:", error);

    return res.status(500).json({
      message: "Erro ao excluir produto.",
      error: error.message,
      sqlMessage: error.sqlMessage,
      code: error.code,
    });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
