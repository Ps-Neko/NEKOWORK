import dotenv from "dotenv";
import { Environment } from "./src/interfaces";
dotenv.config({
    path: `.env.${process.env.NODE_ENV}`,
});

console.log("Running on " + process.env.NODE_ENV + " mode");

export const config: Environment = {
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || "8080",
    mongo: {
        user: process.env.MONGO_DB_USER || "",
        password: process.env.MONGO_DB_PASS || "",
        host: process.env.MONGO_DB_HOST || "",
        name: process.env.MONGO_DB_NAME || "",
    },
    email: {
        host: process.env.EMAIL_HOST || "",
        port: process.env.EMAIL_PORT || "",
        user: process.env.EMAIL_USER || "",
        password: process.env.EMAIL_PASS || "",
    },
    jwt: {
        secret: process.env.JWT_SECRET || "",
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    },
};
