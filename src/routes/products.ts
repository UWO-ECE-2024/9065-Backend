import { Router } from "express";
import {
  productAttributes,
  productImages,
  productReviews,
  products,
} from "../db/schema";
import { db } from "../db";
import { desc, eq, like, or } from "drizzle-orm";

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
    const result = await db
      .select()
      .from(products)
      .leftJoin(
        productAttributes,
        eq(products.productId, productAttributes.productId)
      )
      .leftJoin(productImages, eq(products.productId, productImages.productId))
      .orderBy(desc(products.createdAt))
      .limit(50);
    return res.status(200).json({
      data: result,
    }) as any;
  } catch (error) {
    return res.status(500).json({
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

// @ts-ignore
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
            message: (error as Error).message ?? "Internal server error",
          },
        ],
      },
    });
  }
});

/**
 * @swagger
 * /products/search:
 *   get:
 *     summary: Search for products.
 *     description: Retrieve a list of products based on search criteria such as name, description, or category. Includes product images.
 *     tags:
 *       - Product
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter products by name or description.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID to filter products.
 *     responses:
 *       '200':
 *         description: A successful response with a list of products and their images.
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
 *                       productId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       basePrice:
 *                         type: number
 *                       stockQuantity:
 *                         type: integer
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       images:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             imageId:
 *                               type: string
 *                             url:
 *                               type: string
 *                             altText:
 *                               type: string
 *                             displayOrder:
 *                               type: integer
 *                             isPrimary:
 *                               type: boolean
 *       '500':
 *         description: Internal server error
 */
productsRoutes.get("/search", async (req, res) => {
  try {
    const { search, category } = req.query;

    let productsList;

    if (search) {
      // Search for products by name or description and include images
      productsList = await db
        .select()
        .from(products)
        .leftJoin(
          productImages,
          eq(products.productId, productImages.productId)
        )
        .where(
          or(
            like(products.name, `%${search}%`),
            like(products.description, `%${search}%`)
          )
        )
        .execute();
    } else if (category) {
      // Fetch products by category and include images
      productsList = await db
        .select()
        .from(products)
        .leftJoin(
          productImages,
          eq(products.productId, productImages.productId)
        )
        .where(eq(products.categoryId, Number(category)))
        .execute();
    } else {
      // Fetch the latest 20 products and include images
      productsList = await db
        .select()
        .from(products)
        .leftJoin(
          productImages,
          eq(products.productId, productImages.productId)
        )
        .orderBy(desc(products.createdAt))
        .limit(20)
        .execute();
    }

    // Group products with their images
    const groupedProducts = productsList.reduce((acc, item) => {
      const { products, product_images } = item;
      const {
        productId,
        name,
        description,
        basePrice,
        stockQuantity,
        isActive,
        createdAt,
        updatedAt,
      } = products;
      const { imageId, url, altText, displayOrder, isPrimary } =
        product_images || {};
      if (!acc[productId]) {
        acc[productId] = {
          productId,
          name,
          description,
          basePrice,
          stockQuantity,
          isActive,
          createdAt,
          updatedAt,
          images: [],
        };
      }
      if (imageId) {
        if (!acc[productId].images) {
          acc[productId].images = [];
        }
        acc[productId].images.push({
          imageId,
          url,
          altText,
          displayOrder,
          isPrimary,
        });
      }
      return acc;
    }, {} as Record<number, any>);

    res.status(200).json({
      data: Object.values(groupedProducts),
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

export default productsRoutes;
