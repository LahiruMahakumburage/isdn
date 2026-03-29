import bcrypt from 'bcryptjs';
export const hash    = (plain: string) => bcrypt.hash(plain, 10);
export const compare = (plain: string, hashed: string) => bcrypt.compare(plain, hashed);
