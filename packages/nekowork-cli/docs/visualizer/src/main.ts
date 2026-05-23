import './styles.css';
import { loadFixtures, selectFixture } from './fixtures.js';
import { render } from './renderer.js';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('visualizer: #app root not found');
}

const fixtures = loadFixtures();
const params = new URLSearchParams(window.location.search);
const requested = params.get('fixture');
const fixture = selectFixture(fixtures, requested);

render(root, fixture);
