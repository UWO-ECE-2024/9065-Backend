import { Router } from "express";
import { db } from "../db";
import { categories, products } from "../db/schema";
import { eq } from "drizzle-orm";

const categoryRoutes = Router();

/**
 * @swagger
 * /category/list:
 *   get:
 *     summary: Retrieve all categories.
 *     description: Fetch a list of all categories from the database.
 *     tags:
 *       - Category
 *     responses:
 *       '200':
 *         description: A successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   categoryId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   parentCategoryId:
 *                     type: string
 *                   isActive:
 *                     type: boolean
 *       '500':
 *         description: Internal server error
 */

categoryRoutes.get("/list", async (req, res) => {
  try {
    const allCategories = await db.select().from(categories).execute();
    res.status(200).json(allCategories);
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

/**
 * @swagger
 * /category/{id}/products:
 *   get:
 *     summary: Get products by category ID.
 *     description: Retrieve all products associated with a specific category ID.
 *     tags:
 *       - Category
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the category to retrieve products for.
 *     responses:
 *       '200':
 *         description: A successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   productId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   basePrice:
 *                     type: number
 *                   stockQuantity:
 *                     type: integer
 *                   sku:
 *                     type: string
 *                   isActive:
 *                     type: boolean
 *       '404':
 *         description: Category not found
 *       '500':
 *         description: Internal server error
 */

categoryRoutes.get("/:id/products", async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const productsList = await db
      .select()
      .from(products)
      .where(eq(products.categoryId, categoryId))
      .execute();

    if (productsList.length === 0) {
      return res.status(404).json({
        error: {
          issues: [
            {
              code: "not_found",
              message: "No products found for this category",
            },
          ],
        },
      });
    }

    res.status(200).json({
      data: productsList,
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



export default categoryRoutes;
