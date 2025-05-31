document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const user = {
    username: form.username.value,
    password: form.password.value
  };

  const res = await fetch("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  });

  const result = await res.json();
  if (res.ok) {
    // שמירת נתוני המשתמש לשימוש בהמשך
    sessionStorage.setItem("username", user.username);
    sessionStorage.setItem("instrument", result.instrument);
    sessionStorage.setItem("isAdmin", result.role === "admin");

    // ניתוב לפי תפקיד
    if (result.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "player.html";
    }
  } else {
    alert("Error: " + result.message);
  }
});
