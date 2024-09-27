import express from 'express';
import { pool } from '../db';
import bcrypt from "bcrypt";
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';

/**
 * TODO:
 * - SEND
 * - DELETE
 * - EDIT
 * - GET
 * 
 * END2END ENCRYPTED??
 */

const router = express.Router();

// GET MESSAGES BY ROOM ID
router.get('/:roomId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(500).json({ message: "Missing user" });
    return;
  }

  const roomId = Number(req.params.roomId);

  try {
    // Fetch room data along with members and user details in a single query
    const messagesQuery = await pool.query(
      `SELECT * FROM messages m WHERE m.room_id=$1`,
      [roomId]
    );

    res.json({
      messages: messagesQuery.rows
    });
  } catch (error) {
    console.error('Error fetching room data:', error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


export default router;