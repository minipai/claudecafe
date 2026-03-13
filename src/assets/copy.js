document.getElementById("hire-btn").addEventListener("click", () => {
  const btn = document.getElementById("hire-btn");
  const md = btn.dataset.md;
  navigator.clipboard.writeText(md).then(() => {
    btn.textContent = "copied, cool";
    setTimeout(() => {
      btn.textContent = "copy source";
    }, 2000);
  }).catch(() => {
    btn.textContent = "copy failed";
    setTimeout(() => {
      btn.textContent = "copy source";
    }, 2000);
  });
});
