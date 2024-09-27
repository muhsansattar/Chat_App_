<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { useRoomsStore } from '@/stores/rooms';
import { computed, onMounted, onUnmounted, ref, watch, nextTick, reactive, type Reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { ChatUser, Message, RoomDetails } from '@/stores/rooms';
import { io } from 'socket.io-client';
import { format } from 'date-fns';

const authStore = useAuthStore();
const roomsStore = useRoomsStore();
const router = useRouter();
const route = useRoute();

const URL = "http://localhost:3000";

const socket = ref<any>(null);
const availableRooms = ref<any[]>([]);
const joinedRooms = ref<any[]>([]);
const selectedRoom = ref<any | null>(null);
const selectedAvailableRoom = ref<any | null>(null);
const newMessage = ref("");
const details = ref<RoomDetails | null>(null);
const chatUsers = ref<ChatUser[] | null>(null);
const messages = ref<Reactive<Message>[] | null>(null);

const messagesContainer = ref<HTMLDivElement | null>(null);
const fileInput = ref<any>(null);
const file = ref<any>(null);

const triggerFileInput = () => {
  fileInput.value.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const selectedFile = target.files?.[0];
  if (selectedFile) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        file.value = reader.result.split(',')[1]; // Get Base64 string
      }
    };
    reader.readAsDataURL(selectedFile);
  }
};

const handleLogout = async () => {
  await authStore.logout();
};

const selectRoom = (room: any) => {
  selectedRoom.value = room;
  router.push(`/${room.id}`);
};

const selectAvailableRoom = (room: any) => {
  if(!socket.value) {
    console.log("connecting");
    socket.value = io(URL, {
      withCredentials: true,
      extraHeaders: {
        "Authorization": `Bearer ${authStore.currentJwt.access}`
      }
    });
  }
  selectedAvailableRoom.value = room;
};

const loadRooms = async () => {
  console.log("loading rooms");
  const rooms = await roomsStore.getRooms();
  availableRooms.value = rooms.availableRooms;
  joinedRooms.value = rooms.joinedRooms;

  const roomId = Number(route.params.roomId);
  if (roomId) {
    const room = rooms.joinedRooms.find((room: any) => room.id === roomId);
    if (room) {
      selectedRoom.value = room;
    } else {
      router.push('/');
    }
  } else {
    selectedRoom.value = null;
    chatUsers.value = null;
  }

  if (socket.value) {
    console.log("connecting");
    socket.value.disconnect();
    socket.value = io(URL, {
      withCredentials: true,
      extraHeaders: {
        "Authorization": `Bearer ${authStore.currentJwt.access}`
      }
    });
  }
};

const joinChat = async () => {
  if (selectedAvailableRoom.value) {
    try {
      await roomsStore.joinRoom({
        name: selectedAvailableRoom.value.name,
        password: "",
        id: selectedAvailableRoom.value.id
      });
      socket.value.emit('join-room', { room_id: selectedAvailableRoom.value.id }, () => {
        console.log("done");
      });
      selectedAvailableRoom.value = null; // Clear selection
    } catch(err) {
      console.log(err);
    }
  }
};

const sendMessage = async() => {
  console.log(selectedRoom.value.id)
  if ((newMessage.value.trim() || file?.value) && details.value && chatUsers.value) {
    const payload = {
      content: newMessage.value,
      room_id: selectedRoom.value.id,
      image: file.value || null,
    };
    
    if (socket.value) {
      console.log("sending message");
      socket.value.emit('message', payload);
    }
  
    newMessage.value = "";
    file.value = null;
  }
};

const getRoomDetails = async () => {
  if (selectedRoom.value && selectedRoom.value.id) {
    messages.value = [];
    const roomId = selectedRoom.value.id;
    const res = await roomsStore.getRoomById(roomId);
    const resMessages = await roomsStore.getRoomMessages(roomId);
    messages.value = resMessages.messages.map((msg: any) => reactive({ ...msg }));
    details.value = res?.room || null;
    chatUsers.value = res?.users || null;

    if(!socket.value) {
      console.log("connecting");
      socket.value = io(URL, {
        withCredentials: true,
        extraHeaders: {
          "Authorization": `Bearer ${authStore.currentJwt.access}`
        }
      });
    }

    socket.value.emit('join-room', { room_id: roomId }, () => {
      console.log("done");
    });

    socket.value.on("chat message", async (a: any) => {
      if (messages.value) {
        if (messages.value[messages.value.length - 1]?.created_at !== a.created_at) {
          messages.value = [...messages.value, reactive({ ...a })];
        }
      } else {
        messages.value = [reactive({ ...a })];
      }

      if (a.message_type === "system") {
        await getRoomDetails();
      }

      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
      });
    });
  }
};

