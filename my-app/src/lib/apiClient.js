var defaultApiBaseUrl = 'http://localhost:4000'
var configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl

function buildUrl(path) {
  return configuredBaseUrl.replace(/\/$/, '') + path
}

async function parseResponse(response) {
  var text = ''

  try {
    text = await response.text()
  } catch (_error) {
    return { data: null, text: '' }
  }

  if (!text) {
    return { data: null, text: '' }
  }

  try {
    return {
      data: JSON.parse(text),
      text: text,
    }
  } catch (_error) {
    return {
      data: null,
      text: text,
    }
  }
}

function buildRequestError(response, parsed) {
  var data = parsed && parsed.data
  var text = parsed && parsed.text ? String(parsed.text).trim() : ''

  if (data && data.error) {
    return new Error(data.error)
  }

  if (response.status === 413) {
    return new Error('The uploaded payment proof is too large for the backend right now. Try a smaller screenshot, and if you just updated the code, restart the backend server too.')
  }

  if (response.status === 404) {
    return new Error('The backend API route was not found. Make sure the latest backend is running on ' + configuredBaseUrl + '.')
  }

  if (response.status >= 500) {
    return new Error('The backend hit an internal error. Please check the backend server and try again.')
  }

  if (text) {
    return new Error('Request failed (' + response.status + '): ' + text.slice(0, 180))
  }

  return new Error('Request failed (' + response.status + ').')
}

export async function getJson(path) {
  var response

  try {
    response = await fetch(buildUrl(path))
  } catch (_error) {
    throw new Error('Cannot reach the server. Make sure the backend is running on ' + configuredBaseUrl + '.')
  }

  var parsed = await parseResponse(response)

  if (!response.ok) {
    throw buildRequestError(response, parsed)
  }

  return parsed.data
}

export async function postJson(path, payload) {
  var response

  try {
    response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (_error) {
    throw new Error('Cannot reach the server. Make sure the backend is running on ' + configuredBaseUrl + '.')
  }

  var parsed = await parseResponse(response)

  if (!response.ok) {
    throw buildRequestError(response, parsed)
  }

  return parsed.data
}
