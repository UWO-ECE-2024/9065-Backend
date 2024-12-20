import { Router } from "express";
import { db } from "../db";
import { users, userAddresses } from "../db/schema";
import { and, eq, not } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import { generator } from "../libs/id_generator";
import { paymentMethods } from "../db/schema";

/**
 * @swagger
 * components:
 *   schemas:
 *     Address:
 *       type: object
 *       properties:
 *         streetAddress:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *         postalCode:
 *           type: string
 *         country:
 *           type: string
 *         isDefault:
 *           type: boolean
 *     PaymentMethod:
 *       type: object
 *       properties:
 *         cardType:
 *           type: string
 *         lastFour:
 *           type: string
 *         holderName:
 *           type: string
 *         expiryDate:
 *           type: string
 *         isDefault:
 *           type: boolean
 */

const profileRoutes = Router();
const MAX_ADDRESSES_PER_USER = 3;
const MAX_PAYMENT_METHODS_PER_USER = 3;

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

const addressSchema = z.object({
  streetAddress: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  isDefault: z.boolean().optional(),
});

const paymentMethodSchema = z.object({
  cardType: z.string().min(1),
  lastFour: z.string().regex(/^\d{16}$/), // 16-digit card number
  holderName: z.string().min(1),
  expiryDate: z.string().regex(/^\d{2}\/\d{2}$/), // MM/YY format
  isDefault: z.boolean().optional(),
});

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Get user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
profileRoutes.get("/", authMiddleware as any, async (req: any, res: any) => {
  try {
    const user = await db
      .select({
        userId: users.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.userId, req.user.userId))
      .execute();

    if (user.length === 0) {
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

    res.json({
      message: "Profile retrieved successfully",
      data: user[0],
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
 * /profile:
 *   put:
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
profileRoutes.put("/", authMiddleware as any, async (req: any, res: any) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          issues: validation.error.issues.map((issue) => ({
            code: "validation_error",
            message: issue.message,
          })),
        },
      });
    }

    const { firstName, lastName, phone } = validation.data;

    const updatedUser = await db
      .update(users)
      .set({
        firstName,
        lastName,
        phone,
        updatedAt: new Date(),
      })
      .where(eq(users.userId, req.user.userId))
      .returning({
        userId: users.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
      })
      .execute();

    res.json({
      message: "Profile updated successfully",
      data: updatedUser[0],
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
 * /profile/addresses:
 *   get:
 *     summary: Get all addresses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Add new address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       201:
 *         description: Address added successfully
 *       400:
 *         description: Validation error or max addresses reached
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
profileRoutes.get(
  "/addresses",
  authMiddleware as any,
  async (req: any, res: any) => {
    try {
      const addresses = await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.userId, req.user.userId))
        .execute();

      res.json({
        message: "Addresses retrieved successfully",
        data: addresses,
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
  }
);

/**
 * @swagger
 * /profile/addresses/default:
 *   get:
 *     summary: Get default address
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default address retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
profileRoutes.get(
  "/addresses/default",
  authMiddleware as any,
  async (req: any, res: any) => {
    try {
      const defaultAddress = await db
        .select()
        .from(userAddresses)
        .where(
          and(
            eq(userAddresses.userId, req.user.userId),
            eq(userAddresses.isDefault, true)
          )
        )
        .execute();

      res.json({
        message: "Default address retrieved successfully",
        data: defaultAddress[0] || null,
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
  }
);

/**
 * @swagger
 * /profile/addresses:
 *   post:
 *     summary: Add a new address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       201:
 *         description: Address added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Address'
 *       400:
 *         description: Validation error or maximum addresses reached
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
profileRoutes.post(
  "/addresses",
  authMiddleware as any,
  async (req: any, res: any) => {
    try {
      // Check address limit
      const existingAddresses = await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.userId, req.user.userId))
        .execute();

      if (existingAddresses.length >= MAX_ADDRESSES_PER_USER) {
        return res.status(400).json({
          error: {
            issues: [
              {
                code: "max_addresses_reached",
                message: `You can only have up to ${MAX_ADDRESSES_PER_USER} addresses`,
              },
            ],
          },
        });
      }

      const validation = addressSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: {
            issues: validation.error.issues.map((issue) => ({
              code: "validation_error",
              message: issue.message,
            })),
          },
        });
      }

      const { streetAddress, city, state, postalCode, country, isDefault } =
        validation.data;

      // If this is the first address or isDefault is true, handle default address logic
      if (isDefault || existingAddresses.length === 0) {
        await db
          .update(userAddresses)
          .set({ isDefault: false })
          .where(eq(userAddresses.userId, req.user.userId))
          .execute();
      }

      const newAddress = await db
        .insert(userAddresses)
        .values({
          addressId: Number(generator.nextId()),
          userId: req.user.userId,
          streetAddress,
          city,
          state,
          postalCode,
          country,
          isDefault: isDefault ?? existingAddresses.length === 0,
        })
        .returning()
        .execute();

      res.status(201).json({
        message: "Address added successfully",
        data: newAddress[0],
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
  }
);

/**
 * @swagger
 * /profile/addresses/{addressId}:
 *   put:
 *     summary: Update an existing address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the address to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Address updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Address'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Address not found
 *       500:
 *         description: Internal server error
 */
profileRoutes.put(
  "/addresses/:addressId",
  authMiddleware as any,
  async (req: any, res: any) => {
    try {
      const addressId = Number(req.params.addressId);
      const validation = addressSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: {
            issues: validation.error.issues.map((issue) => ({
              code: "validation_error",
              message: issue.message,
            })),
          },
        });
      }

      const { streetAddress, city, state, postalCode, country, isDefault } =
        validation.data;

      // Check if address belongs to user
      const address = await db
        .select()
        .from(userAddresses)
        .where(
          and(
            eq(userAddresses.addressId, addressId),
            eq(userAddresses.userId, req.user.userId)
          )
        )
        .execute();

      if (address.length === 0) {
        return res.status(404).json({
          error: {
            issues: [
              {
                code: "not_found",
                message: "Address not found",
              },
            ],
          },
        });
      }

      // If setting as default, unset other default addresses
      if (isDefault) {
        await db
          .update(userAddresses)
          .set({ isDefault: false })
          .where(eq(userAddresses.userId, req.user.userId))
          .execute();
      }

      const updatedAddress = await db
        .update(userAddresses)
        .set({
          streetAddress,
          city,
          state,
          postalCode,
          country,
          isDefault: isDefault ?? false,
        })
        .where(eq(userAddresses.addressId, addressId))
        .returning()
        .execute();

      res.json({
        message: "Address updated successfully",
        data: updatedAddress[0],
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
  }
);

/**
 * @swagger
 * /profile/addresses/{addressId}:
 *   delete:
 *     summary: Delete an address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the address to delete
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Address not found
 *       500:
 *         description: Internal server error
 */
profileRoutes.delete(
  "/addresses/:addressId",
  authMiddleware as any,
  async (req: any, res: any) => {
    try {
      const addressId = Number(req.params.addressId);

      // Check if address belongs to user
      const address = await db
        .select()
        .from(userAddresses)
        .where(
          and(
            eq(userAddresses.addressId, addressId),
            eq(userAddresses.userId, req.user.userId)
          )
        )
        .execute();

      if (address.length === 0) {
        return res.status(404).json({
          error: {
            issues: [
              {
                code: "not_found",
                message: "Address not found",
              },
            ],
          },
        });
      }

      await db
        .delete(userAddresses)
        .where(eq(userAddresses.addressId, addressId))
        .execute();

      res.json({
        message: "Address deleted successfully",
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
  }
);

/**
 * @swagger
 * /profile/payment-methods:
 *   get:
 *     summary: Get all payment methods
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment methods retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PaymentMethod'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
profileRoutes.get("/payment-methods", authMiddleware as any, async (req: any, res: any) => {
  try {
    const methods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, req.user.userId))
      .execute();

    res.json({
      message: "Payment methods retrieved successfully",
      data: methods,
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
 * /profile/payment-methods:
 *   post:
 *     summary: Add a new payment method
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentMethod'
 *     responses:
 *       201:
 *         description: Payment method added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/PaymentMethod'
 *       400:
 *         description: Validation error or maximum payment methods reached
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
profileRoutes.post("/payment-methods", authMiddleware as any, async (req: any, res: any) => {
  try {
    // Check payment method limit
    const existingMethods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, req.user.userId))
      .execute();

    if (existingMethods.length >= MAX_PAYMENT_METHODS_PER_USER) {
      return res.status(400).json({
        error: {
          issues: [
            {
              code: "max_payment_methods_reached",
              message: `You can only have up to ${MAX_PAYMENT_METHODS_PER_USER} payment methods`,
            },
          ],
        },
      });
    }

    const validation = paymentMethodSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          issues: validation.error.issues.map((issue) => ({
            code: "validation_error",
            message: issue.message,
          })),
        },
      });
    }

    const { cardType, lastFour, holderName, expiryDate, isDefault } = validation.data;

    // If this is the first payment method or isDefault is true, handle default logic
    if (isDefault || existingMethods.length === 0) {
      await db
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.userId, req.user.userId))
        .execute();
    }

    const newPaymentMethod = await db
      .insert(paymentMethods)
      .values({
        paymentId: Number(generator.nextId()),
        userId: req.user.userId,
        cardType,
        lastFour,
        holderName,
        expiryDate,
        isDefault: isDefault ?? existingMethods.length === 0,
      })
      .returning()
      .execute();

    res.status(201).json({
      message: "Payment method added successfully",
      data: newPaymentMethod[0],
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
 * /profile/payment-methods/{paymentId}:
 *   delete:
 *     summary: Delete a payment method
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the payment method to delete
 *     responses:
 *       200:
 *         description: Payment method deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment method not found
 *       500:
 *         description: Internal server error
 */
profileRoutes.delete("/payment-methods/:paymentId", authMiddleware as any, async (req: any, res: any) => {
  try {
    const paymentId = Number(req.params.paymentId);

    // Check if payment method belongs to user
    const method = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.paymentId, paymentId),
          eq(paymentMethods.userId, req.user.userId)
        )
      )
      .execute();

    if (method.length === 0) {
      return res.status(404).json({
        error: {
          issues: [
            {
              code: "not_found",
              message: "Payment method not found",
            },
          ],
        },
      });
    }

    // If we're deleting the default payment method, set another one as default
    if (method[0].isDefault) {
      // Get other payment methods
      const otherMethods = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.userId, req.user.userId),
            not(eq(paymentMethods.paymentId, paymentId))
          )
        )
        .execute();

      // If there are other payment methods, set the first one as default
      if (otherMethods.length > 0) {
        await db
          .update(paymentMethods)
          .set({ isDefault: true })
          .where(eq(paymentMethods.paymentId, otherMethods[0].paymentId))
          .execute();
      }
    }

    // Delete the payment method
    await db
      .delete(paymentMethods)
      .where(eq(paymentMethods.paymentId, paymentId))
      .execute();

    res.json({
      message: "Payment method deleted successfully",
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
 * /profile/payment-methods/default:
 *   get:
 *     summary: Get default payment method
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default payment method retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/PaymentMethod'
 *                     - type: null
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
profileRoutes.get(
  "/payment-methods/default",
  authMiddleware as any,
  async (req: any, res: any) => {
    try {
      const defaultMethod = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.userId, req.user.userId),
            eq(paymentMethods.isDefault, true)
          )
        )
        .execute();

      res.json({
        message: "Default payment method retrieved successfully",
        data: defaultMethod[0] || null,
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
  }
);

export default profileRoutes;
