import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number,
    username: string,
  };
}

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: number,
    username: string,
  };
}


export const authenticateToken = async(req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']; //Bearer TOKEN
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.status(401).json({error:"Sign in first."});
  // console.log(token, process.env.JWT_SECRET, jwt.verify(token, (process.env.JWT_SECRET || "")));
  jwt.verify(token, (process.env.JWT_SECRET || ""), (error: any, user: any) => {
    if (error) return res.status(403).json({error : `${error.message}, sign in first.`});
    req.user = user;
    next();
  });
};

export const authorizeTokenSocket = (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
  const authHeader = socket.handshake.headers['authorization']; //Bearer TOKEN
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    console.log("Bad request!");
    next(new Error("Not authorized"));
    return;
  }
  jwt.verify(token, (process.env.JWT_SECRET || ""), (error: any, user: any) => {
    if (error) {
      console.log("Bad request!", error);
      next(new Error("Not authorized"));
    }
    socket.user = user;
    next();
  });
};
