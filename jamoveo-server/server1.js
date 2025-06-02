const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// הגדרת session - מוסיפים את זה לפני כל ה-middleware האחרים
app.use(session({
  secret: 'jamoveo-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // שנה ל-true ב-production עם HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 שעות
  }
}));

// הגדרת MIME types
app.use((req, res, next) => {
  if (req.path.endsWith('.css')) {
    res.type('text/css');
  } else if (req.path.endsWith('.js')) {
    res.type('application/javascript');
  }
  next();
});

// הגדרת תיקיית הסטטיק
const publicPath = path.join(__dirname, "..", "public");
console.log("Public directory path:", publicPath);
app.use(express.static(publicPath));
app.use(express.json());

// משתנים גלובליים לניהול מצב האפליקציה
let currentSong = null;
let connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-session', (userData) => {
    connectedUsers.set(socket.id, userData);
    console.log(`User ${userData.username} joined as ${userData.role}`);
    
    // אם זה שחקן ויש שיר פעיל, שלח לו את השיר
    if (userData.role === 'player' && currentSong) {
      console.log(`Sending current song to player ${socket.id}:`, currentSong.song);
      socket.emit('song-selected', currentSong);
    }
  });

  // שליחת השיר הנוכחי למשתמש שמתחבר לדף ה-live
  socket.on('join-live', () => {
    console.log('User joined live page:', socket.id);
    const userData = connectedUsers.get(socket.id);
    if (currentSong) {
      console.log(`Sending current song to live page user ${socket.id}:`, currentSong.song);
      // שליחת השיר יחד עם ה-instrument של המשתמש
      socket.emit('song-selected', {
        ...currentSong,
        userInstrument: userData?.instrument || null
      });
    }
  });

  // בדיקת שיר פעיל עבור שחקנים שמתחברים
  socket.on('check-active-song', () => {
    console.log('Player checking for active song:', socket.id);
    if (currentSong) {
      console.log('Sending active song to player:', currentSong.song);
      socket.emit('active-song', currentSong);
    } else {
      console.log('No active song for player');
      socket.emit('active-song', null);
    }
  });

  socket.on('disconnect', () => {
    const userData = connectedUsers.get(socket.id);
    console.log(`User disconnected: ${socket.id}${userData ? ` (${userData.username})` : ''}`);
    console.log('Current song after disconnect:', currentSong ? currentSong.song : 'No song');
    
    connectedUsers.delete(socket.id);
  });
});

const USERS_FILE = path.join(__dirname, "users.json");

// פונקציות עזר לניהול משתמשים
function readUsersFile() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, "utf8");
  return data ? JSON.parse(data) : [];
}

function writeUsersFile(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// נתיבי API
app.post("/api/signup", (req, res) => {
  console.log("Received signup request:", req.body);
  const { username, password, instrument, isAdmin } = req.body;

  if (!username || !password || !instrument) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const users = readUsersFile();
  const userExists = users.find(u => u.username === username);
  
  if (userExists) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const newUser = { username, password, instrument, isAdmin: isAdmin || false };
  users.push(newUser);
  writeUsersFile(users);

  res.status(201).json({ message: "User registered successfully" });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const users = readUsersFile();
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  // שמירת המשתמש ב-session
  req.session.user = {
    username: user.username,
    instrument: user.instrument,
    role: user.isAdmin ? "admin" : "player"
  };

  res.json({ 
    message: "Login successful",
    role: req.session.user.role,
    instrument: user.instrument
  });
});

// middleware functions לבדיקת הרשאות
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// API endpoint ל-logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

// API endpoint לקבלת פרטי המשתמש הנוכחי
app.get("/api/current-user", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }
  res.json({ user: req.session.user });
});

// פונקציות עזר לסקרייפינג
const randomDelay = (min, max) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

async function humanBehavior(page) {
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 100);
  });
  await randomDelay(200, 500);
}

