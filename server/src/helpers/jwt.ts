import jwt from 'jsonwebtoken';

export const jwtTokens = (id: number, username: string) => {
  const user = { id, username}; 
  const accessToken = jwt.sign(user, (process.env.JWT_SECRET || ""), { expiresIn: "15m" });
  const refreshToken = jwt.sign(user, (process.env.REFRESH_TOKEN_SECRET || ""), { expiresIn: "14d" });
  return ({ accessToken, refreshToken });
};