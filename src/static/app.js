document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const signupContainer = document.getElementById("signup-container");

  const userMenuButton = document.getElementById("user-menu-button");
  const userMenuPanel = document.getElementById("user-menu-panel");
  const authStatus = document.getElementById("auth-status");
  const openLoginBtn = document.getElementById("open-login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginBtn = document.getElementById("cancel-login-btn");
  const teacherUsername = document.getElementById("teacher-username");
  const teacherPassword = document.getElementById("teacher-password");

  let authToken = localStorage.getItem("teacherAuthToken") || "";
  let teacherName = localStorage.getItem("teacherUsername") || "";

  function authHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const loggedIn = Boolean(authToken);

    authStatus.textContent = loggedIn
      ? `Logged in as ${teacherName}`
      : "Not logged in";

    openLoginBtn.classList.toggle("hidden", loggedIn);
    logoutBtn.classList.toggle("hidden", !loggedIn);

    signupContainer.classList.toggle("locked", !loggedIn);

    signupForm.querySelectorAll("input, select, button").forEach((el) => {
      el.disabled = !loggedIn;
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        authToken
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}" title="Unregister student">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!authToken) {
      showMessage("Teacher login required to unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          authToken = "";
          teacherName = "";
          localStorage.removeItem("teacherAuthToken");
          localStorage.removeItem("teacherUsername");
          updateAuthUI();
          fetchActivities();
        }

        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
      showMessage("Teacher login required to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          authToken = "";
          teacherName = "";
          localStorage.removeItem("teacherAuthToken");
          localStorage.removeItem("teacherUsername");
          updateAuthUI();
          fetchActivities();
        }

        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuButton.addEventListener("click", () => {
    userMenuPanel.classList.toggle("hidden");
  });

  openLoginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    teacherUsername.focus();
  });

  cancelLoginBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: teacherUsername.value,
          password: teacherPassword.value,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed.", "error");
        return;
      }

      authToken = result.token;
      teacherName = result.username;
      localStorage.setItem("teacherAuthToken", authToken);
      localStorage.setItem("teacherUsername", teacherName);
      loginModal.classList.add("hidden");
      loginForm.reset();
      updateAuthUI();
      fetchActivities();
      showMessage(`Welcome, ${teacherName}.`, "success");
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (!authToken) {
      return;
    }

    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    authToken = "";
    teacherName = "";
    localStorage.removeItem("teacherAuthToken");
    localStorage.removeItem("teacherUsername");
    updateAuthUI();
    fetchActivities();
    showMessage("Logged out.", "info");
  });

  document.addEventListener("click", (event) => {
    if (!userMenuPanel.contains(event.target) && event.target !== userMenuButton) {
      userMenuPanel.classList.add("hidden");
    }

    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginForm.reset();
    }
  });

  async function restoreSession() {
    if (!authToken) {
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: authHeaders(),
      });

      if (!response.ok) {
        authToken = "";
        teacherName = "";
        localStorage.removeItem("teacherAuthToken");
        localStorage.removeItem("teacherUsername");
      }
    } catch (error) {
      authToken = "";
      teacherName = "";
      localStorage.removeItem("teacherAuthToken");
      localStorage.removeItem("teacherUsername");
    }

    updateAuthUI();
  }

  // Initialize app
  restoreSession().then(fetchActivities);
});
