import { getJson, postJson } from './apiClient'

export async function fetchAdminOrders(userId) {
  var data = await getJson('/api/admin/orders?userId=' + encodeURIComponent(userId))
  return data.orders || []
}

export async function fetchAdminProducts(userId) {
  var data = await getJson('/api/admin/products?userId=' + encodeURIComponent(userId))
  return data.products || []
}

export async function updateAdminProduct(userId, productId, payload) {
  var data = await postJson('/api/admin/products/' + encodeURIComponent(productId) + '/update', Object.assign({}, payload, {
    userId: userId,
  }))
  return data.product
}

export async function updateAdminOrderStatus(userId, orderId, adminStatus, options) {
  var data = await postJson('/api/admin/orders/' + encodeURIComponent(orderId) + '/status', {
    userId: userId,
    adminStatus: adminStatus,
    shippingCarrier: options && options.shippingCarrier ? options.shippingCarrier : '',
    trackingNumber: options && options.trackingNumber ? options.trackingNumber : '',
    adminNote: options && options.adminNote ? options.adminNote : '',
  })

  return data.order
}

export async function createAdminProduct(userId, payload) {
  var data = await postJson('/api/admin/products', Object.assign({}, payload, {
    userId: userId,
  }))

  return data.product
}

export async function deleteAdminProduct(userId, productId) {
  var data = await postJson('/api/admin/products/' + encodeURIComponent(productId) + '/delete', {
    userId: userId,
  })

  return data
}
