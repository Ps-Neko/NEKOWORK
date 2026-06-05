import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { oidcProvider } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";

const mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017/oauth-do";
const client = new MongoClient(mongoUrl);
const db = client.db();

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24.acacia",
});

export const auth = betterAuth({
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  database: mongodbAdapter(db),
  plugins: [
    nextCookies(), // Add nextCookies plugin for automatic cookie handling
    oidcProvider({
      loginPage: "/sign-in", // Path to the login page
      consentPage: "/consent", // Path to the consent page
      allowDynamicClientRegistration: true,
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
      createCustomerOnSignUp: true, // Automatically create Stripe customers when users sign up
    }),
  ],
});
