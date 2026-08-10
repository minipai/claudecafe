;(function () {
  // Only homepage needs the hover-switching logic
  var rows = document.querySelectorAll('.maid-row[data-maid]')
  if (!rows.length) return

  var slugs = ['kanae', 'kokona', 'kotone', 'kuroko', 'kurumi']
  var index = Math.floor(Math.random() * slugs.length)
  var current = null
  var pending = null
  var hovered = false
  var timer = null
  var INTERVAL = 5000

  function setActiveRow(slug) {
    rows.forEach(function (r) {
      if (r.getAttribute('data-maid') === slug) {
        r.classList.add('active')
      } else {
        r.classList.remove('active')
      }
    })
  }

  function setMaid(slug) {
    if (slug === current && !pending) return
    pending = slug
    setActiveRow(slug)
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

  function nextMaid() {
    index = (index + 1) % slugs.length
    setMaid(slugs[index])
  }

  function startRotation() {
    stopRotation()
    timer = setInterval(nextMaid, INTERVAL)
  }

  function stopRotation() {
    if (timer) { clearInterval(timer); timer = null }
  }

  // Wait 5s before starting rotation (no default background)
  setTimeout(function () {
    if (!hovered) {
      setMaid(slugs[index])
      startRotation()
    }
  }, INTERVAL)

  var hoverTimer = null

  rows.forEach(function (row) {
    var slug = row.getAttribute('data-maid')
    function activate() {
      hovered = true
      stopRotation()
      if (hoverTimer) clearTimeout(hoverTimer)
      hoverTimer = setTimeout(function () {
        setMaid(slug)
        hoverTimer = null
      }, 100)
    }
    function focusActivate() {
      hovered = true
      stopRotation()
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
      setMaid(slug)
    }
    function deactivate() {
      hovered = false
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
      index = slugs.indexOf(current)
      startRotation()
    }
    row.addEventListener('mouseenter', activate)
    row.addEventListener('mouseleave', deactivate)
    row.addEventListener('focus', focusActivate)
    row.addEventListener('blur', deactivate)
  })
})()
