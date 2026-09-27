;(function () {
  // The maid page's portrait floats beside Vibe, but the text from there on is
  // taller than she is. Lower her by that difference so her knee-high cut sits
  // on the paper's bottom edge; with shape-outside, the text flows back to full
  // width in the space above her.
  var stand = document.querySelector('.maid-stand')
  if (!stand) return

  function settle() {
    lower(0)
    if (getComputedStyle(stand).float === 'none') return

    // Text reflows a whole line at a time as she moves, so no drop lands
    // exactly; find the smallest one that leaves no text below her.
    var lo = 0
    var hi = Math.max(0, gap()) + 100
    while (hi - lo > 1) {
      var mid = (lo + hi) / 2
      lower(mid)
      if (gap() > 0) lo = mid
      else hi = mid
    }
    lower(hi)
  }

  function lower(drop) {
    stand.style.marginTop = drop ? 'calc(1rem + ' + drop + 'px)' : ''
  }

  function gap() {
    return textBottom() - standBottom()
  }

  function textBottom() {
    var last = stand.parentElement.lastElementChild
    var margin = parseFloat(getComputedStyle(last).marginBottom)
    return last.getBoundingClientRect().bottom + margin
  }

  // Her negative bottom margin pulls the paper's padding under her, so she
  // lines up with the text's bottom plus that padding.
  function standBottom() {
    var margin = parseFloat(getComputedStyle(stand).marginBottom)
    return stand.getBoundingClientRect().bottom + margin
  }

  settle()
  window.addEventListener('load', settle)
  window.addEventListener('resize', settle)
})()
