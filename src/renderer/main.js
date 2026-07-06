import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import RootApp from './RootApp.vue'
import App from './App.vue'
import BallApp from './BallApp.vue'
import './styles/global.css'

const routes = [
  { path: '/', component: App },
  { path: '/ball', component: BallApp },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const pinia = createPinia()
const app = createApp(RootApp)

app.use(pinia)
app.use(router)
app.mount('#app')

