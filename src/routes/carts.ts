import { Router } from "express";
import { db } from "../db";
import { cartItems, carts, users } from "../db/schema";
import { generator } from "../libs/id_generator";
import { eq, and } from "drizzle-orm";

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

cartRoutes.post("/create", async (req, res) => {
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
            message: (error as Error).message ??  "Internal server error",
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
            message: (error as Error).message ??  "Internal server error",
          },
        ],
      },
    });
  }
});

export default cartRoutes;
