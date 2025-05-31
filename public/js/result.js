// public/results.js
const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const query = urlParams.get('query');

// Simulate a hardcoded song database
const songsDB = [
  { name: "Imagine", artist: "John Lennon", image: "img/imagine.jpg" },
  { name: "Let It Be", artist: "The Beatles", image: "img/letitbe.jpg" },
  { name: "Wonderwall", artist: "Oasis", image: "img/wonderwall.jpg" }
];

function displayResults(results) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  results.forEach(song => {
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `
      <strong>${song.name}</strong> - ${song.artist}
    `;
    div.onclick = () => {
      socket.emit('song-selected', song);
      window.location.href = `/live.html?song=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}&admin=true`;
    };
    container.appendChild(div);
  });
}

// Filter songs by query
const filtered = songsDB.filter(song => song.name.toLowerCase().includes(query.toLowerCase()));
displayResults(filtered);
