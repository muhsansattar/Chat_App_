import { reactive } from "vue";
import { io } from "socket.io-client";

export const state = reactive({
  messages: []
});

// "undefined" means the URL will be computed from the `window.location` object
const URL = "http://localhost:3000";

export const socket = io(URL, {
  withCredentials: true,
  extraHeaders: {
    "Authorization": "abcd"
  }
});

socket.on("chat message", (a) => {
  console.log("chat");
  console.log(a);
});

/*socket.on("error", (...args) => {
  state.fooEvents.push(args);
});

socket.on("bar", (...args) => {
  state.barEvents.push(args);
});*/