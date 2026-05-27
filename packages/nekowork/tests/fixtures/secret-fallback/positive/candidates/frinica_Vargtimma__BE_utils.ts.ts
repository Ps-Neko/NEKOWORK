import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";

export interface JWTUserData {
  userID: ObjectId;
  email: string;
}

const jwtSecret = process.env.JWT_SECRET || "";
export interface IJWT {
  userID: ObjectId;
  alias: string;
  phone: string;
  email: string;
  role: number;
}

// Hash password to save in DB
export function hashPassword(password: string) {
  const hash = bcrypt.hashSync(password, 8);

  return hash;
}

// Compare hashed password with password req
export function comparePassword(password: string, hash: string) {
  const correct = bcrypt.compareSync(password, hash);

  return correct;
}

// JWT
export function getJWT(
  userID: ObjectId,
  alias: string,
  phone: string,
  email: string,
  role: number
) {
  const userData: IJWT = { userID, alias, phone, email, role };
  const token = jwt.sign(userData, jwtSecret);

  return token;
}

export function verifyDecodeJWT(token: string) {
  try {
    const userData = jwt.verify(token, jwtSecret) as JWTUserData;
    return userData;
  } catch {
    return false;
  }
}
