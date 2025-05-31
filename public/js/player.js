// public/player.js
const socket = io();

console.log('Player page loaded, waiting for song selection...');

socket.on('connect', () => {
  console.log('Connected to server as player');
  // בדיקה אם יש שיר פעיל
  socket.emit('check-active-song');
});

// קבלת תשובה על שיר פעיל
socket.on('active-song', (song) => {
  console.log('Active song check response:', song);
  if (song) {
    // אם יש שיר פעיל, עבור ישר לדף ה-live
    window.location.href = `/live.html?song=${encodeURIComponent(song.song)}&artist=${encodeURIComponent(song.artist)}`;
  }
});

socket.on('song-selected', (song) => {
  console.log('Received song-selected event:', song);
  
  // בדיקה אם המשתמש הוא זמר
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const isVocalist = userData.instrument === 'vocals';
  
  // בניית ה-URL עם או בלי הפרמטר instrument
  const baseUrl = `/live.html?song=${encodeURIComponent(song.song)}&artist=${encodeURIComponent(song.artist)}`;
  const finalUrl = isVocalist ? `${baseUrl}&instrument=vocals` : baseUrl;
  
  // מעבר לדף השיר
  window.location.href = `/live.html?song=${encodeURIComponent(song.song)}&artist=${encodeURIComponent(song.artist)}`;
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
