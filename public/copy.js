document.getElementById("hire-btn").addEventListener("click", (e) => {
  e.preventDefault();
  const md = document.getElementById("hire-btn").dataset.md;
  navigator.clipboard.writeText(md).then(() => {
    const link = document.getElementById("hire-btn");
    link.textContent = "copied, cool";
    setTimeout(() => {
      link.textContent = "copy source";
    }, 2000);
  });
});
