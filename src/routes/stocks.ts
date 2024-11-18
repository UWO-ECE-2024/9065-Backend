import { Router } from "express";
import { db } from "../db";
import {products, categories, productImages} from "../db/schema";
import { eq } from "drizzle-orm";
import { generator } from "../libs/id_generator";
import { bigint, timestamp } from "drizzle-orm/pg-core";
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import swaggerJSDoc from "swagger-jsdoc";


const stocksRoutes = Router();

// 配置 multer 存储选项
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 将文件保存到项目根目录的 'upload' 文件夹中
        cb(null, path.join(__dirname, '../upload'));
    },
    filename: function (req, file, cb) {
        // 使用时间戳和随机数生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// 创建 multer 实例
const upload = multer({ storage: storage });

// 添加 '/addCategory' 路由
/*
@swagger
 */

/**
 * @swagger
 * /stocks/addCategory:
 *   post:
 *     summary: Adds a new category
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - name
 *             properties:
 *               category_id:
 *                 type: string
 *                 description: The unique identifier for the category
 *               name:
 *                 type: string
 *                 description: The name of the category
 *               description:
 *                 type: string
 *                 description: A brief description of the category
 *               parent_category_id:
 *                 type: string
 *                 description: The identifier for the parent category
 *     responses:
 *       201:
 *         description: Category added successfully
 *       404:
 *         description: Required fields are missing
 *       500:
 *         description: Internal server error
 */

stocksRoutes.post("/addCategory", async (req, res) => {
    // 原有代码保持不变
    const { category_id, name, description, parent_category_id } = req.body;
    if (!category_id || !name) {
        return res.status(404).json({ "error": "no category id found or no name" });
    }
    try {
        const category = {
            categoryId: category_id,
            name: name,
            description: description,
            parentCategoryId: parent_category_id
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

// 添加 '/addProduct' 路由

/**
 * @swagger
 * /stocks/addProduct:
 *   post:
 *     summary: Adds a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - name
 *               - base_price
 *               - stock_quantity
 *               - pics
 *             properties:
 *               category_id:
 *                 type: string
 *                 description: The category identifier the product belongs to
 *               name:
 *                 type: string
 *                 description: The name of the product
 *               base_price:
 *                 type: number
 *                 format: float
 *                 description: The base price of the product
 *               description:
 *                 type: string
 *                 description: A brief description of the product
 *               stock_quantity:
 *                 type: integer
 *                 description: The amount of stock available
 *               pics:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of picture URLs
 *     responses:
 *       201:
 *         description: Product added successfully
 *       404:
 *         description: Required fields are missing
 *       500:
 *         description: Internal server error
 */

stocksRoutes.post("/addProduct", async (req, res) => {
    // 原有代码保持不变
    console.log(req.body);
    const { category_id, name, base_price, description, stock_quantity, pics } = req.body;

    if (!category_id || !name || base_price == null || stock_quantity == null) {
        return res.status(404).send({ error: "Missing required fields. Category ID, name, base price, stock quantity are required." });
    }
    if (!pics || pics.length === 0) {
        return res.status(404).send({error: "missing pics"})
    }

    try {
        const product = {
            stockQuantity: stock_quantity,
            basePrice: base_price,
            productId: Number(generator.nextId()),
            name: name,
            price: base_price,
            categoryId: category_id,
            description: description || '',
            pics: pics || []
        }

        const newProduct = await db.insert(products).values(product).execute().then(async () => {
            for (let i = 0; i < pics.length; i++) {
                const pic_sql = {
                    productId: product.productId,
                    url: pics[i],
                    imageId: Number(generator.nextId()),
                    isPrimary: i == 0
                }
                await db.insert(productImages).values(pic_sql).execute();
            }
        });

        res.status(201).send({
            message: "Product added successfully",
        });

    } catch (error) {
        console.error("Error inserting new product:", error);
        res.status(500).send({ error: "Internal server error" });
    }
});


/**
 * @swagger
 * /stocks/addPics:
 *   post:
 *     summary: Uploads multiple pictures
 *     tags: [Pictures]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of image files
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *       400:
 *         description: No files were uploaded
 *       500:
 *         description: Internal server error
 */
stocksRoutes.post("/addPics", upload.array('images', 10), async (req, res) => {
    // console.log('here reached');
    try {
        // @ts-ignore
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).send({ error: 'No files were uploaded.' });
        }
        console.log("here reached");
        const filePaths = files.map(file => {
            // 返回文件相对于 'upload' 文件夹的路径
            return `/upload/${file.filename}`;
        });

        res.status(200).send({
            message: 'Files uploaded successfully.',
            filePaths: filePaths
        });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send({ error: 'Internal server error' });
    }
});
/**
 * @swagger
 * /stocks/getPicsByProductId/{id}:
 *   get:
 *     summary: Retrieves all pictures for a given product ID
 *     tags: [Pictures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Pictures retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                       mimeType:
 *                         type: string
 *                       data:
 *                         type: string
 *                         format: binary
 *                       isPrimary:
 *                         type: boolean
 *       404:
 *         description: Pics not found
 *       500:
 *         description: Internal server error
 */

stocksRoutes.get("/getPicsByProductId/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const pics = await db
            .select()
            .from(productImages)
            .where(eq(productImages.productId, id));

        if (!pics || pics.length === 0) {
            return res.status(404).send({ message: "Pics not found" });
        }

        const images = [];

        for (const pic of pics) {
            const filePath = path.join(__dirname, '..', pic.url); // 根据实际的图片路径调整
            const fileData = fs.readFileSync(filePath);
            const base64Image = fileData.toString('base64');
            const mimeType = getMimeType(filePath); // 获取文件的 MIME 类型，例如 'image/jpeg'

            images.push({
                filename: path.basename(pic.url),
                mimeType: mimeType,
                data: base64Image,
                isPrimary: pic.isPrimary
            });
        }

        res.status(200).send({
            message: "Pics retrieved successfully",
            images: images,
        });
    } catch (error) {
        console.error("Error getting pics by id:", error);
        res.status(500).send({ error: "Internal server error" });
    }
});

// 辅助函数：根据文件扩展名获取 MIME 类型
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        default:
            return 'application/octet-stream';
    }
}