const getMessageUsername = (message: Message) => {
  let toReturn = "User";
  chatUsers.value?.forEach((user: any) => {
    if (user.id === message.user_id) toReturn = user.username;
  });
  return toReturn;
};

const getStatus = (member: ChatUser) => {
  if (member.id === authStore.user.id) return true;
  return member.is_online;
};

const leaveRoom = async() => {
  if (details.value) {
    if (details.value?.owner !== authStore.user.id) {
      await roomsStore.leaveRoom(details.value.id, details.value.name);
    }
  }
}

const deleteRoom = async() => {
  if (details.value) {
    if (details.value?.owner === authStore.user.id) {
      await roomsStore.deleteRoom(details.value.id);
    }
  }
}

// Check if the image field is in Buffer or ArrayBuffer format
const processImage = (image: any): string => {
  if (image && image.type === 'Buffer' && Array.isArray(image.data)) {
    return `data:image/jpeg;base64,${bufferToBase64(image.data)}`;
  } else if (image instanceof ArrayBuffer) {
    return `data:image/jpeg;base64,${arrayBufferToBase64(image)}`;
  }
  return '';
};

const bufferToBase64 = (buffer: number[]): string => {
  try {
    const binary = Array.from(buffer, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary);
  } catch (error) {
    console.error('Error in bufferToBase64:', error);
    return '';
  }
};

// Convert ArrayBuffer to Base64
const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer): string => {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binary);
  } catch (error) {
    console.error('Error in arrayBufferToBase64:', error);
    return '';
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return format(date, "d.M. HH:mm");
};

// Watchers
watch(authStore.currentJwt, loadRooms);
watch(selectedRoom, getRoomDetails);
watch(route, loadRooms);
onUnmounted(() => {
  if (socket.value) {
    console.log("disconnected");
    socket.value.disconnect();
  }
});
</script>



