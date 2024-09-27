import { createRouter, createWebHistory } from 'vue-router'
import AppView from '../views/AppView.vue'
import CreateChatView from '@/views/CreateChatView.vue'
import JoinChatView from '@/views/JoinChatView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'app',
      component: AppView
    },
    {
      path: '/:roomId',
      name: 'chatpage',
      component: AppView
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: "/signup",
      name: "signup",
      component: () => import('../views/SignupView.vue')
    },
    {
      path: "/create",
      name: "create",
      component: CreateChatView
    },
    {
      path: "/join",
      name: "join",
      component: JoinChatView
    },
  ]
})

export default router
