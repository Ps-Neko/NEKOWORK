// pattern: process.env.X ? process.env.X : "literal"

export function getDbPassword(): string {
  return process.env.DB_PASSWORD ? process.env.DB_PASSWORD : "default-pass";
}
