// public/admin.js
async function searchSong() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  try {
    // הצג אינדיקציה שהחיפוש מתבצע
    const searchBtn = document.querySelector('button');
    searchBtn.disabled = true;
    searchBtn.textContent = 'Searching...';

    // שליחת בקשה לשרת
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Search failed');
    }
    
    const data = await response.json();
    
    // שמירת התוצאות ב-localStorage ומעבר לדף התוצאות
    localStorage.setItem('searchResults', JSON.stringify(data.results));
    window.location.href = 'result.html';
  } catch (error) {
    console.error('Search error:', error);
    alert('Failed to search songs. Please try again.');
  } finally {
    // החזרת הכפתור למצב הרגיל
    const searchBtn = document.querySelector('button');
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

// הוספת תמיכה בחיפוש בלחיצה על Enter
document.getElementById('searchInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    searchSong();
  }
});
