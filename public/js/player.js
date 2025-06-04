// public/player.js
const socket = io();

console.log('Player page loaded, waiting for song selection...');

socket.on('connect', () => {
  console.log('Connected to server as player');
  // Check if there is an active song
  socket.emit('check-active-song');
});

// Receive response about the active song
socket.on('active-song', (song) => {
  console.log('Active song check response:', song);
  if (song) {
    // If there is an active song, redirect to the live page
    window.location.href = `/live.html?song=${encodeURIComponent(song.song)}&artist=${encodeURIComponent(song.artist)}`;
  }
});

socket.on('song-selected', (song) => {
  console.log('Received song-selected event:', song);
  
  // Check if the user is a vocalist
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const isVocalist = userData.instrument === 'vocals';
  
  // Build the URL with or without the instrument parameter
  const baseUrl = `/live.html?song=${encodeURIComponent(song.song)}&artist=${encodeURIComponent(song.artist)}`;
  const finalUrl = isVocalist ? `${baseUrl}&instrument=vocals` : baseUrl;
  
  // Redirect to the live page
  window.location.href = `/live.html?song=${encodeURIComponent(song.song)}&artist=${encodeURIComponent(song.artist)}`;
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
