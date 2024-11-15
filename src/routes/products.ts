import { Router } from "express";
import { productAttributes, productReviews, products } from "../db/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

const productsRoutes = Router();

/**
 * @swagger
 * /products/list:
 *   get:
 *     summary: Retrieve a list of products.
 *     description: Fetch a list of all products from the database.
 *     tags:
 *       - Product
 *     responses:
 *       '200':
 *         description: A successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *       '500':
 *         description: Internal server error
 */
productsRoutes.get("/list", async (req, res) => {
  try {
    const result = await db.select().from(products);
    return res.status(200).json({
      data: result,
    }) as any;
  } catch (err) {
    return res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: "Internal server error",
          },
        ],
      },
    });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a product by ID.
 *     description: Retrieve a single product from the database using its ID.
 *     tags:
 *       - Product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the product to retrieve.
 *     responses:
 *       '200':
 *         description: A successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *       '404':
 *         description: Product not found
 *       '500':
 *         description: Internal server error
 */

productsRoutes.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Fetch product details
    const product = await db
      .select()
      .from(products)
      .where(eq(products.productId, id))
      .execute();

    if (product.length === 0) {
      return res.status(404).json({
        error: {
          issues: [
            {
              code: "not_found",
              message: "Product not found",
            },
          ],
        },
      });
    }

    // Fetch product attributes
    const attributes = await db
      .select()
      .from(productAttributes)
      .where(eq(productAttributes.productId, id))
      .execute();

    // Fetch product reviews
    const reviews = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.productId, id))
      .execute();

    res.status(200).json({
      data: {
        product: product[0],
        attributes: attributes,
        reviews: reviews,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: {
        issues: [
          {
            code: "internal_server_error",
            message: "Internal server error",
          },
        ],
      },
    });
  }
});



export default productsRoutes;
