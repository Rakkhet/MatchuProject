import { getJson, postJson } from './apiClient'

export async function fetchHomepageReviews(userId) {
  var query = typeof userId === 'number' && userId > 0
    ? '?userId=' + encodeURIComponent(userId)
    : ''
  return getJson('/api/storefront/reviews' + query)
}

export async function submitHomepageReview(payload) {
  var data = await postJson('/api/reviews', payload)
  return {
    review: data.review || null,
    viewer: data.viewer || null,
  }
}
