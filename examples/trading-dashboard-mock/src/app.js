const market = {
  portfolio: [118.2, 119.4, 121.1, 120.3, 122.6, 124.0, 123.2, 125.7, 127.4, 126.9, 129.1, 131.3],
  symbols: [
    { symbol: 'NKO', name: 'Neko Systems', price: 142.35, change: 2.41 },
    { symbol: 'VRFY', name: 'Verify Labs', price: 88.12, change: 1.26 },
    { symbol: 'GATE', name: 'Gatehold Inc.', price: 54.67, change: 0.74 },
    { symbol: 'MOCK', name: 'Mock Market ETF', price: 203.19, change: 3.08 },
  ],
};

const chart = document.querySelector('#portfolioChart');
const watchlist = document.querySelector('#watchlist');

renderWatchlist(market.symbols);
drawChart(chart, market.portfolio);

function renderWatchlist(symbols) {
  watchlist.replaceChildren(...symbols.map((item) => {
    const row = document.createElement('div');
    row.className = 'symbol';
    row.innerHTML = `
      <strong>${item.symbol}</strong>
      <span class="price">$${item.price.toFixed(2)}</span>
      <span>${item.name}</span>
      <span class="delta">+${item.change.toFixed(2)}%</span>
    `;
    return row;
  }));
}

function drawChart(canvas, values) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const pad = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const xStep = (width - pad * 2) / (values.length - 1);
  const yScale = (height - pad * 2) / (max - min);

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#d9e0ea';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = pad + ((height - pad * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  const points = values.map((value, index) => ({
    x: pad + xStep * index,
    y: height - pad - (value - min) * yScale,
  }));

  const gradient = ctx.createLinearGradient(0, pad, 0, height - pad);
  gradient.addColorStop(0, 'rgba(21, 127, 116, 0.28)');
  gradient.addColorStop(1, 'rgba(21, 127, 116, 0.02)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - pad);
  for (const point of points) ctx.lineTo(point.x, point.y);
  ctx.lineTo(points.at(-1).x, height - pad);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = '#157f74';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.fillStyle = '#17202a';
  ctx.font = '700 18px system-ui';
  ctx.fillText('Mock portfolio trend', pad, pad - 10);
}
