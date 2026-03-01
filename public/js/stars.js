const stars = document.querySelectorAll(".star-rating .star");
const ratingInput = document.querySelector(".review-rating");

stars.forEach((star) => {
  star.addEventListener("mouseover", () => {
    const value = star.dataset.value;
    stars.forEach((s) =>
      s.classList.toggle("hovered", s.dataset.value <= value)
    );
  });
  star.addEventListener("mouseout", () => {
    stars.forEach((s) => s.classList.remove("hovered"));
  });
  star.addEventListener("click", () => {
    const value = star.dataset.value;
    ratingInput.value = value;
    stars.forEach((s) =>
      s.classList.toggle("filled", s.dataset.value <= value)
    );
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const stars = document.querySelectorAll(".star-rating .star");
  const ratingInput = document.querySelector(".review-rating");
  const reviewInput = document.querySelector(".review-text-input");
  const errorMsgStars = document.querySelector(".stars-error");
  const errorMsgComment = document.querySelector(".review-error-msg");

  // --- STAR SELECTION ---
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      const value = star.getAttribute("data-value");
      ratingInput.value = value;

      // reset stars
      stars.forEach((s) => s.classList.remove("filled", "error-star"));

      // fill selected stars
      stars.forEach((s) => {
        if (s.getAttribute("data-value") <= value) {
          s.classList.add("filled");
        }
      });

      // clear star error
      errorMsgStars.textContent = "";
    });
  });

  const form = document.querySelector(".add-review-form");

  form.addEventListener("submit", (e) => {
    let valid = true;

    if (Number(ratingInput.value) === 0) {
      valid = false;
      stars.forEach((s) => s.classList.add("error-star"));
      errorMsgStars.textContent = "Please give a star rating!";
    }

    if (reviewInput.value.trim() === "") {
      valid = false;
      reviewInput.classList.add("input-error");
      reviewInput.placeholder = "Please leave some comment!";
      errorMsgComment.textContent = "";
    }

    if (!valid) e.preventDefault();
  });

  reviewInput.addEventListener("input", () => {
    reviewInput.classList.remove("input-error");
  });
});
