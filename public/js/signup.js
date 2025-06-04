document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const user = {
    username: form.username.value,
    password: form.password.value,
    instrument: form.instrument.value,
    isAdmin: form.admin?.checked || false  // תומך בתיבת סימון של אדמין אם קיימת
  };

  // Get the current origin (domain) of the page
  const apiUrl = window.location.origin + "/api/signup";

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  });

  const result = await res.json();

  if (res.ok) {
    alert("Signup successful!");

    // Save user data for later use
    sessionStorage.setItem("username", user.username);
    sessionStorage.setItem("instrument", user.instrument);
    sessionStorage.setItem("isAdmin", user.isAdmin);

    // Redirect based on role
    if (user.isAdmin) {
      window.location.href = "admin.html";
    } else {
      window.location.href = "player.html";
    }

  } else {
    alert("Error: " + result.message);
  }
});
