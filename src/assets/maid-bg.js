;(function () {
  // Only homepage needs the hover-switching logic
  var rows = document.querySelectorAll('.maid-row[data-maid]')
  if (!rows.length) return

  var slugs = ['claudia', 'codex', 'kokona', 'kotone', 'kuroko', 'kurumi']
  var defaultSlug = slugs[Math.floor(Math.random() * slugs.length)]
  document.body.dataset.maid = defaultSlug
  var current = defaultSlug
  var pending = null

  function setMaid(slug) {
    if (slug === current && !pending) return
    pending = slug
    document.body.classList.add('maid-fading')

    setTimeout(function () {
      if (pending) {
        document.body.dataset.maid = pending
        current = pending
        pending = null
      }
      document.body.classList.remove('maid-fading')
    }, 300)
  }

  rows.forEach(function (row) {
    var slug = row.getAttribute('data-maid')
    row.addEventListener('mouseenter', function () { setMaid(slug) })
    row.addEventListener('mouseleave', function () { setMaid(defaultSlug) })
  })
})()
