import { getJson, postJson } from './apiClient'

export async function fetchServerCart(userId) {
  var data = await getJson('/api/cart?userId=' + encodeURIComponent(userId))
  return data.items || []
}

export async function syncServerCart(userId, items) {
  var data = await postJson('/api/cart/sync', {
    userId: userId,
    items: items,
  })

  return data.items || []
}

export async function placeOrder(payload) {
  var data = await postJson('/api/checkout', payload)
  return data.order
}

export async function fetchOrders(userId) {
  var data = await getJson('/api/orders?userId=' + encodeURIComponent(userId))
  return {
    orders: data.orders || [],
    nonCancelledOrderCount: typeof data.nonCancelledOrderCount === 'number' ? data.nonCancelledOrderCount : 0,
  }
}
