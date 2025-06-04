document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const user = {
    username: form.username.value,
    password: form.password.value
  };

  // Get the current origin (domain) of the page
  const apiUrl = window.location.origin + "/api/login";

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  });

  const result = await res.json();
  if (res.ok) {
    // Save user data for later use
    sessionStorage.setItem("username", user.username);
    sessionStorage.setItem("instrument", result.instrument);
    sessionStorage.setItem("isAdmin", result.role === "admin");

    // Redirect based on role
    if (result.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "player.html";
    }
  } else {
    alert("Error: " + result.message);
  }
});
