;(function () {
  var defaultSlug = 'kuroko'
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

  // Maid page — set immediately
  var page = document.querySelector('[data-maid-page]')
  if (page) {
    document.body.dataset.maid = page.getAttribute('data-maid-page')
    return
  }

  // Homepage hover
  var rows = document.querySelectorAll('.maid-row[data-maid]')
  rows.forEach(function (row) {
    var slug = row.getAttribute('data-maid')
    row.addEventListener('mouseenter', function () { setMaid(slug) })
    row.addEventListener('mouseleave', function () { setMaid(defaultSlug) })
  })
})()
