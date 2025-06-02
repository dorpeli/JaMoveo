Project Summary: JaMoveo Web Application
JaMoveo is a real-time, collaborative web application designed for musicians within the Moveo team, allowing them to enhance their group rehearsal experience through technology. The platform supports players and admins, offering synchronized access to songs.
Key Features
•	User Registration & Authentication
o	Users can sign up by providing a username, password, and the instrument they play.
o	Admins register through a dedicated URL to distinguish their role.
o	Session-based login authentication ensures secure access to different pages and roles.
•	Session Management
o	Admins can initiate a rehearsal session.
o	Musicians can join sessions and will be updated in real-time when a new song is selected.
o	Real-time communication is implemented via Socket.IO for instant broadcasting of song updates to all connected users.
•	Song Search & Display
o	Admins can search for songs in Hebrew or English using an intuitive search interface.
o	Songs are retrieved dynamically through web scraping from Tab4U using Puppeteer, bypassing anti-bot measures and simulating human-like behavior.
o	The selected song is processed to extract clean, readable lyrics and chords using custom parsing logic.
•	Live Display Mode
o	Once a song is selected, all users are taken to a Live Page:
	Vocalists see only the lyrics.
	Instrumentalists see lyrics with chords.
o	A floating toggle button controls auto-scrolling for hands-free navigation.
o	Visuals are optimized for rehearsal environments (e.g., large fonts and high contrast).
•	Admin Control
o	Admins can quit a session at any time, returning all users to the waiting page.
o	A debug mode is available for testing specific URLs.
Technical Stack
•	Backend: Node.js with Express.js
•	Frontend: Static HTML/CSS/JS (not included here)
•	Database: Local JSON file for user persistence
•	Real-Time: Socket.IO
•	Web Scraping: Puppeteer for song data extraction from Tab4U
