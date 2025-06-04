// public admin.js
async function searchSong() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  try {
    // Show a loading indicator
    const searchBtn = document.querySelector('button');
    searchBtn.disabled = true;
    searchBtn.textContent = 'Searching...';

    // Send a request to the server
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Search failed');
    }
    
    const data = await response.json();
    
    // Save the results in localStorage and redirect to the results page
    localStorage.setItem('searchResults', JSON.stringify(data.results));
    window.location.href = 'result.html';
  } catch (error) {
    console.error('Search error:', error);
    alert('Failed to search songs. Please try again.');
  } finally {
    // Reset the button to its normal state
    const searchBtn = document.querySelector('button');
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

    // Add support for searching by pressing Enter
document.getElementById('searchInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    searchSong();
  }
});
