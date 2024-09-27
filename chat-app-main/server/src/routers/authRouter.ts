import express from 'express';
import { pool } from '../db';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { jwtTokens } from '../helpers/jwt';

const router = express.Router();

// LOGIN
router.post("/login", async (req, res) => {
  const potentialLogin = await pool.query(
    "SELECT id, username, password_hash FROM users u WHERE u.username=$1",
    [req.body.username]
  );

  if ((potentialLogin.rowCount || 0) > 0) {
    const isOk = await bcrypt.compare(req.body.password, potentialLogin.rows[0].password_hash);
    
    if (isOk) {
      // update last login
      const updateQuery = await pool.query(
        "UPDATE users SET last_login=$1 WHERE username=$2",
        [new Date().toISOString(), req.body.username]
      );
      // login
      req.session.user = {
        username: potentialLogin.rows[0].username,
        id: potentialLogin.rows[0].id,
      };
      // JWT
      let tokens = jwtTokens(potentialLogin.rows[0].id, potentialLogin.rows[0].username);    //Gets access and refresh tokens
      res.cookie('refresh_token', tokens.refreshToken, {...(process.env.COOKIE_DOMAIN && {domain: process.env.COOKIE_DOMAIN}) , httpOnly: true,sameSite: 'none', secure: true});

      res.json({
        loggedIn: true,
        username: potentialLogin.rows[0].username,
        tokens: tokens,
        id: potentialLogin.rows[0].id
      });
    } else {
      // not 
      res.status(403).json({
        loggedIn: false,
        status: "Wrong username or password."
      });
    }
  } else {
    res.status(403).json({
      loggedIn: false,
      status: "Wrong username or password."
    });
  }
});


// SIGNUP
router.post("/signup", async (req, res) => {
  const existingUser = await pool.query(
    "SELECT username from users WHERE username=$1",
    [req.body.username]
  );

  if (existingUser.rowCount === 0) {
    // register
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newUserQuery = await pool.query(
      "INSERT INTO users(username, password_hash, last_login, is_online) VALUES ($1, $2, $3, $4) RETURNING id, username",
      [req.body.username, hashedPassword, new Date().toISOString(), false]
    );
    req.session.user = {
      username: newUserQuery.rows[0].username,
      id: newUserQuery.rows[0].id,
    };
    // JWT
    let tokens = jwtTokens(newUserQuery.rows[0].id, newUserQuery.rows[0].username);    //Gets access and refresh tokens
    res.cookie('refresh_token', tokens.refreshToken, {...(process.env.COOKIE_DOMAIN && {domain: process.env.COOKIE_DOMAIN}) , httpOnly: true,sameSite: 'none', secure: true});
          
    res.json({
      loggedIn: true,
      username: newUserQuery.rows[0].username,
      tokens: tokens,
      id: newUserQuery.rows[0].id,
    });
  } else {
    res.json({
      loggedIn: false,
      status: "Username taken"
    });
  }
});

// TOKENS
router.get('/refresh_token', (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (refreshToken === null) return res.sendStatus(401);
    jwt.verify(refreshToken, (process.env.REFRESH_TOKEN_SECRET || ""), (error: any, user: any) => {
      if (error) return res.status(403).json({error:error.message});
      let tokens = jwtTokens(user.id, user.username);
      res.cookie('refresh_token', tokens.refreshToken);
      return res.json(tokens);
    });
  } catch (err) {
    const error = err as any;
    res.status(401).json({error: error.message});
  }
});

router.delete('/refresh_token', (req, res) => {
  try {
    res.clearCookie('refresh_token');
    return res.status(200).json({message:'Refresh token deleted.'});
  } catch (err) {
    const error = err as any;
    res.status(401).json({error: error.message});
  }
});

export default router;