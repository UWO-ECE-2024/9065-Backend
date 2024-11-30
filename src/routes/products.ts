import { Router } from "express";
import {
  categories,
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
    const productsList = await db
      .select({
        products: {
          productId: products.productId,
          categoryId: products.categoryId,
          name: products.name,
          description: products.description,
          basePrice: products.basePrice,
          stockQuantity: products.stockQuantity,
          isActive: products.isActive,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        },
        product_images: {
          imageId: productImages.imageId,
          url: productImages.url,
          altText: productImages.altText,
          displayOrder: productImages.displayOrder,
          isPrimary: productImages.isPrimary,
        },
        product_attributes: {
          attributeId: productAttributes.attributeId,
          attributeName: productAttributes.key,
          attributeValue: productAttributes.value,
        },
      })
      .from(products)
      .leftJoin(productImages, eq(products.productId, productImages.productId))
      .leftJoin(
        productAttributes,
        eq(products.productId, productAttributes.productId)
      )
      .orderBy(desc(products.createdAt))
      .limit(50)
      .execute();

    // Group products with their images and attributes
    const groupedProducts = productsList.reduce((acc, item) => {
      const { products, product_images, product_attributes } = item;
      const {
        productId,
        categoryId,
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
      const { attributeId, attributeName, attributeValue } =
        product_attributes || {};

      if (!acc[productId]) {
        acc[productId] = {
          productId,
          categoryId,
          name,
          description,
          basePrice,
          stockQuantity,
          isActive,
          createdAt,
          updatedAt,
          images: [],
          attributes: [],
        };
      }
      if (imageId) {
        acc[productId].images.push({
          imageId,
          url,
          altText,
          displayOrder,
          isPrimary,
        });
      }
      if (attributeId) {
        acc[productId].attributes.push({
          attributeId,
          attributeName,
          attributeValue,
        });
      }
      return acc;
    }, {} as Record<number, any>);

    const result = Object.values(groupedProducts);
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
 * /products/search:
 *   get:
 *     summary: Search for products.
 *     description: Retrieve a list of products based on search criteria such as name, description, or category. Includes product images.
 *     tags:
 *       - Product
 *     parameters:
 *       - in: query
 *         name: query
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
    const { query, category } = req.query;

    let productsList;

    if (query) {
      // Search for products by name or description and include images
      productsList = await db
        .select({
          products: {
            productId: products.productId,
            name: products.name,
            description: products.description,
            basePrice: products.basePrice,
            stockQuantity: products.stockQuantity,
            isActive: products.isActive,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
            categoryId: products.categoryId, // Include categoryId
          },
          product_images: {
            imageId: productImages.imageId,
            url: productImages.url,
            altText: productImages.altText,
            displayOrder: productImages.displayOrder,
            isPrimary: productImages.isPrimary,
          },
        })
        .from(products)
        .leftJoin(
          productImages,
          eq(products.productId, productImages.productId)
        )
        .where(
          or(
            like(products.name, `%${query}%`),
            like(products.description, `%${query}%`)
          )
        )
        .execute();
    } else if (category) {
      // Fetch products by category and include images
      productsList = await db
        .select({
          products: {
            productId: products.productId,
            name: products.name,
            description: products.description,
            basePrice: products.basePrice,
            stockQuantity: products.stockQuantity,
            isActive: products.isActive,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
            categoryId: products.categoryId, // Include categoryId
          },
          product_images: {
            imageId: productImages.imageId,
            url: productImages.url,
            altText: productImages.altText,
            displayOrder: productImages.displayOrder,
            isPrimary: productImages.isPrimary,
          },
        })
        .from(products)
        .leftJoin(
          productImages,
          eq(products.productId, productImages.productId)
        )
        .leftJoin(categories, eq(products.categoryId, categories.categoryId))
        .where(eq(categories.name, category)) // Filter by category name
        .execute();
    } else {
      // Fetch the latest 20 products and include images
      productsList = await db
        .select({
          products: {
            productId: products.productId,
            name: products.name,
            description: products.description,
            basePrice: products.basePrice,
            stockQuantity: products.stockQuantity,
            isActive: products.isActive,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
            categoryId: products.categoryId, // Include categoryId
          },
          product_images: {
            imageId: productImages.imageId,
            url: productImages.url,
            altText: productImages.altText,
            displayOrder: productImages.displayOrder,
            isPrimary: productImages.isPrimary,
          },
        })
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
        categoryId,
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
      if (!acc[productId as never]) {
        // @ts-ignore
        acc[productId] = {
          productId,
          categoryId,
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
        // @ts-ignore
        if (!acc[productId].images) {
          // @ts-ignore
          acc[productId].images = [];
        }
        // @ts-ignore
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
    const id = req.params.id;

    const productsList = await db
      .select({
        products: {
          productId: products.productId,
          name: products.name,
          description: products.description,
          basePrice: products.basePrice,
          stockQuantity: products.stockQuantity,
          isActive: products.isActive,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        },
        product_images: {
          imageId: productImages.imageId,
          url: productImages.url,
          altText: productImages.altText,
          displayOrder: productImages.displayOrder,
          isPrimary: productImages.isPrimary,
        },
        product_attributes: {
          attributeId: productAttributes.attributeId,
          attributeName: productAttributes.key,
          attributeValue: productAttributes.value,
        },
        product_reviews: {
          reviewId: productReviews.reviewId,
          rating: productReviews.rating,
          comment: productReviews.comment,
          createdAt: productReviews.createdAt,
        },
      })
      .from(products)
      .leftJoin(productImages, eq(products.productId, productImages.productId))
      .leftJoin(
        productAttributes,
        eq(products.productId, productAttributes.productId)
      )
      .leftJoin(
        productReviews,
        eq(products.productId, productReviews.productId)
      ) // Added join for reviews
      .where(eq(products.productId, parseInt(id)))
      .orderBy(desc(products.createdAt))
      .execute();

    // Group products with their images, attributes, and reviews
    const groupedProducts = productsList.reduce((acc, item) => {
      const { products, product_images, product_attributes, product_reviews } =
        item;
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
      const { attributeId, attributeName, attributeValue } =
        product_attributes || {};
      const {
        reviewId,
        rating,
        comment,
        createdAt: reviewCreatedAt,
      } = product_reviews || {};

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
          attributes: [],
          reviews: [], // Added reviews array
        };
      }
      if (imageId) {
        acc[productId].images.push({
          imageId,
          url,
          altText,
          displayOrder,
          isPrimary,
        });
      }
      if (attributeId) {
        acc[productId].attributes.push({
          attributeId,
          attributeName,
          attributeValue,
        });
      }
      if (reviewId) {
        acc[productId].reviews.push({
          reviewId,
          rating,
          comment,
          createdAt: reviewCreatedAt,
        });
      }
      return acc;
    }, {} as Record<number, any>);

    const result = Object.values(groupedProducts);
    return res.status(200).json({
      data: result,
    }) as any;
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
