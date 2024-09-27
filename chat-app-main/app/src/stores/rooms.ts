import { defineStore } from 'pinia';
import axios from 'axios';
import { computed, ref } from 'vue';
import { URL, useAuthStore } from './auth';
import { useRouter } from 'vue-router';

export interface Room {
  id: number;
  name: string;
  is_private: boolean;
  password?: string;
}

export interface RoomDetails {
  id: number;
  name: string;
  created_at: string;
  owner: number;
  is_private: boolean;
};
export interface ChatUser {
  id: number;
  username: string;
  created_at: string;
  is_owner: boolean;
  last_login: string;
  is_online: boolean;
};

export interface RoomData {
  users: ChatUser[];
  room: RoomDetails;
};

export interface Message {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  room_id: number;
  message_type: MessageType;
  image: any | null;
};

export type MessageType = "user" | "system";

export const useRoomsStore = defineStore('rooms', () => {
  const router = useRouter(); 

  const rooms = ref({
    availableRooms: [],
    joinedRooms: [],
  });
  const currentRooms = computed(() => rooms.value);
  const { currentJwt } = useAuthStore();

  const getRooms = async() => {
    if(currentJwt.access) {
      console.log("getting room A", currentJwt.access);
      const { data } = await axios.get(
        `${URL}/rooms/`,
        {
          headers: {
            "Authorization": `Bearer ${currentJwt.access}`
          }
        }
      );
      console.log(data);
      rooms.value = data;
      return data;
    }
  };

  const createRoom = async (data: Room) => {
    const postReq = await axios.post(
      `${URL}/rooms/create`,
      {
        ...data
      },
      {
        headers: {
          "Authorization": `Bearer ${currentJwt.access}`
        }
      }
    );

    await getRooms();
    window.location.href = '/';
  };

  const getRoomById = async (id: number): Promise<RoomData | null> => {
    try {
      console.log(id, "getting");
      const req = await axios.get(
        `${URL}/rooms/${id}`,
        {
          headers: {
            "Authorization": `Bearer ${currentJwt.access}`
          }
        }
      );
      console.log("result, ", req.data);
      // get room data by id /rooms/:id
      // get room content by id /messages/:roomId
      // join room sockets
      return req.data;
    } catch(err) {
      console.log(err);
      return null;
    }
  };

  const getRoomMessages = async (roomId: number) => {
    try {
      console.log(roomId, "getting");
      const req = await axios.get(
        `${URL}/messages/${roomId}`,
        {
          headers: {
            "Authorization": `Bearer ${currentJwt.access}`
          }
        }
      );
      console.log("result, ", req.data);
      // get room data by id /rooms/:id
      // get room content by id /messages/:roomId
      // join room sockets
      return req.data;
    } catch(err) {
      console.log(err);
      return null;
    }
  };

  const joinRoom = async (data: { name: string, password: string, id?: number }) => {
    const postReq = await axios.post(
      `${URL}/rooms/join`,
      {
        ...data
      },
      {
        headers: {
          "Authorization": `Bearer ${currentJwt.access}`
        }
      }
    );

    await getRooms();
    router.push(`/${data.id || ""}`);
  };

  const deleteRoom = async (id: number) => {
    const postReq = await axios.post(
      `${URL}/rooms/delete`,
      {
        id: id
      },
      {
        headers: {
          "Authorization": `Bearer ${currentJwt.access}`
        }
      }
    );

    await getRooms();
    window.location.href = '/';
  };

  const leaveRoom = async (id: number, name: string) => {
    const postReq = await axios.post(
      `${URL}/rooms/leave`,
      {
        room_id: id,
        name: name
      },
      {
        headers: {
          "Authorization": `Bearer ${currentJwt.access}`
        }
      }
    );

    await getRooms();
    window.location.href = '/';
  };

  return { 
    rooms: currentRooms,
    getRooms,
    createRoom,
    joinRoom,
    getRoomById,
    getRoomMessages,
    deleteRoom,
    leaveRoom
  };
});