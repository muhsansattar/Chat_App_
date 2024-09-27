<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { useRoomsStore } from '@/stores/rooms';
import { ref } from 'vue';

const chatName = ref('');
const isPrivate = ref(false);
const password = ref('');
const errorMessage = ref("");

const authStore = useAuthStore();
const roomsStore = useRoomsStore();

const createChat = async () => {
  try {
    await roomsStore.createRoom({
      name: chatName.value,
      id: 0,
      is_private: isPrivate.value,
      password: password.value,
    });
    errorMessage.value = "";
  } catch(err) {
    errorMessage.value = "Chat name already taken.";
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-black text-white">
    <div class="w-full max-w-lg p-8 bg-gray-800 rounded-lg shadow-lg">
      <h1 class="text-2xl font-bold mb-6">Create Chat Room</h1>

      <!-- Error message box -->
      <div v-if="errorMessage" class="mb-4 p-2 bg-red-600 text-white rounded">
        {{ errorMessage }}
      </div>

      <div class="mb-4">
        <label for="chatName" class="block text-sm font-medium mb-2">Chat Name</label>
        <input
          v-model="chatName"
          id="chatName"
          type="text"
          class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter chat name"
        />
      </div>

      <div class="mb-4">
        <label class="flex items-center">
          <input
            v-model="isPrivate"
            type="checkbox"
            class="form-checkbox h-5 w-5 text-blue-600"
          />
          <span class="ml-2">Is this a private chat?</span>
        </label>
      </div>

      <div v-if="isPrivate" class="mb-6">
        <label for="password" class="block text-sm font-medium mb-2">Password</label>
        <input
          v-model="password"
          id="password"
          type="password"
          class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter password"
        />
      </div>

      <button
        @click="createChat"
        class="w-full p-2 bg-blue-600 border border-blue-700 rounded text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Create Chat
      </button>

      <a
        href="/"
        class="text-blue-400 hover:text-blue-300 mt-6"
      >
        Back
    </a>
    </div>
  </div>
</template>

<style>
/* Add any additional custom styles here */
</style>