<template>
  <div class="flex h-screen bg-gray-900 text-white">
    <!-- Left Sidebar -->
    <div class="w-1/4 bg-gray-800 p-4 flex flex-col justify-between">
      <div>
        <h1 class="text-xl font-bold mb-4">Joined Rooms</h1>
        <ul>
          <li 
            v-for="(room, index) in joinedRooms" 
            :key="index" 
            @click="selectRoom(room)" 
            class="cursor-pointer p-2 mb-2 rounded hover:bg-gray-700"
          >
            {{ room.name }}
          </li>
        </ul>

        <hr class="my-4 border-gray-600" />

        <h1 class="text-xl font-bold mb-4">Available Rooms</h1>
        <ul>
          <li 
            v-for="(room, index) in availableRooms" 
            @click="selectAvailableRoom(room)" 
            :key="index" 
            class="cursor-pointer p-2 mb-2 rounded hover:bg-gray-700"
          >
            {{ room.name }}
          </li>
        </ul>
      </div>

      <RouterLink to="/join" class="text-blue-400 hover:text-blue-300 mt-6">
        <button class="w-full p-2 bg-blue-600 border border-blue-700 rounded text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          Join Private Chat
        </button>
      </RouterLink>
      <RouterLink to="/create" class="text-blue-400 hover:text-blue-300 mt-2">
        <button class="w-full p-2 bg-blue-600 border border-blue-700 rounded text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          Create New Chat
        </button>
      </RouterLink>

      <!-- User Data Box -->
      <div class="mt-8 p-4 bg-gray-700 rounded">
        <h2 class="text-lg font-semibold">{{ authStore.user.username }}</h2>
        <button @click="handleLogout" class="w-full mt-4 p-2 bg-red-600 rounded hover:bg-red-700">
          Logout
        </button>
      </div>
    </div>

    <!-- Middle Section (Chat Content) -->
    <div class="w-2/4 p-4">
      <div v-if="selectedRoom">
        <h1 class="text-xl font-bold mb-4">Selected Room: {{ selectedRoom.name }}</h1>
        <div ref="messagesContainer" class="chat-content p-4 bg-gray-800 rounded h-[65vh] overflow-y-scroll">
          <div v-for="(message, index) in messages" :key="index" class="mb-2">
            <div v-if="message.message_type === 'system'" class="text-center text-gray-400 italic">
              <p>{{ message.content }}</p>
            </div>
            <div v-else-if="message.user_id === authStore.user.id" class="text-right">
              <div class="inline-block p-2 bg-blue-600 rounded text-white max-w-sm">
                <p class="text-sm font-semibold">You</p>
                <p class="whitespace-pre-wrap">{{ message.content }}</p>
                <img
                  v-if="message.image"
                  :src="processImage(message.image)"
                  alt="User uploaded image"
                  class="mt-2 rounded-lg max-w-full h-auto"
                />
              </div>
              <p class="text-xs text-gray-400 mt-1">{{ formatDate(message.created_at) }}</p>
            </div>
            <div v-else class="text-left">
              <div class="inline-block p-2 bg-gray-700 rounded text-white max-w-sm">
                <p class="text-sm font-semibold">{{ getMessageUsername(message) }}</p>
                <p class="whitespace-pre-wrap">{{ message.content }}</p>
                <img
                  v-if="message.image"
                  :src="processImage(message.image)"
                  alt="User uploaded image"
                  class="mt-2 rounded-lg max-w-full h-auto"
                />
              </div>
              <p class="text-xs text-gray-400 mt-1">{{ formatDate(message.created_at) }}</p>
            </div>
          </div>
        </div>
        <div class="mt-4 flex">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Type your message..."
            class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            class="ml-2 p-2 bg-blue-600 border border-blue-700 rounded text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @click="sendMessage"
          >
            Send
          </button>
        </div>
        <div>
          <input type="file" accept="image/*" ref="fileInput" @change="handleFileChange" style="display: none;" />
          <button
            class="mt-2 p-2 bg-blue-600 border border-blue-700 rounded text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @click="triggerFileInput"
          >
            Select Image
          </button>
          <div v-if="file?.value">
            Image selected
          </div>
        </div>
      </div>
      <div v-if="selectedAvailableRoom">
        <h1 class="text-xl font-bold mb-4">Join {{ selectedAvailableRoom.name }}?</h1>
        <div>
          <button
            class="w-full p-2 bg-blue-600 border border-blue-700 rounded text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @click="joinChat"
          >
            Join Chat
          </button>
        </div>
      </div>
    </div>

    <!-- Right Sidebar (Chat Room Members and Details) -->
    <div class="w-1/4 bg-gray-800 p-4">
      <h1 class="text-xl font-bold mb-4">
        {{ details?.name || "Chat" }} Details
      </h1>
      <p v-if="!details">
        Select a chat to see details.
      </p>
      <div v-else>
        <p class="text-lg font-semibold mb-2">Room Members</p>
        <ul>
          <li 
            v-for="(member, index) in chatUsers" 
            :key="index" 
            class="p-4 mb-2 bg-gray-700 rounded flex items-center justify-between"
          >
            <div>
              <strong class="text-white">{{ member.username }}</strong>
              <span v-if="member.is_owner" class="ml-2 bg-yellow-500 text-black text-xs font-semibold py-1 px-2 rounded">
                Owner
              </span>
              <p class="text-sm text-gray-400">Last Logged In: {{ formatDate(member.last_login || (new Date()).toString()) }}</p>
              <p :class="{'text-green-400': getStatus(member), 'text-red-400': !getStatus(member)}" class="text-sm">
                Status: {{ getStatus(member) ? 'Online' : 'Offline' }}
              </p>
            </div>
          </li>
        </ul>
      </div>
      <div v-if="details !== null">
        <hr class="my-4 border-gray-600" />
        <button v-if="details?.owner !== authStore.user.id" @click="leaveRoom" class="w-full mt-4 p-2 bg-red-600 rounded hover:bg-red-700">
          Leave Room
        </button>
        <button v-else @click="deleteRoom" class="w-full mt-4 p-2 bg-red-600 rounded hover:bg-red-700">
          Delete Room
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Your styles here */
</style>
