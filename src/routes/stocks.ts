import { Router } from "express";
import { db } from "../db";
import {  products,categories } from "../db/schema";
import {eq, Placeholder} from "drizzle-orm";
import {generator} from "../libs/id_generator";
import {undefined} from "zod";
import {bigint, timestamp} from "drizzle-orm/pg-core";

// product_id     | bigint                   |           | not null |
// category_id    | bigint                   |           | not null |
// name           | character varying(255)   |           | not null |
// description    | text                     |           |          |
// base_price     | numeric(10,2)            |           | not null |
// stock_quantity | integer                  |           | not null | 0
// sku            | character varying(50)    |           | not null |

const stocksRoutes = Router();
// @ts-ignore

// Table "public.categories"
// Column       |          Type          | Collation | Nullable | Default
// --------------------+------------------------+-----------+----------+---------
//     category_id        | bigint                 |           | not null |
// name               | character varying(100) |           | not null |
// description        | text                   |           |          |
// parent_category_id | bigint                 |           |          |
// is_active          | boolean                |           |          | true


stocksRoutes.post("/addCategory", async (req, res) => {
    const {category_id,name,description,parent_category_id} = req.body;
    if (!category_id || !name) {
        return res.status(404).json({"error":"no category id found or no name"});
    }
    try {
        const category =  {
            categoryId:category_id,
            name: name,
            description: description,
            parentCategoryId:parent_category_id
        }
        const newCategory = await db.insert(categories).values(category).execute();

        res.status(201).send({
            message: "category added successfully",
            categoryId: category.categoryId
        });
    } catch (error) {
        console.error("Error inserting new category:", error);
        res.status(500).send({ error: "Internal server error" });
    }
});

// @ts-ignore
stocksRoutes.post("/addProduct",async (req, res) => {
    console.log(req.body);
    const { category_id ,name, base_price, description, stock_quantity, sku, pics} = req.body;  // 从请求体中提取产品名称和价格

    if (!category_id || !name || base_price == null || stock_quantity == null) {
        return res.status(404).send({ error: "Missing required fields. Category ID, name, base price, stock quantity, and SKU are required." });
    }

    try {
        const product =  {stockQuantity: stock_quantity,
            basePrice: base_price,
            productId: Number(generator.nextId()),
            name: name,
            price: base_price,
            sku: sku,
            categoryId: category_id,
            description: description || ''}
        const newProduct = await db.insert(products).values(product).execute();
        res.status(201).send({
            message: "Product added successfully",
            productId: newProduct.oid
        });
    } catch (error) {
        console.error("Error inserting new product:", error);
        res.status(500).send({ error: "Internal server error" });
    }
})
// @ts-ignore
stocksRoutes.patch("/increaseStockById/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const currentProduct = await db.select().from(products).where(eq(products.productId, id));
        if (currentProduct.length === 0) {
            return res.status(404).send({ message: "Product not found" });
        }
        const newStockQuantity = currentProduct[0].stockQuantity + 1;
        const updated = await db.update(products)
            .set({stockQuantity: newStockQuantity})
            .where(eq(products.productId, id));
        // @ts-ignore
        if (updated === 0) {
            return res.status(404).send({ message: "Product not found" });
        }
        res.send({ message: "Stock quantity incremented successfully" });
    }
    catch (error) {
        console.error("Error inserting stock:", error);
    }
})

stocksRoutes.patch("/decreaseStockById/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const currentProduct = await db.select().from(products).where(eq(products.productId, id));
        if (currentProduct.length === 0) {
            return res.status(404).send({ message: "Product not found" });
        }
        const newStockQuantity = currentProduct[0].stockQuantity - 1;
        if (newStockQuantity < 0) {
            return res.status(200).send({ message: "already zero" });
        }
        const updated = await db.update(products)
            .set({stockQuantity: newStockQuantity})
            .where(eq(products.productId, id));
        // @ts-ignore
        if (updated === 0) {
            return res.status(404).send({ message: "Product not found" });
        }
        res.send({ message: "Stock quantity decremented successfully" });
    }
    catch (error) {
        console.error("Error inserting stock:", error);
    }
})


export default stocksRoutes;