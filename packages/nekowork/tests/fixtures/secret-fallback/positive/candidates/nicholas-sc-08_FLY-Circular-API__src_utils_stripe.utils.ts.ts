// utils/stripe.utils.ts
import Stripe from "stripe";
import { configDotenv } from "dotenv";

configDotenv();

const stripeSecretKey: string = process.env.STRIPE_SECRET_KEY || "";

if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY não está definido na env");
};

export const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-11-17.clover', typescript: true });