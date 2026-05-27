import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || ";lkewrkwepr654erwer"
export const COOKIE_NAME = 'auth_token'

export const generateToken = (payload: object, expriresIn: string) => {
    return jwt.sign(payload, SECRET_KEY, {expiresIn: expriresIn || '1h'})
}

export const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, SECRET_KEY)
    } catch (error) {
        return null
    }
}

export const cookieOptions: any = {
    httpOnly: true,
    maxAge: 60 * 60 * 1000,
    secure: true,
    sameSite: "strict"
}