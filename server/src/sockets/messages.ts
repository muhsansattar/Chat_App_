import { io } from "..";
import { pool } from "../db";
import { AuthenticatedSocket } from "../middleware/auth";

export const handleMessage = async (msg: {content: string, room_id: number, image: any}, messageType: "user" | "system", socket: AuthenticatedSocket) => {
  if (socket.user) {
    // Save message to the database
    const isSaved = await saveMessage(msg, socket.user?.id);
  
    // send message to room
    if (isSaved) {
      await sendMessageToRoomSocket(msg, messageType, socket.user?.id);
      return true;
    } else {
      return false;
    }
  } else {
    console.log("not authorized");
    return false;
  }
};

const saveMessage = async (msg: {content: string, room_id: number, image: any}, user_id: number) => {
  // check if member
  const rmQuery = await pool.query(
    "SELECT FROM room_members r WHERE r.user_id=$1 AND r.room_id=$2",
    [user_id, msg.room_id]
  );

  if ((rmQuery.rowCount || 0) >0) {
    // save to DB
    await pool.query(
      'INSERT INTO messages (content, user_id, room_id, image) VALUES ($1, $2, $3, $4)',
      [msg.content, user_id, msg.room_id, msg.image ? Buffer.from(msg.image, 'base64') : null]
    );
    return true;
  } else {
    return false;
  }
};

export const sendMessageToRoomSocket = async (msg: {content: string, room_id: number, image: any}, messageType: "user" | "system", user_id: number) => {
  // Broadcast message to all clients in the same room
  console.log("sending to ", msg.room_id.toString(), msg, user_id);
  io.in(msg.room_id.toString()).emit(
    'chat message',
    {
      ...msg,
      user_id: user_id,
      created_at: new Date(),
      message_type: messageType,
      image: msg.image ? Buffer.from(msg.image, 'base64') : null
    }
  );
};
