document.getElementById("hire-btn").addEventListener("click", (e) => {
  e.preventDefault();
  const link = document.getElementById("hire-btn");
  const md = link.dataset.md;
  navigator.clipboard.writeText(md).then(() => {
    link.textContent = "copied, cool";
    setTimeout(() => {
      link.textContent = "copy source";
    }, 2000);
  }).catch(() => {
    link.textContent = "copy failed";
    setTimeout(() => {
      link.textContent = "copy source";
    }, 2000);
  });
});