// פונקציה לסקרייפינג עם עקיפת חסימות
async function scrapeSongsFromTab4u(query) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920x1080',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    
    // הסתרת סימנים של Puppeteer
    await page.evaluateOnNewDocument(() => {
      // הסתרת navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      // הסתרת plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      
      // הסתרת languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['he-IL', 'he', 'en-US', 'en']
      });
    });

    // הגדרת User Agent מציאותי יותר
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // הגדרת cookies בסיסיים
    await page.setCookie({
      name: 'PHPSESSID',
      value: Math.random().toString(36).substring(7),
      domain: 'www.tab4u.com',
      path: '/'
    });

    // הגדרת headers נוספים
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    // קודם נבקר בדף הבית
    console.log('Visiting homepage...');
    await page.goto('https://www.tab4u.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // המתנה אקראית
    await randomDelay(2000, 4000);

    // חיפוש טופס החיפוש
    const searchInput = await page.$('input[type="text"], input[type="search"], input[name*="search"], input[id*="search"]');
    if (!searchInput) {
      console.log('Search input not found, trying direct URL...');
    } else {
      // מילוי טופס החיפוש
      await searchInput.type(query, { delay: 100 });
      await randomDelay(1000, 2000);
      
      // שליחת הטופס
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        searchInput.press('Enter')
      ]);
    }

    // אם לא מצאנו טופס, ננסה URL ישיר
    if (!searchInput) {
      const searchUrl = `https://www.tab4u.com/search?q=${encodeURIComponent(query)}`;
      console.log('Searching via direct URL:', searchUrl);
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    }

    // המתנה אקראית
    await randomDelay(2000, 4000);

    // שמירת ה-HTML לצורך דיבוג
    const html = await page.content();
    fs.writeFileSync('search-results.html', html);
    console.log('Saved search results HTML for debugging');

    // חיפוש תוצאות עם מספר selectors אפשריים
    const results = await page.evaluate(() => {
      const songs = [];
      
      // מערך של selectors אפשריים לתוצאות חיפוש
      const searchSelectors = [
        'table tr',
        '.search-result',
        '.song-item',
        'ul li a',
        '.results-list li',
        'tbody tr',
        'div.song',
        'div.result',
        'a[href*="song"]',
        'a[href*="tab"]',
        'a[href*="chord"]'
      ];

      // נסה כל selector
      for (const selector of searchSelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`Trying selector ${selector}, found ${elements.length} elements`);
        
        elements.forEach(element => {
          const linkElement = element.querySelector('a') || (element.tagName === 'A' ? element : null);
          
          if (linkElement && linkElement.href && (
              linkElement.href.includes('tab4u.com') || 
              linkElement.href.includes('/song/') || 
              linkElement.href.includes('/tab/') || 
              linkElement.href.includes('/chord/')
          )) {
            const text = linkElement.textContent.trim();
            
            // נסה לחלץ שם שיר ואמן
            let songName = '';
            let artist = '';
            
            // אם זה בתוך תא טבלה
            const cells = element.querySelectorAll('td');
            if (cells.length >= 2) {
              songName = cells[0].textContent.trim();
              artist = cells[1].textContent.trim();
            } else {
              // נסה לפרק לפי מקף או סימנים אחרים
              const parts = text.split(/[-–—]/).map(s => s.trim());
              if (parts.length >= 2) {
                artist = parts[0];
                songName = parts[1];
              } else {
                songName = text;
                artist = 'Unknown';
              }
            }
            
            if (songName && !songs.find(s => s.song === songName && s.artist === artist)) {
              songs.push({
                song: songName,
                artist: artist,
                link: linkElement.href,
                id: songs.length + 1
              });
            }
          }
        });
        
        if (songs.length > 0) {
          console.log(`Found ${songs.length} songs with selector ${selector}`);
          break;
        }
      }
      
      return songs.slice(0, 10); // מגביל ל-10 תוצאות
    });

    console.log(`Found ${results.length} songs for query: ${query}`);
    return results;

  } catch (error) {
    console.error('Scraping error:', error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// פונקציה משופרת לשליפת אקורדים של שיר ספציפי
async function fetchSongChords(songUrl) {
  let browser;
  try {
    console.log('🌐 Starting to fetch chords from:', songUrl);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920x1080',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    console.log('Browser launched successfully');

    const page = await browser.newPage();
    console.log('New page created');
    
    // הסתרת סימנים של Puppeteer
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ['he-IL', 'he', 'en-US', 'en']
      });
    });

    console.log('Puppeteer detection prevention applied');

    // הגדרת User Agent מציאותי
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // הגדרת cookies בסיסיים
    await page.setCookie({
      name: 'PHPSESSID',
      value: Math.random().toString(36).substring(7),
      domain: 'www.tab4u.com',
      path: '/'
    });

    console.log('Cookies and headers set');

    // הגדרת headers נוספים
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    console.log('Attempting to navigate to:', songUrl);
    
    // ניווט לעמוד עם זמן המתנה ארוך יותר
    const response = await page.goto(songUrl, {
      waitUntil: 'networkidle0',
      timeout: 45000
    });

    console.log('Page navigation response status:', response.status());
    
    if (response.status() !== 200) {
      console.error('Failed to load page, status:', response.status());
      throw new Error(`Failed to load page: ${response.status()}`);
    }

    console.log('Page loaded successfully');

    // המתנה נוספת לטעינת תוכן דינמי
    await randomDelay(3000, 5000);
    console.log('Additional delay completed');

    // שמירת HTML לדיבוג
    const html = await page.content();
    fs.writeFileSync('song-page.html', html);
    console.log('Saved song page HTML for debugging');

    console.log('🔍 Searching for chords on the page...');
    
    // חיפוש אקורדים בגישה ספציפית לtab4u
    const chords = await page.evaluate(() => {
      console.log('Starting chord search in page context');
      
      // חיפוש ספציפי לאלמנטים של tab4u
      const songContentElement = document.getElementById('songContentTPL');
      if (songContentElement) {
        console.log('Found songContentTPL element');
        const text = songContentElement.innerText || songContentElement.textContent;
        if (text && text.length > 50) {
          console.log('Found chords in songContentTPL:', text.length, 'chars');
          return text.trim();
        }
      }
      
      // חיפוש טבלאות עם class="song" או "chords"
      const tables = document.querySelectorAll('table');
      let allContent = '';
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td.song, td.chords, td.tabs');
          for (const cell of cells) {
            const text = cell.innerText || cell.textContent;
            if (text && text.trim()) {
              allContent += text.trim() + '\n';
            }
          }
        }
      }
      
      if (allContent.length > 50) {
        console.log('Found chords in table cells:', allContent.length, 'chars');
        return allContent.trim();
      }
      
      // מערך מורחב של selectors לאקורדים
      const chordSelectors = [
        // סלקטורים ספציפיים לtab4u
        '#songContentTPL',
        '.song_block_content',
        '.song_content',
        '.song-content', 
        '.tab-content',
        '.chords-content',
        '#chords_content',
        '#chordDisplayArea',
        '.chordDisplayArea',
        'td.song',
        'td.chords',
        'td.tabs',
        
        // סלקטורים כלליים
        'pre.chords',
        'div.chords',
        'pre#chords',
        'div#chords',
        'pre',
        'div.content',
        'div.lyrics',
        'div.song-text',
        '.chords-lyrics',
        '.lyrics-chords',
        
        // סלקטורים נוספים
        'textarea',
        '.chord-sheet',
        '.song-sheet',
        'code',
        '.monospace',
        
        // סלקטורים עבור iframe אם קיים
        'iframe[src*="chord"]',
        'iframe[src*="tab"]'
      ];

      let foundChords = null;
      let bestMatch = '';
      let bestScore = 0;

      for (const selector of chordSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          console.log(`Trying selector ${selector}, found ${elements.length} elements`);
          
          for (const element of elements) {
            let text = '';
            
            // אם זה iframe, נסה לגשת לתוכן שלו
            if (element.tagName === 'IFRAME') {
              try {
                const iframeDoc = element.contentDocument || element.contentWindow.document;
                text = iframeDoc.body.textContent || iframeDoc.body.innerText || '';
                console.log('Found iframe content, length:', text.length);
              } catch (e) {
                console.log('Cannot access iframe content:', e.message);
                continue;
              }
            } else {
              text = element.textContent || element.innerText || '';
            }
            
            text = text.trim();
            
            if (!text || text.length < 20) {
              console.log(`Element with selector ${selector} has insufficient text (length: ${text.length})`);
              continue;
            }
            
            // חישוב ציון לטקסט על בסיס תכונות שמעידות על אקורדים
            let score = 0;
            
            // בדיקות לאקורדים
            const chordPatterns = [
              /\b[A-G][#b]?m?[0-9]?\b/g, // אקורדים בסיסיים
              /\[[A-G][#b]?m?[0-9]?\]/g, // אקורדים בסוגריים מרובעים
              /\b[A-G][#b]?m?(maj|min|sus|add|dim|aug)[0-9]?\b/g, // אקורדים מורכבים
            ];
            
            for (const pattern of chordPatterns) {
              const matches = text.match(pattern);
              if (matches) {
                score += matches.length * 2;
                console.log(`Found ${matches.length} chord matches with pattern ${pattern}`);
              }
            }
            
            // בדיקות נוספות
            if (text.includes('[') && text.includes(']')) {
              score += 10;
              console.log('Found square brackets');
            }
            if (text.includes('Verse') || text.includes('Chorus') || text.includes('Bridge') || 
                text.includes('פזמון') || text.includes('בית') || text.includes('גשר')) {
              score += 5;
              console.log('Found section markers');
            }
            if (text.includes('\n') && text.length > 100) {
              score += 5;
              console.log('Found multiple lines');
            }
            if (/^[A-G]/.test(text.split('\n')[0])) {
              score += 3;
              console.log('Line starts with chord');
            }
            
            // העדפה לטקסט ארוך יותר (עד גבול מסוים)
            if (text.length > 200 && text.length < 10000) {
              score += Math.min(text.length / 100, 10);
              console.log('Text length score added');
            }
            
            console.log(`Element with selector ${selector} scored ${score} points (length: ${text.length})`);
            
            if (score > bestScore && score > 5) {
              bestScore = score;
              bestMatch = text;
              foundChords = element;
              console.log(`New best match found with score ${score}`);
            }
          }
        } catch (e) {
          console.log(`Error with selector ${selector}:`, e.message);
        }
      }
      
      if (foundChords) {
        console.log(`Best match found with score ${bestScore}, length: ${bestMatch.length}`);
        return bestMatch;
      }
      
      console.log('No good matches found, trying body text search');
      
      // אם לא מצאנו כלום, ננסה לחפש בכל הטקסט של העמוד
      const bodyText = document.body.textContent || document.body.innerText || '';
      if (bodyText && bodyText.length > 500) {
        const lines = bodyText.split('\n').filter(line => line.trim().length > 0);
        const chordsLines = lines.filter(line => {
          return /\b[A-G][#b]?m?[0-9]?\b/.test(line) || 
                 (line.includes('[') && line.includes(']'));
        });
        
        if (chordsLines.length > 5) {
          console.log(`Found ${chordsLines.length} chord lines in body text`);
          return chordsLines.join('\n');
        }
      }
      
      console.log('No chords found in body text either');
      return null;
    });

    if (chords && chords.length > 50) {
      console.log('✅ Successfully found chords (length:', chords.length, 'characters)');
      console.log('First 200 characters of chords:', chords.substring(0, 200));
      return chords;
    } else {
      console.log('⚠️ No quality chords found on the page');
      
      // ננסה גישה אלטרנטיבית - חיפוש לינקים לאקורדים
      const alternativeLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="chord"], a[href*="tab"], a[href*="lyric"]'));
        return links.map(link => ({
          href: link.href,
          text: link.textContent.trim()
        }));
      });
      
      if (alternativeLinks.length > 0) {
        console.log('Found alternative chord links:', alternativeLinks);
        return `Alternative chord links found: ${alternativeLinks.map(link => link.text).join(', ')}`;
      }
      
      return null;
    }

  } catch (error) {
    console.error('❌ Error fetching chords:', error.message);
    console.error('Error stack:', error.stack);
    
    // אם יש שגיאת timeout, ננסה עם הגדרות שונות
    if (error.message.includes('timeout')) {
      console.log('🔄 Retrying with different settings...');
      return await fetchSongChordsSimple(songUrl);
    }
    
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

// פונקציה פשוטה יותר כגיבוי
async function fetchSongChordsSimple(songUrl) {
  let browser;
  try {
    console.log('🔄 Trying simple approach for:', songUrl);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(songUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const chords = await page.evaluate(() => {
      // חיפוש פשוט יותר
      const possibleElements = document.querySelectorAll('pre, div, p, textarea');
      for (const element of possibleElements) {
        const text = element.textContent || '';
        if (text.length > 100 && (/\b[A-G][#b]?m?\b/.test(text) || text.includes('['))) {
          return text.trim();
        }
      }
      return null;
    });

    return chords;
  } catch (error) {
    console.error('Simple fetch also failed:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// API endpoint לחיפוש שירים
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    console.log('🔍 Starting search for:', query);
    
    // חיפוש שירים מtab4u
    const results = await scrapeSongsFromTab4u(query);
    
    res.json({ 
      results: results,
      source: 'tab4u',
      message: results.length > 0 
        ? `Found ${results.length} songs for "${query}"` 
        : `No songs found for "${query}"`
    });
    
  } catch (error) {
    console.error('❌ Search error:', error.message);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

/// פונקציה משופרת לעיבוד ועיצוב האקורדים
function processChords(rawChords) {
  console.log('🎵 Processing chords...');
  console.log('📝 Raw chords length:', rawChords.length);
  console.log(' First 500 chars:', rawChords.substring(0, 500));

  // ניקוי קוד JavaScript ופרסומות
  const cleanChords = rawChords
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // הסרת תגיות script
      .replace(/var\s+_gaq\s*=\s*_gaq\s*\|\|\s*\[\];.*?\(\);\s*/gs, '') // הסרת קוד Google Analytics
      .replace(/\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\{\}\);/g, '') // הסרת קוד פרסומות
      .replace(/<ins\b[^<]*(?:(?!<\/ins>)<[^<]*)*<\/ins>/gi, '') // הסרת תגיות ins (פרסומות)
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // הסרת תגיות iframe
      .replace(/<div\s+class="ads?[^"]*"[^>]*>.*?<\/div>/gis, '') // הסרת div של פרסומות
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // הסרת תגיות style
      .replace(/<!--.*?-->/gs, '') // הסרת הערות HTML
      .replace(/<[^>]*>/g, '') // הסרת כל תגיות HTML שנותרו
      .replace(/&nbsp;/g, ' ') // החלפת &nbsp; ברווח
      .replace(/&amp;/g, '&') // החלפת &amp;
      .replace(/&lt;/g, '<') // החלפת &lt;
      .replace(/&gt;/g, '>') // החלפת &gt;
      .replace(/[ \t]+/g, ' ') // ניקוי רווחים מיותרים (אבל לא שורות חדשות!)
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // הסרת שורות ריקות מיותרות
      .trim();

  console.log('🧹 Cleaned chords length:', cleanChords.length);
  console.log('🔍 First 500 chars after cleaning:', cleanChords.substring(0, 500));

  // פיצול השורות וניקוי נוסף
  const lines = cleanChords.split('\n');
  
  // הפרדה בין אקורדים למילים ושמירה על הפורמט
  const processedLines = [];
  let lyrics = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // אם השורה ריקה, שמור אותה כדי לשמור על הריווח
    if (line === '') {
      processedLines.push('');
      continue;
    }
    
    // זיהוי שורת אקורדים - אם השורה מכילה בעיקר אקורדים
    const chordMatches = line.match(/\b[A-G][#b]?m?(sus|maj|min|dim|aug|add)?[0-9]?[/]?[A-G]?\b/g) || [];
    const wordMatches = line.match(/\b[א-ת\w]{3,}\b/g) || [];
    
    const isChordLine = chordMatches.length > 0 && 
                        (chordMatches.length > wordMatches.length || 
                         line.length < 50 ||
                         chordMatches.length >= 2);
    
    processedLines.push(line);
    
    // אם זו לא שורת אקורדים, הוסף גם למילים
    if (!isChordLine && line.length > 0) {
      lyrics.push(line);
    }
  }
  
  // יצירת הטקסט הסופי עם שמירה על פורמט השורות
  const finalChords = processedLines.join('\n');
  const finalLyrics = lyrics.join('\n');
  
  console.log('✅ Processed chords successfully');
  console.log('📊 Final chords length:', finalChords.length);
  console.log('📝 Lyrics extracted:', finalLyrics.length > 0 ? 'Yes' : 'No');
  
  return {
    chords: finalChords,
    lyrics: finalLyrics
  };
}

// עדכון נקודת הקצה לבחירת שיר - רק אדמין יכול לבחור שירים
app.post('/api/select-song', requireAdmin, async (req, res) => {
  try {
    const { song, artist, url } = req.body;
    console.log('🎵 Song selected:', { song, artist, url });
    
    // עדכון השיר הנוכחי
    currentSong = { song, artist, url };
    console.log('✅ currentSong updated:', currentSong);
    
    // שליפת האקורדים
    console.log('🔍 Fetching chords from:', url);
    
    let rawChords = null;
    try {
      // נסה קודם עם הפונקציה המלאה
      rawChords = await fetchSongChords(url);
    } catch (error) {
      console.log('Main fetch failed, trying simple approach:', error.message);
      // אם נכשל, נסה עם הגרסה הפשוטה
      rawChords = await fetchSongChordsSimple(url);
    }
    
    if (rawChords) {
      // עיבוד האקורדים
      const processed = processChords(rawChords);
      currentSong.chords = processed.chords;
      currentSong.lyrics = processed.lyrics;
      currentSong.hasChords = true;
      console.log('📝 Chords found and processed');
    } else {
      currentSong.chords = 'Chords not available';
      currentSong.hasChords = false;
      console.log('❌ No chords found');
    }
    
    // שליחת השיר לכל המחוברים
    console.log('📡 Broadcasting song to all connected clients');
    io.emit('song-selected', currentSong);
    
    res.json({
      success: true,
      song: currentSong,
      message: 'Song selected successfully'
    });
  } catch (error) {
    console.error('❌ Error selecting song:', error);
    currentSong = null;
    res.status(500).json({
      success: false,
      message: 'Failed to select song'
    });
  }
});

// API endpoint לבדיקת URL ספציפי - לצורכי דיבוג
app.get('/api/debug-url', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    console.log('🔍 Debug: Testing URL:', url);
    
    const rawChords = await fetchSongChords(url);
    console.log('Debug: Raw chords length:', rawChords ? rawChords.length : 0);
    
    let processedChords = null;
    if (rawChords) {
      processedChords = processChords(rawChords);
    }
    
    res.json({
      url,
      success: !!rawChords,
      rawChordsLength: rawChords ? rawChords.length : 0,
      rawChordsPreview: rawChords ? rawChords.substring(0, 200) + '...' : null,
      processedSuccess: !!processedChords,
      processedChordsLength: processedChords ? processedChords.chords.length : 0,
      processedChordsPreview: processedChords ? processedChords.chords.substring(0, 200) + '...' : null
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.json({
      url,
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// נתיב לקבלת השיר הנוכחי
app.get('/api/current-song', (req, res) => {
  console.log('Current song requested, currentSong state:', currentSong ? 'exists' : 'null');
  res.json({
    success: true,
    currentSong: currentSong,
    hasActiveSong: !!currentSong
  });
});

// נתיב ליציאה מהשיר - רק אדמין יכול לסיים שיר
app.post('/api/quit-song', requireAdmin, (req, res) => {
  console.log('🚪 Quitting current song');
  currentSong = null;
  
  // שלח לכל המחוברים שהשיר הסתיים
  io.emit('song-quit');
  
  res.json({ success: true });
});

// הפעלת השרת
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('✅ Socket.IO server is ready for connections');
  console.log('📁 Public directory:', publicPath);
});