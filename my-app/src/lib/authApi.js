import { postJson } from './apiClient'

export async function loginWithPassword(payload) {
  var data = await postJson('/api/auth/login', payload)
  return data.user
}

export async function registerWithPassword(payload) {
  var data = await postJson('/api/auth/register', payload)
  return data.user
}

export async function resetPassword(payload) {
  var data = await postJson('/api/auth/reset-password', payload)
  return data.message || 'Password updated. Please sign in with your new password.'
}
