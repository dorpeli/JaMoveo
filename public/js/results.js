document.addEventListener('DOMContentLoaded', function() {
  const resultsDiv = document.getElementById('results');
  const results = JSON.parse(localStorage.getItem('searchResults') || '[]');

  // Clear all previous states when the page is loaded
  // This is important in case the user returns with the back button
  document.querySelectorAll('.song-card').forEach(card => {
    card.style.opacity = '1';
    card.style.pointerEvents = 'auto';
  });

  if (results.length === 0) {
    resultsDiv.innerHTML = '<div class="no-results">No songs found. Try a different search.</div>';
    return;
  }

  results.forEach(song => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
      ${song.image ? `<img src="${escapeHtml(song.image)}" alt="${escapeHtml(song.song)}" class="song-image">` : ''}
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.song)}</div>
        <div class="song-artist">${escapeHtml(song.artist)}</div>
      </div>
    `;

    // Add event listener for clicking the card
    card.addEventListener('click', () => selectSong(song));
    resultsDiv.appendChild(card);
  });
});

// Function for selecting a song with retry mechanism
async function selectSong(song, retryCount = 0) {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 1000; // 1 second
  const MAX_DELAY = 8000; // 8 seconds

  try {
    // Check if the user is an admin
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
      alert('You do not have permission to select songs. Only admins can select songs.');
      return;
    }

    // Show an indicator that the selection is being made
    const card = event.currentTarget;
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';

    console.log(`Selecting song (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, song);

    // Send the song to the server
    const response = await fetch('/api/select-song', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        song: song.song,
        artist: song.artist,
        url: song.link
      })
    });

    if (!response.ok) {
      // Check for security errors
      if (response.status === 401) {
        window.location.href = '/login.html';
        return;
      }

      // If we haven't reached max retries, try again
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(INITIAL_DELAY * Math.pow(2, retryCount), MAX_DELAY);
        console.log(`Retrying in ${delay/1000} seconds...`);
        
        // Update the card to show retry status
        card.innerHTML += `<div class="retry-status">Retrying in ${delay/1000}s...</div>`;
        
        // Wait for the delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Remove the retry status
        card.querySelector('.retry-status')?.remove();
        
        // Try again with incremented retry count
        return selectSong(song, retryCount + 1);
      }
      
      throw new Error('Failed to select song after multiple attempts');
    }

    const data = await response.json();
    console.log('Server response:', data);
    
    // Save the selected song in localStorage
    localStorage.setItem('selectedSong', JSON.stringify(data.song));

    // Redirect to the live page after receiving a response from the server
    window.location.href = `/live.html?song=${encodeURIComponent(song.song)}&artist=${encodeURIComponent(song.artist)}&admin=true`;
  } catch (error) {
    console.error('Error selecting song:', error);
    
    // Reset the card to its normal state
    const card = event.currentTarget;
    card.style.opacity = '1';
    card.style.pointerEvents = 'auto';
    
    // Show appropriate error message based on retry status
    if (retryCount >= MAX_RETRIES) {
      alert('Failed to select song after multiple attempts. Please check your connection and try again.');
    } else {
      // The retry mechanism will handle this case
      console.log('Retry mechanism will handle this error');
    }
  }
}

// Function for preventing XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Handle the pageshow event to deal with the back button issue
window.addEventListener('pageshow', function(event) {
  // If the page was loaded from cache (i.e. we returned with the back button)
  if (event.persisted) {
    console.log('Page loaded from cache, re-enabling all cards');
    // Reset all cards to their active state
    document.querySelectorAll('.song-card').forEach(card => {
      card.style.opacity = '1';
      card.style.pointerEvents = 'auto';
    });
  }
});

  // Add support for returning to the search page
window.addEventListener('keydown', function(event) {
  // ESC - Return to the search page
  if (event.key === 'Escape') {
    window.location.href = '/admin.html';
  }
}); 