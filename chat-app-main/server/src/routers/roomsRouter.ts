import express from 'express';
import { pool } from '../db';
import bcrypt from "bcrypt";
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { sendMessageToRoomSocket } from '../sockets/messages';


const router = express.Router();

// GET ROOMS
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(500).json({message: "Missing user"});
    return;
  }

  try {
    // get all rooms where user is in (get from room members)
    const joinedRooms = await pool.query(
      "SELECT * FROM rooms r JOIN room_members m ON r.id = m.room_id WHERE m.user_id=$1;",
      [req.user.id]
    );

    // plus all rooms where he can join (public rooms where is not member)
    const availableRooms = await pool.query(
      "SELECT r.* FROM rooms r LEFT JOIN room_members m ON r.id=m.room_id AND m.user_id=$1 WHERE r.is_private=false AND m.user_id IS NULL;",
      [req.user.id]
    );
    
    // return {available, joined}
    res.json({
      joinedRooms: joinedRooms.rows,
      availableRooms: availableRooms.rows
    });
  } catch (err) {
    const error = err as any;
    res.status(500).json({error: error.message});
  }
});

// GET ROOM BY ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(500).json({ message: "Missing user" });
    return;
  }

  const roomId = Number(req.params.id);

  try {
    console.log("querying");
    // Fetch room data along with members and user details in a single query
    const roomDataQuery = await pool.query(
      `SELECT 
        r.id AS room_id, 
        r.name AS room_name, 
        r.created_at AS room_created_at, 
        r.owner AS room_owner, 
        r.is_private AS room_is_private,
        rm.user_id AS member_user_id,
        u.username AS member_username,
        u.created_at AS member_created_at,
        u.last_login AS member_last_login,
        u.is_online AS member_is_online
      FROM 
        rooms r
      LEFT JOIN 
        room_members rm ON r.id = rm.room_id
      LEFT JOIN 
        users u ON rm.user_id = u.id
      WHERE 
        r.id = $1`,
      [roomId]
    );

    const room = {
      id: roomDataQuery.rows[0].room_id,
      name: roomDataQuery.rows[0].room_name,
      created_at: roomDataQuery.rows[0].room_created_at,
      owner: roomDataQuery.rows[0].room_owner,
      is_private: roomDataQuery.rows[0].room_is_private,
      is_online: roomDataQuery.rows[0].member_is_online
    };

    const users = roomDataQuery.rows.map((row) => {
      const isOwner = room.owner === row.member_user_id;
      return {
        id: row.member_user_id,
        username: row.member_username,
        created_at: row.member_created_at,
        last_login: row.member_last_login,
        is_owner: isOwner,
        is_online: row.member_is_online
      };
    });

    const dataToReturn = {
      room,
      users
    };

    res.json(dataToReturn);
  } catch (error) {
    console.error('Error fetching room data:', error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// CREATE
router.post("/create", authenticateToken, async (req: AuthenticatedRequest, res) => { 
  // create room (row in rooms)
  let createdRoomId: null | string = null;

  if (!req.user) {
    res.status(500).json({message: "Missing user"});
    return;
  }

  try {
    console.log("in try ");
    let passwordHash = null;
    if (req.body.is_private) {
      passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    const roomsQuery = await pool.query(
      "SELECT * FROM rooms r WHERE r.name=$1",
      [req.body.name]
    );
    
    if((roomsQuery.rowCount || 0) > 0) {
      res.status(500).send("Room name already taken.");
      return;
    }
  

    const newRoomQuery = await pool.query(
      "INSERT INTO rooms(name, owner, password_hash, is_private) values ($1,$2,$3,$4) RETURNING id, name",
      [
        req.body.name,
        req.user.id,
        passwordHash,
        req.body.is_private
      ]
    );

    console.log("done query ", newRoomQuery.rows);

    if (newRoomQuery.rows[0].id) {
      createdRoomId = newRoomQuery.rows[0].id;
    }
  } catch(err) {
    res.json({
      status: "Room name already taken.",
      error: err
    });
    return;
  }

  if (!createdRoomId) {
    res.json({
      status: "Creation of room failed."
    });
    return;
  }

  // create row in room_members (owner)
  try {
    const newRoomMemberQuery = await pool.query(
      "INSERT INTO room_members(user_id, room_id) values ($1,$2)",
      [req.user.id, createdRoomId]
    );
  } catch(err) {
    // second step failed delete room
    const deleteRoomQuery = await pool.query(
      "DELETE FROM rooms r WHERE r.id=$1 CASCADE",
      [createdRoomId]
    );
    res.json({
      status: "Could not create room."
    });
    return;
  }

  // create new row in messages - system ("x" created room)
  try {
    const newMessageQuery = await pool.query(
      "INSERT INTO messages(content, user_id, room_id, message_type) values ($1,$2,$3,$4)",
      [
        `${req.user.username} created group ${req.body.name}`,
        req.user.id,
        createdRoomId,
        "system"
      ]
    );
    console.log("success");
    res.json({
      status: "Success",
    });
    return;
  } catch(err) {
    const deleteRoomQuery = await pool.query(
      "DELETE FROM rooms r WHERE r.id=$1 CASCADE",
      [createdRoomId]
    );
    // second step failed delete room
    const deleteRoomMemberQuery = await pool.query(
      "DELETE FROM rooms_members r WHERE r.user_id=$1 AND r.room_id=$2 CASCADE",
      [req.user.id, createdRoomId]
    );
    // second step failed delete room
    res.json({
      status: "Could not create room."
    });
    return;
  }
});

// JOIN
router.post("/join", authenticateToken, async (req: AuthenticatedRequest, res) => {
  // get caller id and name
  if (!req.user) {
    res.status(500).json({message: "Missing user"});
    return;
  }

  // check if room is private (check password)
  console.log(req.body.name);
  const roomsQuery = await pool.query(
    "SELECT * FROM rooms r WHERE r.name=$1",
    [req.body.name]
  );

  console.log(roomsQuery.rows[0]);

  if((roomsQuery?.rowCount || 0) <= 0) {
    res.status(500).send("Room does not exist.");
    return;
  }

  // check password
  if(roomsQuery.rows[0].is_private) {
    const isOk = await bcrypt.compare(req.body.password, roomsQuery.rows[0].password_hash);
    if (!isOk) {
      res.json({message: "Incorrect password."});
      return;
    }
  }

  // add row to room_members
  try {
    const newRoomMemberQuery = await pool.query(
      "INSERT INTO room_members(user_id, room_id) values ($1,$2)",
      [req.user.id, roomsQuery.rows[0].id]
    );
  } catch(err) {
    console.log(err);
    res.status(500).send(err);
  }

  // add new system message to messages
  try {
    const newMessageQuery = await pool.query(
      "INSERT INTO messages(content, user_id, room_id, message_type) values ($1,$2,$3,$4)",
      [
        `${req.user.username} joined group ${req.body.name}`,
        req.user.id,
        roomsQuery.rows[0].id,
        "system"
      ]
    );
    // send message to users in group
    await sendMessageToRoomSocket(
      {
        room_id: roomsQuery.rows[0].id,
        content: `${req.user.username} joined group ${req.body.name}`,
        image: null
      },
      "system",
      req.user.id
    );
    res.status(200).send({
      status: "success"
    });
  } catch(err) {
    // second step failed delete room
    const deleteRoomMemberQuery = await pool.query(
      "DELETE FROM room_members WHERE user_id = $1 AND room_id = $2",
      [req.user.id, roomsQuery.rows[0].id]
    );
    // second step failed delete room
    res.json({
      status: "Could not join room."
    });
    return;
  }
});

// LEAVE
router.post("/leave", authenticateToken, async (req: AuthenticatedRequest, res) => {
  // get caller id and name
  if (!req.user) {
    res.status(500).json({message: "Missing user"});
    return;
  }

  // check if room is private (check password)
  console.log(req.body.room_id, req.body.name);
  const roomsQuery = await pool.query(
    "DELETE FROM room_members r WHERE r.user_id=$1 AND r.room_id=$2",
    [req.user.id, req.body.room_id]
  );
  const newMessageQuery = await pool.query(
    "INSERT INTO messages(content, user_id, room_id, message_type) values ($1,$2,$3,$4)",
    [
      `${req.user.username} left group ${req.body.name}`,
      req.user.id,
      req.body.room_id,
      "system"
    ]
  );
  // send mesage to users in group
  await sendMessageToRoomSocket(
    {
      room_id: req.body.room_id,
      content: `${req.user.username} left group ${req.body.name}`,
      image: null,
    },
    "system",
    req.user.id
  );
  res.status(200).send({
    status: "success"
  });
});

// DELETE
router.post("/delete", authenticateToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(500).json({message: "Missing user"});
    return;
  }

  // check if caller is owner
  const roomsQuery = await pool.query(
    "SELECT * FROM rooms r WHERE r.id=$1",
    [req.body.id]
  );

  if(roomsQuery.rows[0].owner === req.user.id) { 
    const deleteRoomQuery = await pool.query(
      `WITH deleted_messages AS (
        DELETE FROM messages WHERE room_id=$1
      ), deleted_room_members AS (
        DELETE FROM room_members WHERE room_id=$1
      )
      DELETE FROM rooms WHERE id=$1;`,
      [req.body.id]
    );
    res.json({
      "success": true
    });
  }else{
    res.json({
      message: "Not owner."
    });
  }
});


export default router;