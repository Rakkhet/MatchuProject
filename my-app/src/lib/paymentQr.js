function createSeed(text) {
  return String(text || '').split('').reduce(function(total, char, index) {
    return (total * 131 + char.charCodeAt(0) + index) % 2147483647
  }, 7)
}

function isInsideFinder(row, col, startRow, startCol) {
  return row >= startRow && row < startRow + 7 && col >= startCol && col < startCol + 7
}

function isFinderFilled(row, col, startRow, startCol) {
  var innerRow = row - startRow
  var innerCol = col - startCol
  var onOuterRing = innerRow === 0 || innerRow === 6 || innerCol === 0 || innerCol === 6
  var onInnerBlock = innerRow >= 2 && innerRow <= 4 && innerCol >= 2 && innerCol <= 4

  return onOuterRing || onInnerBlock
}

function shouldFillQrCell(row, col, size, seed) {
  if (isInsideFinder(row, col, 0, 0)) {
    return isFinderFilled(row, col, 0, 0)
  }

  if (isInsideFinder(row, col, 0, size - 7)) {
    return isFinderFilled(row, col, 0, size - 7)
  }

  if (isInsideFinder(row, col, size - 7, 0)) {
    return isFinderFilled(row, col, size - 7, 0)
  }

  if (row === 6 || col === 6) {
    return (row + col) % 2 === 0
  }

  var value = seed + row * 17 + col * 29 + row * col * 3
  return value % 7 < 3 || value % 11 === 0
}

export function createPaymentReference(userId) {
  var now = new Date()
  var year = String(now.getFullYear()).slice(-2)
  var month = String(now.getMonth() + 1).padStart(2, '0')
  var day = String(now.getDate()).padStart(2, '0')
  var hours = String(now.getHours()).padStart(2, '0')
  var minutes = String(now.getMinutes()).padStart(2, '0')
  var seconds = String(now.getSeconds()).padStart(2, '0')
  var millis = String(now.getMilliseconds()).padStart(3, '0')
  var userPart = String(userId || 0).padStart(3, '0')

  return 'GM-' + userPart + '-' + year + month + day + hours + minutes + seconds + millis
}

export function createSimulatedQrCodeDataUrl(options) {
  var reference = String(options && options.reference || '')
  var amountLabel = String(options && options.amountLabel || '')
  var accountLabel = String(options && options.accountLabel || '')
  var size = 25
  var cellSize = 8
  var padding = 14
  var seed = createSeed(reference + '|' + amountLabel + '|' + accountLabel)
  var rects = []

  for (var row = 0; row < size; row += 1) {
    for (var col = 0; col < size; col += 1) {
      if (!shouldFillQrCell(row, col, size, seed)) {
        continue
      }

      rects.push(
        '<rect x="' + (padding + col * cellSize) + '" y="' + (padding + row * cellSize) + '" width="' + cellSize + '" height="' + cellSize + '" rx="1" fill="#111111" />'
      )
    }
  }

  var totalSize = padding * 2 + size * cellSize
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + totalSize + '" height="' + totalSize + '" viewBox="0 0 ' + totalSize + ' ' + totalSize + '">',
    '<rect width="' + totalSize + '" height="' + totalSize + '" rx="24" fill="#f9f8f2"/>',
    '<rect x="7" y="7" width="' + (totalSize - 14) + '" height="' + (totalSize - 14) + '" rx="19" fill="none" stroke="#d9d4c6" stroke-width="1.5"/>',
    rects.join(''),
    '</svg>',
  ].join('')

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}
