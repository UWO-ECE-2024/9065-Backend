import { Router } from "express";
import { db } from "../db";
import { users, userAddresses } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { z } from "zod";
import { generator } from "../libs/id_generator";

const profileRoutes = Router();
const MAX_ADDRESSES_PER_USER = 3;

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

// Get user profile
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

// Update user profile
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

// Get all addresses
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

// Get default address
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

// Add new address
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

// Update address
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

// Delete address
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

export default profileRoutes;
