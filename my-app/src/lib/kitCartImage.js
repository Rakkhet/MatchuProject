var kitMatchaImages = {
  rockys: '/ROCKY1.jpg',
  anya: '/ANYA1.jpg',
  'rockys-dreamin': '/ROCKYS_DREAMIN1.jpg',
  mellow: '/MELLOW1.jpg',
  'rockys-single-cultivar': '/ROCKYS_SINGLE_CULTIVAR1.jpg',
}

var defaultKitImage = '/MATCHA WHISK HOLDER.jpg'

export function getKitCartImage(config) {
  var selectedMatcha = config && config.selectedMatcha ? String(config.selectedMatcha) : ''
  var details = config && config.details ? String(config.details) : ''
  var normalizedDetails = details.toLowerCase()

  if (selectedMatcha && selectedMatcha !== 'none' && kitMatchaImages[selectedMatcha]) {
    return kitMatchaImages[selectedMatcha]
  }

  if (normalizedDetails.indexOf("rocky's single cultivar") !== -1) {
    return kitMatchaImages['rockys-single-cultivar']
  }

  if (normalizedDetails.indexOf("rocky's dreamin") !== -1) {
    return kitMatchaImages['rockys-dreamin']
  }

  if (normalizedDetails.indexOf("rocky's") !== -1) {
    return kitMatchaImages.rockys
  }

  if (normalizedDetails.indexOf('anya') !== -1) {
    return kitMatchaImages.anya
  }

  if (normalizedDetails.indexOf('mellow') !== -1) {
    return kitMatchaImages.mellow
  }

  return defaultKitImage
}
