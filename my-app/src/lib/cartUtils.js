export function parsePriceLabel(priceLabel) {
  var label = String(priceLabel || '').trim()
  var amountText = label.replace(/[^0-9.]/g, '')
  var amount = amountText ? Number(amountText) : null

  if (typeof amount === 'number' && Number.isNaN(amount)) {
    amount = null
  }

  return {
    label: label,
    amount: amount,
    currency: amount === null ? null : 'THB',
  }
}

export function formatMoney(amount, currency) {
  var numericAmount = Number(amount || 0)

  if (currency === 'THB') {
    return numericAmount.toFixed(2) + ' B'
  }

  return numericAmount.toFixed(2)
}

export function summarizeCartTotals(items) {
  var totals = {}

  items.forEach(function(item) {
    if (typeof item.unitAmount !== 'number' || !item.currency) {
      return
    }

    if (!totals[item.currency]) {
      totals[item.currency] = 0
    }

    totals[item.currency] += item.unitAmount * item.quantity
  })

  return Object.keys(totals)
    .sort()
    .map(function(currency) {
      return formatMoney(totals[currency], currency)
    })
}
