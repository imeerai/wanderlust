document.addEventListener("DOMContentLoaded", () => {

  // ----------- FORM IDENTIFICATION ------------
  const listingForm = document.getElementById("listingForm");
  const registerForm = document.getElementById("authRegisterForm");
  const loginForm = document.getElementById("authLoginForm");

  let form = listingForm || registerForm || loginForm;
  if (!form) return;

  // ----------- FIELD SETS BASED ON FORM TYPE ------------

  let requiredFields = {};
  let optionalField = {};

  // Listing Form
  if (form.id === "listingForm") {
    requiredFields = {
      "listing[title]": "Title",
      "listing[location]": "Location",
      "listing[description]": "Description",
      "listing[prize]": "Prize",
      "listing[country]": "Country",
    };

    optionalField = {
      "listing[image]": "Image URL"
    };
  }

  // Register Form
  else if (form.id === "authRegisterForm") {
    requiredFields = {
      "user[username]": "Username",
      "user[email]": "Email",
      "user[password]": "Password"
    };
  }

  // Login Form
  else if (form.id === "authLoginForm") {
    requiredFields = {
      "user[username]": "Username",
      "user[password]": "Password"
    };
  }


  // ----------- CUSTOM VALIDATION RULES ------------

  function validateUsername(value) {
    const regex = /^[a-z0-9._]+$/; // only small + numbers + . _
    return regex.test(value) && value.length >= 4;
  }

  function validateEmail(value) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value);
  }

  function validatePassword(value) {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    return regex.test(value);
  }

  // ----------- VALIDATION FUNCTION ------------

  function validateField(input, fieldName, isRequired) {
    const wrapper = input.closest(".field-wrapper");
    const msg = wrapper.querySelector(".hellow");
    const value = input.value.trim();

    input.classList.remove("valid", "error");
    msg.classList.remove("green-text");
    msg.textContent = "";

    // Required validation
    if (isRequired && value === "") {
      input.classList.add("error");
      msg.textContent = `${fieldName} is required.`;
      return false;
    }

    // Form-specific validations
    if (input.name === "user[username]" && value !== "") {
      if (!validateUsername(value)) {
        input.classList.add("error");
        msg.textContent =
          "Username: only lowercase, numbers, . and _ allowed. No spaces. Min 4 chars.";
        return false;
      }
    }

    if (input.name === "user[email]" && value !== "") {
      if (!validateEmail(value)) {
        input.classList.add("error");
        msg.textContent = "Invalid email format (example@example.com).";
        return false;
      }
    }

    if (input.name === "user[password]" && value !== "") {
      if (!validatePassword(value)) {
        input.classList.add("error");
        msg.textContent =
        "Password must be 8+ chars and include alphabet, number, and special symbol.";
        return false;
      }
    }

    // Optional: empty → valid
    if (!isRequired && value === "") {
      input.classList.add("valid");
      msg.textContent = "Optional";
      msg.classList.add("green-text");
      return true;
    }

    // Passed
    input.classList.add("valid");
    return true;
  }


  // ----------- LIVE VALIDATION ------------
  form.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("input", () => {
      const name = input.name;

      if (requiredFields[name]) {
        validateField(input, requiredFields[name], true);
      } else if (optionalField[name]) {
        validateField(input, optionalField[name], false);
      }
    });
  });


  // ----------- SUBMIT VALIDATION ------------
  form.addEventListener("submit", (e) => {
    let isValid = true;

    // Required fields
    for (let name in requiredFields) {
      const input = form.querySelector(`[name="${name}"]`);
      if (!validateField(input, requiredFields[name], true)) {
        isValid = false;
      }
    }

    // Optional fields
    for (let name in optionalField) {
      const input = form.querySelector(`[name="${name}"]`);
      validateField(input, optionalField[name], false);
    }

    if (!isValid) e.preventDefault();
  });

});


// ----------- FLASH MESSAGE AUTO HIDE ------------
const messages = document.querySelectorAll('.flash, .erroor');

messages.forEach(msg => {
  setTimeout(() => {
    msg.classList.remove('show');
    setTimeout(() => {
      msg.style.display = "none";
    }, 400);
  }, 2000);
});

// ----------- NAVBAR INTERACTIONS ------------
    // Profile dropdown
    const profileBtn = document.getElementById('profileToggle');
    const dropdown = document.getElementById('dropdownMenu');

    if (profileBtn) {
        profileBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', function () {
            if (dropdown) dropdown.style.display = 'none';
        });
    }

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');

    mobileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileNav.style.display = mobileNav.style.display === 'flex' ? 'none' : 'flex';
    });

    // Close mobile nav on click outside
    document.addEventListener('click', function (e) {
        if (!mobileNav.contains(e.target) && !mobileBtn.contains(e.target)) {
            mobileNav.style.display = 'none';
        }
    });



