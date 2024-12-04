import { Router } from "express";
import { db } from "../db";
import {products, categories, productImages, orders, orderItems} from "../db/schema";
import { eq } from "drizzle-orm";
import { generator } from "../libs/id_generator";
import { bigint, timestamp } from "drizzle-orm/pg-core";
import fs from "fs";
import multer from "multer";
import path from "path";
import swaggerJSDoc from "swagger-jsdoc";
import { 
  User, 
  Order, 
  OrderItem, 
  Product, 
  UserAddress, 
  PaymentMethod 
} from '../db/schema';
import { Resend } from "resend";
import dayjs from "dayjs";

const stocksRoutes = Router();

// 配置 multer 存储选项
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 将文件保存到项目根目录的 'upload' 文件夹中
    cb(null, path.join(__dirname, "../upload"));
  },
  filename: function (req, file, cb) {
    // 使用时间戳和随机数生成唯一文件名
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// 创建 multer 实例
const upload = multer({ storage: storage,  limits: { fileSize: 10 * 1024 * 1024 }});

// 修改 resend 的初始化
const resend = new Resend(process.env.EMAIL_KEY);

// 添加 '/addCategory' 路由
/*
@swagger
 */

/**
 * @swagger
 * /stocks/addCategory:
 *   post:
 *     summary: Adds a new category
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - name
 *             properties:
 *               category_id:
 *                 type: string
 *                 description: The unique identifier for the category
 *               name:
 *                 type: string
 *                 description: The name of the category
 *               description:
 *                 type: string
 *                 description: A brief description of the category
 *               parent_category_id:
 *                 type: string
 *                 description: The identifier for the parent category
 *     responses:
 *       201:
 *         description: Category added successfully
 *       404:
 *         description: Required fields are missing
 *       500:
 *         description: Internal server error
 */

stocksRoutes.post("/addCategory", async (req: any, res: any) => {
  // 原有代码保持不变
  const { category_id, name, description, parent_category_id } = req.body;
  if (!category_id || !name) {
    return res.status(404).json({ error: "no category id found or no name" });
  }
  try {
    const category = {
      categoryId: category_id,
      name: name,
      description: description,
      parentCategoryId: parent_category_id,
    };
    const newCategory = await db.insert(categories).values(category).execute();

    res.status(201).send({
      message: "category added successfully",
      categoryId: category.categoryId,
    });
  } catch (error) {
    console.error("Error inserting new category:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// 添加 '/addProduct' 路由

/**
 * @swagger
 * /stocks/addProduct:
 *   post:
 *     summary: Adds a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - name
 *               - base_price
 *               - stock_quantity
 *               - pics
 *             properties:
 *               category_id:
 *                 type: string
 *                 description: The category identifier the product belongs to
 *               name:
 *                 type: string
 *                 description: The name of the product
 *               base_price:
 *                 type: number
 *                 format: float
 *                 description: The base price of the product
 *               description:
 *                 type: string
 *                 description: A brief description of the product
 *               stock_quantity:
 *                 type: integer
 *                 description: The amount of stock available
 *               pics:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of picture URLs
 *     responses:
 *       201:
 *         description: Product added successfully
 *       404:
 *         description: Required fields are missing
 *       500:
 *         description: Internal server error
 */

async function deleteProduct(id:any) {
  const oldpics = await db.select().from(productImages).where(eq(productImages.productId,id));
  for (const pic of oldpics) {
    const filePath = path.join(__dirname, "..", pic.url); // 根据实际的图片路径调整
    fs.rm(filePath, (err) => {
      if (err) {
        console.error(" pic remove failed" + err);
      }
    })
  }
  await db.delete(productImages).where(eq(productImages.productId,id)).execute().then(async () => {
    await db.delete(products).where(eq(products.productId,id)).execute();
  })
}




stocksRoutes.post("/addProduct", async (req: any, res: any) => {
  // 原有代码保持不变
  console.log(req.body);
  const { category_id, name, base_price, description, stock_quantity, pics } =
    req.body;

  if (!category_id || !name || base_price == null || stock_quantity == null) {
    return res.status(404).send({
      error:
        "Missing required fields. Category ID, name, base price, stock quantity are required.",
    });
  }
  if (!pics || pics.length === 0) {
    return res.status(404).send({ error: "missing pics" });
  }

  try {
    const product = {
      stockQuantity: stock_quantity,
      basePrice: base_price,
      productId: Number(generator.nextId()),
      name: name,
      price: base_price,
      categoryId: category_id,
      description: description || "",
      pics: pics || [],
    };

    const newProduct = await db
      .insert(products)
      .values(product)
      .execute()
      .then(async () => {
        for (let i = 0; i < pics.length; i++) {
          const pic_sql = {
            productId: product.productId,
            url: pics[i],
            imageId: Number(generator.nextId()),
            isPrimary: i == 0,
          };
          await db.insert(productImages).values(pic_sql).execute();
        }
      });

    res.status(201).send({
      message: "Product added successfully",
    });
  } catch (error) {
    console.error("Error inserting new product:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});


stocksRoutes.post("/updateProduct", async (req: any, res: any) => {
   // remove old pics
  const { id,category_id, name, base_price, description, stock_quantity, pics } =
      req.body;

  if (!id || !category_id || !name || base_price == null || stock_quantity == null) {
    return res.status(404).send({
      error:
          "Missing required fields. Product Id, Category ID, name, base price, stock quantity are required.",
    });
  }
  if (!pics || pics.length === 0) {
    return res.status(404).send({ error: "missing pics" });
  }
  try {
    const product = {
      stockQuantity: stock_quantity,
      basePrice: base_price,
      productId: id,
      name: name,
      price: base_price,
      categoryId: category_id,
      description: description || "",
      pics: pics || [],
    };
    await deleteProduct(id).then(() => {
          db.insert(products)
              .values(product)
              .execute()
              .then(async () => {
                for (let i = 0; i < pics.length; i++) {
                  const pic_sql = {
                    productId: product.productId,
                    url: pics[i],
                    imageId: Number(generator.nextId()),
                    isPrimary: i == 0,
                  };
                  await db.insert(productImages).values(pic_sql).execute();
                }
              });
          }
      );
    res.status(201).send({
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Error inserting new product:", error);
    res.status(500).send({ error: "Internal server error" });
  }
})

stocksRoutes.patch("/deleteProductById/:id", async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    await deleteProduct(id);
    res.send({ message: "stock deleted successfully" });
  } catch (error) {
    console.error("Error deleting stock:", error);
    res.status(500).send({ error: "Internal server error" });
  }
})

/**
 * @swagger
 * /stocks/addPics:
 *   post:
 *     summary: Uploads multiple pictures
 *     tags: [Pictures]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of image files
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *       400:
 *         description: No files were uploaded
 *       500:
 *         description: Internal server error
 */
stocksRoutes.post(
  "/addPics",
  upload.array("images", 10),
  async (req: any, res: any) => {
    // console.log('here reached');
    try {
      // @ts-ignore
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).send({ error: "No files were uploaded." });
      }
      console.log("here reached");
      // @ts-ignore
      const filePaths = files.map((file: String) => {
        // 返回文件相对于 'upload' 文件夹的路径
        // @ts-ignore
        return `/upload/${file.filename}`;
      });

      res.status(200).send({
        message: "Files uploaded successfully.",
        filePaths: filePaths,
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);
/**
 * @swagger
 * /stocks/getPicsByProductId/{id}:
 *   get:
 *     summary: Retrieves all pictures for a given product ID
 *     tags: [Pictures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Pictures retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                       mimeType:
 *                         type: string
 *                       data:
 *                         type: string
 *                         format: binary
 *                       isPrimary:
 *                         type: boolean
 *       404:
 *         description: Pics not found
 *       500:
 *         description: Internal server error
 */

stocksRoutes.get("/getPicsByProductId/:id", async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const pics = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, id));

    if (!pics || pics.length === 0) {
      return res.status(404).send({ message: "Pics not found" });
    }

    const images = [];

    for (const pic of pics) {
      const filePath = path.join(__dirname, "..", pic.url); // 根据实际的图片路径调整
      const fileData = fs.readFileSync(filePath);
      const base64Image = fileData.toString("base64");
      const mimeType = getMimeType(filePath); // 获取文件的 MIME 类型，例如 'image/jpeg'

      images.push({
        filename: path.basename(pic.url),
        mimeType: mimeType,
        data: base64Image,
        isPrimary: pic.isPrimary,
      });
    }

    res.status(200).send({
      message: "Pics retrieved successfully",
      images: images,
    });
  } catch (error) {
    console.error("Error getting pics by id:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// 定义关联查询的返回类型
type OrderWithRelations = Order & {
  user: User;
  items: (OrderItem & {
    product: Product;
  })[];
  shippingAddress: UserAddress;
  billingAddress: UserAddress;
  paymentMethod: PaymentMethod;
};

stocksRoutes.get("/orders/list", async (req: any, res: any) => {
  try {
    const ordersList = await db.query.orders.findMany({
      with: {
        items: {
          with: {
            product: true
          }
        },
        user: true,
        shippingAddress: true,
        billingAddress: true,
        paymentMethod: true
      },
      orderBy: (orders, { desc }) => [desc(orders.createdAt)]
    }) as OrderWithRelations[];

    if (!ordersList || ordersList.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No orders found",
        data: []
      });
    }

    const formattedOrders = ordersList.map(order => ({
      orderId: order.orderId,
      userId: order.userId,
      user: order.user && {
        userId: order.user.userId,
        email: order.user.email,
        firstName: order.user.firstName,
        lastName: order.user.lastName,
        phone: order.user.phone
      },
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentMethod: order.paymentMethod && {
        paymentId: order.paymentMethod.paymentId,
        cardType: order.paymentMethod.cardType,
        lastFour: order.paymentMethod.lastFour,
        holderName: order.paymentMethod.holderName,
      },
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map(item => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        productId: item.product.productId,
        productName: item.product.name,
        product: {
          productId: item.product.productId,
          name: item.product.name,
          basePrice: item.product.basePrice,
          description: item.product.description,
        }
      }))
    }));

    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: formattedOrders
    });
  } catch (error) {
    console.error("Error getting orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve orders",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

stocksRoutes.get("/orders/:orderId", async (req: any, res: any) => {
  const { orderId } = req.params;

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderId, parseInt(orderId)),
      with: {
        items: {
          with: {
            product: true
          }
        },
        shippingAddress: true,
        billingAddress: true,
        paymentMethod: true,
        user: {
          columns: {
            password: false,
            salt: false
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const formattedOrder = {
      orderId: order.orderId,
      userId: order.userId,
      user: order.user,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map(item => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        product: item.product,
        status: item.status
      }))
    };

    res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: formattedOrder
    });
  } catch (error) {
    console.error("Error getting order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve order",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

stocksRoutes.patch("/orders/:orderId/status", async (req: any, res: any) => {
  const { orderId } = req.params;
  const { status, itemStatuses } = req.body;

  try {
    const validOrderStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    const validItemStatuses = ["pending", "processing", "shipped", "delivered", "cancelled", "returned"];

    if (status && !validOrderStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
        error: `Order status must be one of: ${validOrderStatuses.join(", ")}`
      });
    }

    // Get order details with user information
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderId, parseInt(orderId)),
      with: {
        items: {
          with: {
            product: true
          }
        },
        user: true,
        shippingAddress: true
      }
    }) as (Order & {
      items: (OrderItem & { product: Product })[];
      user: User;
      shippingAddress: UserAddress;
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Start a transaction
    await db.transaction(async (tx) => {
      // Update order status if provided
      if (status) {
        await tx.update(orders)
          .set({ 
            status,
            updatedAt: new Date()
          })
          .where(eq(orders.orderId, parseInt(orderId)));
      }

      // Update individual item statuses if provided
      if (itemStatuses && typeof itemStatuses === 'object') {
        for (const [itemId, itemStatus] of Object.entries(itemStatuses)) {
          if (!validItemStatuses.includes(itemStatus as string)) {
            throw new Error(`Invalid item status: ${itemStatus}`);
          }
          
          await tx.update(orderItems)
            .set({ 
              status: itemStatus as string,
              updatedAt: new Date()
            })
            .where(eq(orderItems.orderItemId, parseInt(itemId)));
        }
      }

      // Send email notification
      const statusMessages = {
        pending: "is pending confirmation",
        processing: "is being processed",
        shipped: "has been shipped",
        delivered: "has been delivered",
        cancelled: "has been cancelled"
      };

      if (status) { // 只在更新订单状态时发送邮件
        try {
          const { error: emailError } = await resend.emails.send({
            from: "Laptop Store <shop@email.jimmieluo.com>",
            to: [order.user.email],
            subject: `Order #${orderId} Status Update`,
            html: getOrderStatusEmailTemplate(
              parseInt(orderId),
              status,
              statusMessages[status as keyof typeof statusMessages],
              order
            )
          });

          if (emailError) {
            console.error('Error sending email:', emailError);
          }
        } catch (error) {
          console.error('Error sending email:', error);
        }
      }
    });

    res.status(200).json({
      success: true,
      message: "Order status updated successfully"
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// 辅助函数：根据文件扩展名获取 MIME 类型
function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

// 其他路由保持不变

/**
 * @swagger
 * /stocks/increaseStockById/{id}:
 *   patch:
 *     summary: Increments the stock quantity by 1 for a specific product ID
 *     tags: [Stock Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Stock quantity incremented successfully
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */

stocksRoutes.patch("/increaseStockById/:id", async (req: any, res: any) => {
  // 原有代码
  try {
    const id = parseInt(req.params.id);
    const currentProduct = await db
      .select()
      .from(products)
      .where(eq(products.productId, id));
    if (currentProduct.length === 0) {
      return res.status(404).send({ message: "Product not found" });
    }
    const newStockQuantity = currentProduct[0].stockQuantity + 1;
    await db
      .update(products)
      .set({ stockQuantity: newStockQuantity })
      .where(eq(products.productId, id));

    res.send({ message: "Stock quantity incremented successfully" });
  } catch (error) {
    console.error("Error incrementing stock:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});
/**
 * @swagger
 * /stocks/decreaseStockById/{id}:
 *   patch:
 *     summary: Decrements the stock quantity by 1 for a specific product ID
 *     tags: [Stock Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Stock quantity decremented successfully, or already zero
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */

stocksRoutes.patch("/decreaseStockById/:id", async (req: any, res: any) => {
  // 原有代码
  try {
    const id = parseInt(req.params.id);
    const currentProduct = await db
      .select()
      .from(products)
      .where(eq(products.productId, id));
    if (currentProduct.length === 0) {
      return res.status(404).send({ message: "Product not found" });
    }
    const newStockQuantity = currentProduct[0].stockQuantity - 1;
    if (newStockQuantity < 0) {
      return res.status(200).send({ message: "Already zero" });
    }
    await db
      .update(products)
      .set({ stockQuantity: newStockQuantity })
      .where(eq(products.productId, id));

    res.send({ message: "Stock quantity decremented successfully" });
  } catch (error) {
    console.error("Error decrementing stock:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// 添加邮件模板函数
function getOrderStatusEmailTemplate(
  orderId: number,
  status: string,
  statusMessage: string,
  order: Order & {
    items: (OrderItem & { product: Product })[];
    user: User;
    shippingAddress: UserAddress;
  }
) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Status Update</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <tr>
            <td style="padding: 40px 20px; text-align: center; background-color: #f9f9f9;">
                <h1 style="color: #4CAF50; margin-top: 20px;">Order Status Update</h1>
                <p style="font-size: 16px; color: #666;">Your order #${orderId} ${statusMessage}</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td width="50%" style="padding-bottom: 20px;">
                            <p style="font-size: 14px; color: #666; margin: 0;">Order number</p>
                            <p style="font-size: 16px; font-weight: bold; margin: 5px 0 0;">#${orderId}</p>
                        </td>
                        <td width="50%" style="text-align: right; padding-bottom: 20px;">
                            <p style="font-size: 14px; color: #666; margin: 0;">Status updated on</p>
                            <p style="font-size: 16px; font-weight: bold; margin: 5px 0 0;">${dayjs().format("MMMM D, YYYY")}</p>
                        </td>
                    </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
                    <tr>
                        <td style="padding: 20px 0;">
                            <h2 style="font-size: 18px; margin: 0 0 10px;">Order Summary</h2>
                            <table width="100%" cellpadding="5" cellspacing="0">
                                ${order.items.map(item => `
                                    <tr>
                                        <td style="font-size: 14px;">${item.product.name} x ${item.quantity}</td>
                                        <td style="font-size: 14px; text-align: right;">$${item.unitPrice}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        </td>
                    </tr>
                </table>
                <table width="100%" cellpadding="5" cellspacing="0" style="margin-top: 20px;">
                    <tr>
                        <td style="font-size: 16px; font-weight: bold;">Total</td>
                        <td style="font-size: 16px; font-weight: bold; text-align: right;">$${order.totalAmount}</td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px; text-align: center; background-color: #f9f9f9; font-size: 14px; color: #666;">
                <p>Shipping to: ${order.shippingAddress.streetAddress}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}</p>
                <p>If you have any questions, please contact our customer support at <a href="mailto:sluo263@uwo.ca" style="color: #4CAF50; text-decoration: none;">sluo263@uwo.ca</a></p>
                <p>&copy; 2024 Si Luo eCommerce Store. All rights reserved.</p>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

export default stocksRoutes;
