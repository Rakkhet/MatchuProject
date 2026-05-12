import { getJson } from './apiClient'

export async function fetchHomeStorefront() {
  return getJson('/api/storefront/home')
}

export async function fetchMatchaShopProducts() {
  var data = await getJson('/api/storefront/shop/matcha')
  return data.products
}

export async function fetchToolsShopProducts() {
  var data = await getJson('/api/storefront/shop/tools')
  return data.products
}

export async function fetchKitStorefront() {
  return getJson('/api/storefront/kit')
}
