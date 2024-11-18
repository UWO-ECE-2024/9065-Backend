import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import swaggerjsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import productsRoutes from "./routes/products";
import categoryRoutes from "./routes/categories";
import cartRoutes from "./routes/carts";
import stocksRoutes from "./routes/stocks";
import bodyParser from "body-parser";
import path from "path";

dotenv.config();

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Ecommerce API",
      description: "Ecommerce API Information",
      version: "1.0.0",
      contact: {
        name: "Si Luo",
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.SERVER_PORT}/v1`,
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/routes/*.js"],
};

const app: Express = express();
const swaggerDocs = swaggerjsdoc(swaggerOptions);
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/upload', express.static(path.join(__dirname, 'upload')));

app.use(
  cors({
    origin: "*", // change it in production base on your request origin domain
    methods: ["GET", "POST", "PUT", "DELETE","PATCH"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json())

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use("/v1/products", productsRoutes);
app.use("/v1/category", categoryRoutes);
app.use("/v1/stocks",stocksRoutes);
app.use("/v1/cart", cartRoutes);

const port = Number.parseInt(process.env.SERVER_PORT as string) || 4405;

app.listen(port, () => {
  console.log(`Server is running on port~~${port}`);
});