// 其他路由保持不变

/**
 * @swagger
 * /stocks/increaseStockById/{id}:
 *   patch:
 *     summary: Increments the stock quantity by 1 for a specific product ID
 *     tags: [Stock Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Stock quantity incremented successfully
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */

stocksRoutes.patch("/increaseStockById/:id", async (req, res) => {
    // 原有代码
    try {
        const id = parseInt(req.params.id);
        const currentProduct = await db.select().from(products).where(eq(products.productId, id));
        if (currentProduct.length === 0) {
            return res.status(404).send({ message: "Product not found" });
        }
        const newStockQuantity = currentProduct[0].stockQuantity + 1;
        await db.update(products)
            .set({ stockQuantity: newStockQuantity })
            .where(eq(products.productId, id));

        res.send({ message: "Stock quantity incremented successfully" });
    } catch (error) {
        console.error("Error incrementing stock:", error);
        res.status(500).send({ error: "Internal server error" });
    }
});
/**
 * @swagger
 * /stocks/decreaseStockById/{id}:
 *   patch:
 *     summary: Decrements the stock quantity by 1 for a specific product ID
 *     tags: [Stock Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Stock quantity decremented successfully, or already zero
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */

stocksRoutes.patch("/decreaseStockById/:id", async (req, res) => {
    // 原有代码
    try {
        const id = parseInt(req.params.id);
        const currentProduct = await db.select().from(products).where(eq(products.productId, id));
        if (currentProduct.length === 0) {
            return res.status(404).send({ message: "Product not found" });
        }
        const newStockQuantity = currentProduct[0].stockQuantity - 1;
        if (newStockQuantity < 0) {
            return res.status(200).send({ message: "Already zero" });
        }
        await db.update(products)
            .set({ stockQuantity: newStockQuantity })
            .where(eq(products.productId, id));

        res.send({ message: "Stock quantity decremented successfully" });
    } catch (error) {
        console.error("Error decrementing stock:", error);
        res.status(500).send({ error: "Internal server error" });
    }
});

export default stocksRoutes;
