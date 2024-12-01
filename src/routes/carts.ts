import { Router } from "express";
import { db } from "../db";
import {
  cartItems,
  carts,
  orderItems,
  orders,
  paymentMethods,
  users,
  products as pp,
} from "../db/schema";
import { generator } from "../libs/id_generator";
import { eq, and, sql } from "drizzle-orm";
import { resend } from "..";
import dayjs from "dayjs";

const cartRoutes = Router();

/**
 * @swagger
 * /cart/create:
 *   post:
 *     summary: Create a cart for a user.
 *     description: Create a new cart for a user in the database.
 *     tags:
 *       - Carts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user for whom the cart is being created.
 *                 example: "12345"
 *     responses:
 *       '201':
 *         description: Cart created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   description: The newly created cart data
 *       '400':
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           message:
 *                             type: string
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           message:
 *                             type: string
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           message:
 *                             type: string
 */

cartRoutes.post("/create", async (req: any, res: any) => {
  try {
    const { userId } = req.body;
    console.log(userId);

    if (!userId) {
      return res.status(400).json({
        error: {
          issues: [
            {
              code: "bad_request",
              message: "User ID is required",
            },
          ],
        },
      });
    }

    // Check if the user exists
    const userExists = await db
      .select()
      .from(users) // Assuming 'users' is the table name for users
      .where(eq(users.userId, userId))
      .execute();

    if (userExists.length === 0) {
      return res.status(404).json({
        error: {
          issues: [
            {
              code: "not_found",
              message: "User not found",
            },
          ],
        },
      });
    }

    const newCart = await db
      .insert(carts)
      .values({ cartId: Number(generator.nextId()), userId })
      .returning()
      .execute();

    res.status(201).json({
      message: "Cart created successfully",
      data: newCart,
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

/**
 * @swagger
 * /cart/update-items:
 *   put:
 *     summary: Update items in a cart.
 *     description: Replace all items in a specified cart with a new set of items.
 *     tags:
 *       - Carts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cartId:
 *                 type: string
 *                 description: The ID of the cart to update.
 *               items:
 *                 type: array
 *                 description: An array of items to be added to the cart.
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                       description: The ID of the product.
 *                     quantity:
 *                       type: integer
 *                       description: The quantity of the product.
 *                     unitPrice:
 *                       type: number
 *                       format: float
 *                       description: The unit price of the product.
 *     responses:
 *       '200':
 *         description: Cart items updated successfully
 *       '400':
 *         description: Bad request
 *       '500':
 *         description: Internal server error
 */
// @ts-ignore
cartRoutes.put("/update-items", async (req, res) => {
  try {
    const { cartId, items } = req.body;

    if (!cartId || !Array.isArray(items)) {
      return res.status(400).json({
        error: {
          issues: [
            {
              code: "bad_request",
              message: "Cart ID and items array are required",
            },
          ],
        },
      });
    }

    // Begin transaction
    await db.transaction(async (trx) => {
      // Clear existing items in the cart
      await trx.delete(cartItems).where(eq(cartItems.cartId, cartId)).execute();

      // Insert new items
      for (const item of items) {
        const { productId, quantity, unitPrice } = item;
        if (!productId || !quantity || !unitPrice) {
          throw new Error(
            "Each item must have productId, quantity, and unitPrice"
          );
        }

        await trx
          .insert(cartItems)
          .values({
            cartItemId: Number(generator.nextId()),
            cartId,
            productId,
            quantity,
            unitPrice,
          })
          .execute();
      }
    });

    res.status(200).json({
      message: "Cart items updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

/**
 * @swagger
 * /cart/{id}:
 *   delete:
 *     summary: Delete a cart and its items
 *     description: Deletes a cart and all items associated with it by cart ID.
 *     tags:
 *       - Carts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Numeric ID of the cart to delete
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cart and its items deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cart and its items deleted successfully
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                             example: internal_server_error
 *                           message:
 *                             type: string
 *                             example: Internal server error
 */
cartRoutes.delete("/:id", async (req, res) => {
  try {
    const cartId = parseInt(req.params.id);

    // Begin transaction
    await db.transaction(async (trx) => {
      // Delete items associated with the cart
      await trx.delete(cartItems).where(eq(cartItems.cartId, cartId)).execute();

      // Delete the cart itself
      await trx.delete(carts).where(eq(carts.cartId, cartId)).execute();
    });

    res.status(200).json({
      message: "Cart and its items deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

/**
 * @swagger
 * /cart/user/{userId}:
 *   get:
 *     summary: Retrieve the active cart for a user
 *     description: Fetches the active cart and its items for a specified user. If no active cart exists, a new one is created.
 *     tags:
 *       - Carts
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: Numeric ID of the user whose cart is being retrieved
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Active cart and its items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     cartId:
 *                       type: integer
 *                       description: The ID of the active cart
 *                     items:
 *                       type: array
 *                       description: List of items in the cart
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                             description: The ID of the product
 *                           quantity:
 *                             type: integer
 *                             description: The quantity of the product
 *                           unitPrice:
 *                             type: number
 *                             format: float
 *                             description: The unit price of the product
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                             example: internal_server_error
 *                           message:
 *                             type: string
 *                             example: Internal server error
 */
cartRoutes.get("/user/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Fetch the active cart associated with the user
    let cart = await db
      .select()
      .from(carts)
      .where(and(eq(carts.userId, userId), eq(carts.isActive, true)))
      .execute();

    // If no active cart exists, create a new one
    if (cart.length === 0) {
      const newCartId = Number(generator.nextId());
      await db
        .insert(carts)
        .values({
          cartId: newCartId,
          userId: userId,
          isActive: true,
        })
        .execute();

      cart = [
        {
          cartId: newCartId,
          userId: userId,
          isActive: true,
          createdAt: null,
          updatedAt: null,
          sessionId: null,
          lastActivity: null,
        },
      ];
    }

    // Fetch cart items for the user's active cart
    const cartItemsList = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart[0].cartId))
      .execute();

    res.status(200).json({
      data: {
        cartId: cart[0].cartId,
        items: cartItemsList,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

/**
 * @swagger
 * /cart/checkout:
 *   post:
 *     summary: Checkout and create an order
 *     description: Processes a checkout request, creates an order, and sends a confirmation email.
 *     tags:
 *       - Carts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               products:
 *                 type: array
 *                 description: List of products to be ordered
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                       description: The ID of the product
 *                     quantity:
 *                       type: integer
 *                       description: The quantity of the product
 *                     basePrice:
 *                       type: number
 *                       format: float
 *                       description: The base price of the product
 *               paymentMethod:
 *                 type: object
 *                 description: Payment method details
 *                 properties:
 *                   cardType:
 *                     type: string
 *                   lastFour:
 *                     type: string
 *                   holderName:
 *                     type: string
 *                   expiryDate:
 *                     type: string
 *               userId:
 *                 type: string
 *                 description: The ID of the user making the order
 *               addressId:
 *                 type: string
 *                 description: The ID of the address for shipping and billing
 *               email:
 *                 type: string
 *                 description: The email address to send the order confirmation
 *     responses:
 *       '201':
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: integer
 *                       description: The ID of the created order
 *                     orderTime:
 *                       type: string
 *                       format: date-time
 *                       description: The time the order was created
 *                     products:
 *                       type: array
 *                       description: List of ordered products
 *                       items:
 *                         type: object
 *                     email:
 *                       type: object
 *                       description: Email sending result
 *                     message:
 *                       type: string
 *                       example: Order created successfully
 *       '400':
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           message:
 *                             type: string
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                             example: internal_server_error
 *                           message:
 *                             type: string
 *                             example: Internal server error
 */
cartRoutes.post("/checkout", async (req: any, res: any) => {
  try {
    const { products, paymentMethod, userId, addressId, email } = req.body;

    if (!products || !userId || !addressId) {
      return res.status(400).json({
        error: {
          issues: [
            {
              code: "invalid_request",
              message:
                "Missing required fields: products, paymentMethod, userId, or addressId",
            },
          ],
        },
      });
    }

    // Validate products and calculate total price
    await db.transaction(async (trx) => {
      // Validate products and calculate total price
      let totalPrice = 0;
      for (const product of products) {
        totalPrice += Number(product.basePrice) * product.quantity;
      }
      let tax = Number(totalPrice * 0.13);

      // Check if paymentMethod is an object and insert into payment table
      let paymentMethodId;
      if (typeof paymentMethod === "object") {
        const newPaymentId = Number(generator.nextId());
        await trx
          .insert(paymentMethods)
          .values({
            paymentId: newPaymentId,
            userId: Number(userId),
            cardType: paymentMethod.cardType,
            lastFour: paymentMethod.lastFour,
            holderName: paymentMethod.holderName,
            expiryDate: paymentMethod.expiryDate,
          })
          .execute();
        paymentMethodId = newPaymentId;
      } else {
        paymentMethodId = 0; // Assuming paymentMethod object has an 'id' property
      }

      // Update stock quantities
      for (const product of products) {
        const currentStock = await trx
          .select({ stockQuantity: pp.stockQuantity })
          .from(pp)
          .where(eq(pp.productId, product.productId))
          .execute();

        if (currentStock[0].stockQuantity < product.quantity) {
          throw new Error(
            `Insufficient stock for product ID ${product.productId}`
          );
        }
      }

      for (const p of products) {
        await trx
          .update(pp)
          .set({
            stockQuantity: sql`${pp.stockQuantity} - ${p.quantity}`,
          })
          .where(eq(pp.productId, p.productId))
          .execute();
      }

      // Create a new order
      const newOrderId = Number(generator.nextId());
      const create_time = await trx
        .insert(orders)
        // @ts-ignore
        .values({
          userId: Number(userId),
          shippingAddressId: Number(addressId),
          billingAddressId: Number(addressId),
          totalAmount: Number(totalPrice + tax),
          orderId: newOrderId,
          paymentMethodId: paymentMethodId,
          status: "pending",
        })
        .returning({ createdAt: orders.createdAt })
        .execute();

      // Insert order items
      for (const product of products) {
        const orderItemId = Number(generator.nextId());
        await trx
          .insert(orderItems)
          // @ts-ignore
          .values({
            orderItemId,
            orderId: newOrderId,
            productId: product.productId,
            quantity: product.quantity,
            unitPrice: product.basePrice,
            subtotal: Number(product.basePrice) * product.quantity,
          })
          .execute();
      }
      const { data, error } = await resend.emails.send({
        from: "Laptop Store <shop@email.jimmieluo.com>",
        to: [email],
        subject: "Order Receipt",
        html: `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Successful - Order Confirmation</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <tr>
              <td style="padding: 40px 20px; text-align: center; background-color: #f9f9f9;">
                  <img src="https://cdn-icons-png.flaticon.com/512/17676/17676914.png" alt="Success" style="width: 60px; height: 60px;">
                  <h1 style="color: #4CAF50; margin-top: 20px;">Payment Successful!</h1>
                  <p style="font-size: 16px; color: #666;">Thank you for your purchase. Your order has been confirmed.</p>
              </td>
          </tr>
          <tr>
              <td style="padding: 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                          <td width="50%" style="padding-bottom: 20px;">
                              <p style="font-size: 14px; color: #666; margin: 0;">Order number</p>
                              <p style="font-size: 16px; font-weight: bold; margin: 5px 0 0;">${newOrderId}</p>
                          </td>
                          <td width="50%" style="text-align: right; padding-bottom: 20px;">
                              <p style="font-size: 14px; color: #666; margin: 0;">Order date</p>
                              <p style="font-size: 16px; font-weight: bold; margin: 5px 0 0;">${dayjs(
                                create_time[0].createdAt
                              ).format("MMMM D, YYYY")}</p>
                          </td>
                      </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0">
                      
                      <tr>
                          <td style="text-align: center; padding-bottom: 20px;">
                              <p style="font-size: 16px; margin: 0;">Estimated delivery: <strong>${dayjs(
                                create_time[0].createdAt
                              )
                                .add(5, "day")
                                .format("MMMM D, YYYY")}</strong></p>
                          </td>
                      </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
                      <tr>
                          <td style="padding: 20px 0;">
                              <h2 style="font-size: 18px; margin: 0 0 10px;">Order Summary</h2>
                              <table width="100%" cellpadding="5" cellspacing="0">
                                  ${products.map((p: any) => {
                                    return `<tr>
                                            <td style="font-size: 14px;">${p.name} x ${p.quantity}</td>
                                            <td style="font-size: 14px; text-align: right;">$${p.basePrice}</td>
                                          </tr>
                                      `;
                                  })}
                              </table>
                          </td>
                      </tr>
                  </table>
                  <table width="100%" cellpadding="5" cellspacing="0" style="margin-top: 20px;">
                      <tr>
                          <td style="font-size: 14px;">Subtotal</td>
                          <td style="font-size: 14px; text-align: right;">$${totalPrice}</td>
                      </tr>
                      <tr>
                          <td style="font-size: 14px;">Tax</td>
                          <td style="font-size: 14px; text-align: right;">$${tax.toFixed(
                            2
                          )}</td>
                      </tr>
                      <tr>
                          <td style="font-size: 16px; font-weight: bold;">Total</td>
                          <td style="font-size: 16px; font-weight: bold; text-align: right;">$${Number(
                            totalPrice + tax
                          ).toFixed(2)}</td>
                      </tr>
                  </table>
              </td>
          </tr>
          <!-- <tr>
              <td style="padding: 20px; text-align: center;">
                  <a href="#" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 5px;">View Order Details</a>
              </td>
          </tr> -->
          <tr>
              <td style="padding: 20px; text-align: center; background-color: #f9f9f9; font-size: 14px; color: #666;">
                  <p>If you have any questions, please contact our customer support at <a href="mailto:sluo263@uwo.ca" style="color: #4CAF50; text-decoration: none;">sluo263@uwo.ca</a></p>
                  <p>&copy; 2024 Si Luo eCommerce Store. All rights reserved.</p>
              </td>
          </tr>
      </table>
  </body>
  </html>`,
      });
      res.status(201).json({
        data: {
          orderId: newOrderId,
          orderTime: create_time[0].createdAt,
          products: products,
          email: data,
          message: "Order created successfully",
        },
      });
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

export default cartRoutes;
