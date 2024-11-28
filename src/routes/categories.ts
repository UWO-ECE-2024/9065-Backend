import { Router } from "express";
import { db } from "../db";
import { categories, products } from "../db/schema";
import { eq } from "drizzle-orm";
import { generator } from "../libs/id_generator";

const categoryRoutes = Router();

/**
 * @swagger
 * /category/list:
 *   get:
 *     summary: Retrieve a list of all categories.
 *     description: Fetch all categories from the database.
 *     tags:
 *       - Category
 *     responses:
 *       '200':
 *         description: A list of categories
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
 *                       categoryId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       parentCategoryId:
 *                         type: string
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
categoryRoutes.get("/list", async (req, res) => {
  try {
    const allCategories = await db.select().from(categories).execute();
    res.status(200).json({
      data: allCategories,
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
 * /category/{name}/products:
 *   get:
 *     summary: Get products by category name.
 *     description: Retrieve all products associated with a specific category name.
 *     tags:
 *       - Category
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the category to retrieve products for.
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
 *                       sku:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *       '404':
 *         description: Category not found or no products found for this category
 *       '500':
 *         description: Internal server error
 */

categoryRoutes.get("/:name/products", async (req: any, res: any) => {
  try {
    const categoryName = req.params.name;
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.name, categoryName))
      .execute();

    if (category.length === 0) {
      return res.status(404).json({
        error: {
          issues: [
            {
              code: "not_found",
              message: "Category not found",
            },
          ],
        },
      });
    }

    const productsList = await db
      .select()
      .from(products)
      .where(eq(products.categoryId, category[0].categoryId))
      .execute();

    // if (productsList.length === 0) {
    //   return res.status(404).json({
    //     error: {
    //       issues: [
    //         {
    //           code: "not_found",
    //           message: "No products found for this category",
    //         },
    //       ],
    //     },
    //   });
    // }

    res.status(200).json({
      data: productsList,
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
 * /category/create:
 *   post:
 *     summary: Add a new category.
 *     description: Create a new category entry in the database with a unique identifier.
 *     tags:
 *       - Category
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The title of the category.
 *                 example: Home Appliances
 *               description:
 *                 type: string
 *                 description: A short summary of the category.
 *                 example: Appliances for home use
 *     responses:
 *       '201':
 *         description: Category successfully added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     categoryId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     parentCategoryId:
 *                       type: string
 *       '400':
 *         description: Bad request, category name is required
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
categoryRoutes.post("/create", async (req: any, res: any) => {
  try {
    const { name, description, parentCategoryId } = req.body;

    if (!name) {
      return res.status(400).json({
        error: {
          issues: [
            {
              code: "bad_request",
              message: "Category name is required",
            },
          ],
        },
      });
    }

    // Check if parentCategoryId is provided and valid
    if (parentCategoryId) {
      const parentCategory = await db
        .select()
        .from(categories)
        .where(eq(categories.categoryId, parentCategoryId))
        .execute();

      if (parentCategory.length === 0) {
        return res.status(400).json({
          error: {
            issues: [
              {
                code: "bad_request",
                message: "Invalid parent category ID",
              },
            ],
          },
        });
      }
    }

    const newCategory = await db
      .insert(categories)
      .values({
        categoryId: Number(generator.nextId()),
        name,
        description,
        parentCategoryId: parentCategoryId || null, // Allow null if not provided
      })
      .returning()
      .execute();

    res.status(201).json({
      message: "Category created successfully",
      data: newCategory,
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
 * /category/update:
 *   put:
 *     summary: Update an existing category.
 *     description: Modify the details of an existing category in the database.
 *     tags:
 *       - Category
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The unique identifier of the category to update.
 *                 example: "12345"
 *               name:
 *                 type: string
 *                 description: The new name of the category.
 *                 example: "Updated Category Name"
 *               description:
 *                 type: string
 *                 description: The new description of the category.
 *                 example: "Updated description for the category."
 *               parentCategoryId:
 *                 type: string
 *                 description: The ID of the parent category, if applicable.
 *                 example: "67890"
 *               isActive:
 *                 type: boolean
 *                 description: The active status of the category.
 *                 example: true
 *     responses:
 *       '200':
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     categoryId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     parentCategoryId:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       '400':
 *         description: Bad request, category ID is required or invalid parent category ID
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
 *         description: Category not found
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
categoryRoutes.put("/update", async (req: any, res: any) => {
  try {
    const { id, name, description, parentCategoryId, isActive } = req.body;

    if (!id) {
      return res.status(400).json({
        error: {
          issues: [
            {
              code: "bad_request",
              message: "Category ID is required",
            },
          ],
        },
      });
    }

    // Check if category exists
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, id))
      .execute();

    if (category.length === 0) {
      return res.status(404).json({
        error: {
          issues: [
            {
              code: "not_found",
              message: "Category not found",
            },
          ],
        },
      });
    }

    // Validate parent category if provided
    if (parentCategoryId) {
      const parentCategory = await db
        .select()
        .from(categories)
        .where(eq(categories.categoryId, parentCategoryId))
        .execute();

      if (parentCategory.length === 0) {
        return res.status(400).json({
          error: {
            issues: [
              {
                code: "bad_request",
                message: "Invalid parent category ID",
              },
            ],
          },
        });
      }
    }

    // Update category
    const updatedCategory = await db
      .update(categories)
      .set({
        name: name || category[0].name,
        description: description || category[0].description,
        parentCategoryId: parentCategoryId || category[0].parentCategoryId,
        isActive: isActive !== undefined ? isActive : category[0].isActive,
      })
      .where(eq(categories.categoryId, id))
      .returning()
      .execute();

    if (Array.isArray(updatedCategory) && updatedCategory.length > 0) {
      res.status(200).json({
        message: "Category updated successfully",
        data: updatedCategory[0],
      });
    } else {
      res.status(500).json({
        error: {
          issues: [
            {
              code: "update_failed",
              message: "Failed to update category",
            },
          ],
        },
      });
    }
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
 * /category/delete:
 *   delete:
 *     summary: Delete a category.
 *     description: Remove a category from the database using its unique identifier.
 *     tags:
 *       - Category
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The unique identifier of the category to delete.
 *                 example: "12345"
 *     responses:
 *       '200':
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       '404':
 *         description: Category not found
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
categoryRoutes.delete("/delete", async (req: any, res: any) => {
  try {
    const { id: categoryId } = req.body;

    // Check if the category exists
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, categoryId))
      .execute();

    if (category.length === 0) {
      return res.status(404).json({
        error: {
          issues: [
            {
              code: "not_found",
              message: "Category not found",
            },
          ],
        },
      });
    }

    // Delete the category
    await db
      .delete(categories)
      .where(eq(categories.categoryId, categoryId))
      .execute();

    res.status(200).json({
      message: "Category deleted successfully",
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

export default categoryRoutes;
