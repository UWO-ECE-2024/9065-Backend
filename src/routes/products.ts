import { Router } from "express";

const productsRoutes = Router();

/**
 * @swagger
 * /products/list:
 *   get:
 *     summary: Get all products.
 *     description: Get all products from the database.
 *     parameters:
 *
 *     responses:
 *       '200':
 *         description: A successful response
 *       '404':
 *         description: Not found
 *       '500':
 *         description: Internal server error
 */
productsRoutes.get("/list", (req, res) => {
  try {
    return res.status(200).json({
      data: {},
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
 * /products/list/{id}:
 *   get:
 *     summary: Get a product by ID.
 *     description: Retrieve a single product from the database using its ID.
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

productsRoutes.get("/list/:id", (req, res) => {
  try {
    const id = req.params.id;
    return res.status(200).json({
      data: { id: id },
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

export default productsRoutes;
