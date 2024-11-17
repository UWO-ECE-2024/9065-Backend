import { Router } from "express";
import { db } from "../db";
import {  products,categories } from "../db/schema";
import {eq, Placeholder} from "drizzle-orm";
import {generator} from "../libs/id_generator";
import {undefined} from "zod";
import {bigint} from "drizzle-orm/pg-core";

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
    const {category_id,name} = req.body;
    if (!category_id || !name) {
        return res.status(404).json({"error":"no category id found or no name"});
    }
    try {
        const category =  {
            categoryId:category_id,
            name: name,
        }
        const newCategory = await db.insert(categories).values(category).execute();

        res.status(201).send({
            message: "category added successfully",
            productId: category.categoryId
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


export default stocksRoutes;