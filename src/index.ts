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
import authRoutes from "./routes/auth";
import adminAuthRoutes from "./routes/adminAuth";
import profileRoutes from "./routes/profile";
import bodyParser from "body-parser";
import path from "path";
import { url } from "inspector";
import { Resend } from "resend";

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
      {
        url: `http://34.192.104.182:${process.env.SERVER_PORT}/v1`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/routes/*.js"],
};

const app: Express = express();
export const resend = new Resend(process.env.EMAIL_KEY);
const swaggerDocs = swaggerjsdoc(swaggerOptions);
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/upload", express.static(path.join(__dirname, "upload")));

app.use(
  cors({
    origin: "*", // or whatever port your frontend is running on
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"], // Add Authorization to allowed headers
    credentials: true,
  })
);
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use("/v1/auth", authRoutes);
app.use("/v1/admin-auth", adminAuthRoutes);
app.use("/v1/products", productsRoutes);
app.use("/v1/category", categoryRoutes);
app.use("/v1/stocks", stocksRoutes);
app.use("/v1/cart", cartRoutes);
app.use("/v1/profile", profileRoutes);

const port = Number.parseInt(process.env.SERVER_PORT as string) || 4405;

app.listen(port, () => {
  console.log(`Server is running on port~~${port}`);
});
