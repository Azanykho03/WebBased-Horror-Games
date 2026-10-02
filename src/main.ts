import './style.css';
import { Game } from './game.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const root = document.querySelector<HTMLElement>('#ui');
if (!canvas || !root) throw new Error('Game canvas or UI root is missing.');
const game = new Game(canvas, root);
void game.init();
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
