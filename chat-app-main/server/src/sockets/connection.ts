import { pool } from "../db";
import { AuthenticatedSocket } from "../middleware/auth";


export const handleChangeOnlineState = async (newState: boolean, socket: AuthenticatedSocket) => {
  if (socket.user) {
    // set is_online to true
    const updateQuery = await pool.query(
      "UPDATE users SET is_online=$1 WHERE id=$2",
      [newState, socket.user.id]
    );
  } else {
    console.log("not authorized");
    return false;
  }
};
