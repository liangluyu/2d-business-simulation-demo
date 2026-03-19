import './style.css'
import { WorkshopGame, type GameViewState } from './game/WorkshopGame'
import { GameUI } from './ui/GameUI'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found.')
}

let ui: GameUI | null = null
let pendingState: GameViewState | null = null

const game = new WorkshopGame((state) => {
  if (!ui) {
    pendingState = state
    return
  }

  ui.render(state)
})

ui = new GameUI(app, game)
if (pendingState) {
  ui.render(pendingState)
  pendingState = null
}
game.start()
