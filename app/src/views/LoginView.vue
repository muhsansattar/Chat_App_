<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { ref } from "vue";

// Get the auth store instance
const authStore = useAuthStore();

const username = ref("");
const password = ref("");
const errorMessage = ref("");

// Login function
const handleLogin = async () => {
  try {  
    const success = await authStore.login(username.value, password.value);
    errorMessage.value = "";
  } catch(err) {
    errorMessage.value = "Wrong username or password.";
  }
};
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-black text-white">
    <div class="p-8 bg-gray-800 rounded-lg shadow-lg w-full max-w-sm">
      <h1 class="text-2xl font-bold mb-4">Login</h1>

      <!-- Error message box -->
      <div v-if="errorMessage" class="mb-4 p-2 bg-red-600 text-white rounded">
        {{ errorMessage }}
      </div>

      <input
        v-model="username"
        placeholder="Username"
        class="w-full mb-4 p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <br />
      <input
        type="password"
        v-model="password"
        placeholder="Password"
        class="w-full mb-4 p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <br />
      <button
        @click="handleLogin"
        class="w-full p-2 bg-blue-600 border border-blue-700 rounded text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Login
      </button>
      <hr class="my-4 border-gray-600" />
      <RouterLink
        to="/signup"
        class="text-blue-400 hover:text-blue-300"
      >
        Sign Up
      </RouterLink>
    </div>
  </div>
</template>


<style>
/* Add your styles here */
</style>
