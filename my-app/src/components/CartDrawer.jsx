import { useEffect, useState } from 'react'
import { formatMoney, summarizeCartTotals } from '../lib/cartUtils'
import { getKitCartImage } from '../lib/kitCartImage'
import { createPaymentReference, createSimulatedQrCodeDataUrl } from '../lib/paymentQr'
import PaymentQrModal from './PaymentQrModal'

function readFileAsDataUrl(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader()

    reader.onload = function(event) {
      resolve(String(event.target && event.target.result || ''))
    }

    reader.onerror = function() {
      reject(new Error('Could not read that image. Please try another file.'))
    }

    reader.readAsDataURL(file)
  })
}

function loadImageElement(dataUrl) {
  return new Promise(function(resolve, reject) {
    var image = new Image()

    image.onload = function() {
      resolve(image)
    }

    image.onerror = function() {
      reject(new Error('Could not open that image. Please try another file.'))
    }

    image.src = dataUrl
  })
}

async function preparePaymentProofUpload(file) {
  var originalDataUrl = await readFileAsDataUrl(file)
  var image = await loadImageElement(originalDataUrl)
  var canvas = document.createElement('canvas')
  var context = canvas.getContext('2d')
  var maxPayloadLength = 1400000
  var dimensionSteps = [1600, 1400, 1200, 1000, 840, 720]
  var qualitySteps = [0.82, 0.74, 0.68, 0.58, 0.48]
  var bestDataUrl = originalDataUrl
  var bestMimeType = file.type || 'image/png'

  if (!context) {
    if (originalDataUrl.length > maxPayloadLength) {
      throw new Error('That image is too large to upload from this browser. Please crop it or use a smaller screenshot.')
    }

    return {
      dataUrl: originalDataUrl,
      mimeType: bestMimeType,
    }
  }

  if (originalDataUrl.length <= maxPayloadLength) {
    return {
      dataUrl: originalDataUrl,
      mimeType: bestMimeType,
    }
  }

  for (var dimensionIndex = 0; dimensionIndex < dimensionSteps.length; dimensionIndex += 1) {
    var maxDimension = dimensionSteps[dimensionIndex]
    var longestEdge = Math.max(image.width, image.height, 1)
    var scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1
    var targetWidth = Math.max(1, Math.round(image.width * scale))
    var targetHeight = Math.max(1, Math.round(image.height * scale))

    canvas.width = targetWidth
    canvas.height = targetHeight
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, targetWidth, targetHeight)
    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    for (var qualityIndex = 0; qualityIndex < qualitySteps.length; qualityIndex += 1) {
      var quality = qualitySteps[qualityIndex]
      var compressedDataUrl = canvas.toDataURL('image/jpeg', quality)

      if (compressedDataUrl.length < bestDataUrl.length) {
        bestDataUrl = compressedDataUrl
        bestMimeType = 'image/jpeg'
      }

      if (compressedDataUrl.length <= maxPayloadLength) {
        return {
          dataUrl: compressedDataUrl,
          mimeType: 'image/jpeg',
        }
      }
    }
  }

  if (bestDataUrl.length <= 2200000) {
    return {
      dataUrl: bestDataUrl,
      mimeType: bestMimeType,
    }
  }

  throw new Error('That image is still too large after compression. Please crop it tighter around the payment slip and try again.')
}

function getItemCount(items) {
  return items.reduce(function(total, item) {
    return total + item.quantity
  }, 0)
}

function getLineTotal(item) {
  if (typeof item.unitAmount === 'number' && item.currency) {
    return formatMoney(item.unitAmount * item.quantity, item.currency)
  }

  return item.price
}

function getCartItemImage(item) {
  if (item.image) {
    return item.image
  }

  if (item.itemType === 'KIT') {
    return getKitCartImage({ details: item.details })
  }

  return ''
}

export default function CartDrawer(props) {
  var open = props.open
  var items = props.items
  var authUser = props.authUser
  var latestOrder = props.latestOrder
  var onClose = props.onClose
  var onCheckout = props.onCheckout
  var onRequestLogin = props.onRequestLogin
  var onIncrement = props.onIncrement
  var onDecrement = props.onDecrement
  var onRemove = props.onRemove

  var customerNameState = useState('')
  var customerName = customerNameState[0]
  var setCustomerName = customerNameState[1]

  var customerEmailState = useState('')
  var customerEmail = customerEmailState[0]
  var setCustomerEmail = customerEmailState[1]

  var customerPhoneState = useState('')
  var customerPhone = customerPhoneState[0]
  var setCustomerPhone = customerPhoneState[1]

  var shippingAddressLine1State = useState('')
  var shippingAddressLine1 = shippingAddressLine1State[0]
  var setShippingAddressLine1 = shippingAddressLine1State[1]

  var shippingAddressLine2State = useState('')
  var shippingAddressLine2 = shippingAddressLine2State[0]
  var setShippingAddressLine2 = shippingAddressLine2State[1]

  var shippingDistrictState = useState('')
  var shippingDistrict = shippingDistrictState[0]
  var setShippingDistrict = shippingDistrictState[1]

  var shippingProvinceState = useState('')
  var shippingProvince = shippingProvinceState[0]
  var setShippingProvince = shippingProvinceState[1]

  var shippingPostalCodeState = useState('')
  var shippingPostalCode = shippingPostalCodeState[0]
  var setShippingPostalCode = shippingPostalCodeState[1]

  var shippingCountryState = useState('Thailand')
  var shippingCountry = shippingCountryState[0]
  var setShippingCountry = shippingCountryState[1]

  var checkoutErrorState = useState('')
  var checkoutError = checkoutErrorState[0]
  var setCheckoutError = checkoutErrorState[1]

  var checkoutSubmitState = useState(false)
  var isSubmitting = checkoutSubmitState[0]
  var setIsSubmitting = checkoutSubmitState[1]

  var paymentModalOpenState = useState(false)
  var paymentModalOpen = paymentModalOpenState[0]
  var setPaymentModalOpen = paymentModalOpenState[1]

  var paymentModalErrorState = useState('')
  var paymentModalError = paymentModalErrorState[0]
  var setPaymentModalError = paymentModalErrorState[1]

  var paymentReferenceState = useState('')
  var paymentReference = paymentReferenceState[0]
  var setPaymentReference = paymentReferenceState[1]

  var paymentQrCodeImageState = useState('')
  var paymentQrCodeImage = paymentQrCodeImageState[0]
  var setPaymentQrCodeImage = paymentQrCodeImageState[1]

  var paymentProofImageState = useState('')
  var paymentProofImage = paymentProofImageState[0]
  var setPaymentProofImage = paymentProofImageState[1]

  var paymentProofNameState = useState('')
  var paymentProofName = paymentProofNameState[0]
  var setPaymentProofName = paymentProofNameState[1]

  var paymentProofMimeTypeState = useState('')
  var paymentProofMimeType = paymentProofMimeTypeState[0]
  var setPaymentProofMimeType = paymentProofMimeTypeState[1]

  var itemCount = getItemCount(items)
  var totals = summarizeCartTotals(items)
  var totalLabel = totals.length ? totals.join(' + ') : 'Calculated at checkout'
  var showingOrderSuccess = !items.length && latestOrder

  function clearPaymentUpload() {
    setPaymentProofImage('')
    setPaymentProofName('')
    setPaymentProofMimeType('')
    setPaymentModalError('')
  }

  function resetPaymentState() {
    setPaymentModalOpen(false)
    setPaymentModalError('')
    setPaymentReference('')
    setPaymentQrCodeImage('')
    clearPaymentUpload()
  }

  useEffect(function() {
    setCustomerName(authUser ? authUser.displayName || '' : '')
    setCustomerEmail(authUser ? authUser.email || '' : '')
    setCustomerPhone('')
    setShippingAddressLine1('')
    setShippingAddressLine2('')
    setShippingDistrict('')
    setShippingProvince('')
    setShippingPostalCode('')
    setShippingCountry('Thailand')
    setCheckoutError('')
    setIsSubmitting(false)
    resetPaymentState()
  }, [authUser, open])

  useEffect(function() {
    if (items.length) {
      setCheckoutError('')
      return
    }

    resetPaymentState()
  }, [items])

  useEffect(function() {
    if (!paymentModalOpen) {
      return
    }

    function handleEscape(event) {
      if (event.key === 'Escape' && !isSubmitting) {
        resetPaymentState()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return function() {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [paymentModalOpen, isSubmitting])

  function openPaymentModal() {
    var nextPaymentReference = createPaymentReference(authUser ? authUser.id : 0)

    setPaymentReference(nextPaymentReference)
    setPaymentQrCodeImage(
      createSimulatedQrCodeDataUrl({
        reference: nextPaymentReference,
        amountLabel: totalLabel,
        accountLabel: customerEmail,
      })
    )
    setPaymentModalError('')
    setPaymentModalOpen(true)
  }

  async function handlePaymentProofChange(event) {
    var input = event.target
    var file = input && input.files && input.files[0]

    if (!file) {
      return
    }

    if (!file.type || file.type.indexOf('image/') !== 0) {
      setPaymentModalError('Please upload an image file for the payment proof.')
      input.value = ''
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      setPaymentModalError('Please upload a file smaller than 4 MB.')
      input.value = ''
      return
    }

    try {
      var preparedUpload = await preparePaymentProofUpload(file)

      setPaymentProofImage(preparedUpload.dataUrl)
      setPaymentProofName(file.name || 'payment-proof')
      setPaymentProofMimeType(preparedUpload.mimeType)
      setPaymentModalError('')
    } catch (error) {
      setPaymentModalError(error && error.message ? error.message : 'Could not prepare that image for upload.')
    }

    input.value = ''
  }

  async function handlePaymentConfirm() {
    if (!paymentProofImage) {
      setPaymentModalError('Please upload your payment proof before confirming.')
      return
    }

    setPaymentModalError('')
    setIsSubmitting(true)

    try {
      await onCheckout({
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        shippingAddressLine1: shippingAddressLine1,
        shippingAddressLine2: shippingAddressLine2,
        shippingDistrict: shippingDistrict,
        shippingProvince: shippingProvince,
        shippingPostalCode: shippingPostalCode,
        shippingCountry: shippingCountry,
        paymentMethod: 'PROMPTPAY_QR',
        paymentReference: paymentReference,
        paymentQrCodeImage: paymentQrCodeImage,
        paymentProofImage: paymentProofImage,
        paymentProofFileName: paymentProofName,
        paymentProofMimeType: paymentProofMimeType,
      })
      resetPaymentState()
    } catch (error) {
      setPaymentModalError(error && error.message ? error.message : 'Could not save your payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCheckoutSubmit(event) {
    event.preventDefault()

    if (!authUser) {
      if (typeof onRequestLogin === 'function') {
        onRequestLogin(event)
      }
      return
    }

    if (
      !customerName.trim() ||
      !customerEmail.trim() ||
      !customerPhone.trim() ||
      !shippingAddressLine1.trim() ||
      !shippingProvince.trim() ||
      !shippingPostalCode.trim() ||
      !shippingCountry.trim()
    ) {
      setCheckoutError('Please complete your shipping details before checkout.')
      return
    }

    setCheckoutError('')
    openPaymentModal()
  }

  return (
    <>
      <div
        className={'cart-drawer-backdrop' + (open ? ' open' : '')}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={'cart-drawer' + (open ? ' open' : '')}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Shopping cart"
      >
        <div className="cart-drawer-header">
          <div>
            <p className="cart-drawer-eyebrow">YOUR CART</p>
            <h2 className="cart-drawer-title">Selected items</h2>
          </div>
          <button type="button" className="cart-drawer-close" onClick={onClose} aria-label="Close cart">
            &times;
          </button>
        </div>

        <div className="cart-drawer-meta">
          <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
          <span>{totalLabel}</span>
        </div>

        <div className="cart-drawer-body">
          {items.length ? (
            items.map(function(item) {
              var itemImage = getCartItemImage(item)

              return (
                <div key={item.key} className="cart-line-item">
                  <div className="cart-line-media">
                    {itemImage ? (
                      <img src={itemImage} alt={item.name} className="cart-line-image" />
                    ) : (
                      <span className="cart-line-placeholder">GM</span>
                    )}
                  </div>
                  <div className="cart-line-copy">
                    <p className="cart-line-name">{item.name}</p>
                    {item.details ? <p className="cart-line-details">{item.details}</p> : null}
                    {item.quantity > 1 ? (
                      <p className="cart-line-unit-price">{item.price} each</p>
                    ) : null}
                    <p className="cart-line-price">{getLineTotal(item)}</p>
                    <div className="cart-line-actions">
                      <div className="cart-line-qty">
                        <button type="button" onClick={function() { onDecrement(item.key) }} aria-label={'Decrease quantity for ' + item.name}>
                          &#8722;
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={function() { onIncrement(item.key) }} aria-label={'Increase quantity for ' + item.name}>
                          +
                        </button>
                      </div>
                      <button type="button" className="cart-line-remove" onClick={function() { onRemove(item.key) }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : showingOrderSuccess ? (
            <div className="cart-drawer-empty cart-drawer-success">
              <p className="cart-drawer-empty-title">Payment proof submitted.</p>
              <p className="cart-drawer-empty-copy">
                Order #{latestOrder.id} is saved for {latestOrder.customerName} and is now waiting for admin review.
              </p>
              <div className="cart-drawer-success-meta">
                <span>{latestOrder.itemCount} item{latestOrder.itemCount === 1 ? '' : 's'}</span>
                <span>{latestOrder.totalSummary}</span>
              </div>
            </div>
          ) : (
            <div className="cart-drawer-empty">
              <p className="cart-drawer-empty-title">Your cart is still empty.</p>
              <p className="cart-drawer-empty-copy">Add a matcha or tool and it will slide in here right away.</p>
            </div>
          )}
        </div>

        <div className="cart-drawer-footer">
          {items.length ? (
            <>
              <div className="cart-drawer-footer-row">
                <span>Estimated total</span>
                <span>{totalLabel}</span>
              </div>

              {authUser ? (
                <form className="cart-checkout-form" onSubmit={handleCheckoutSubmit}>
                  <div className="cart-checkout-fields">
                    <input
                      type="text"
                      className="cart-checkout-input"
                      placeholder="Full name"
                      value={customerName}
                      onChange={function(event) { setCustomerName(event.target.value) }}
                      autoComplete="name"
                    />
                    <input
                      type="email"
                      className="cart-checkout-input"
                      placeholder="Email"
                      value={customerEmail}
                      onChange={function(event) { setCustomerEmail(event.target.value) }}
                      autoComplete="email"
                    />
                    <input
                      type="tel"
                      className="cart-checkout-input"
                      placeholder="Phone"
                      value={customerPhone}
                      onChange={function(event) { setCustomerPhone(event.target.value) }}
                      autoComplete="tel"
                    />
                    <input
                      type="text"
                      className="cart-checkout-input cart-checkout-input-wide"
                      placeholder="Address line 1"
                      value={shippingAddressLine1}
                      onChange={function(event) { setShippingAddressLine1(event.target.value) }}
                      autoComplete="address-line1"
                    />
                    <input
                      type="text"
                      className="cart-checkout-input cart-checkout-input-wide"
                      placeholder="Address line 2 (optional)"
                      value={shippingAddressLine2}
                      onChange={function(event) { setShippingAddressLine2(event.target.value) }}
                      autoComplete="address-line2"
                    />
                    <input
                      type="text"
                      className="cart-checkout-input"
                      placeholder="District / City"
                      value={shippingDistrict}
                      onChange={function(event) { setShippingDistrict(event.target.value) }}
                      autoComplete="address-level2"
                    />
                    <input
                      type="text"
                      className="cart-checkout-input"
                      placeholder="Province / State"
                      value={shippingProvince}
                      onChange={function(event) { setShippingProvince(event.target.value) }}
                      autoComplete="address-level1"
                    />
                    <input
                      type="text"
                      className="cart-checkout-input"
                      placeholder="Postal code"
                      value={shippingPostalCode}
                      onChange={function(event) { setShippingPostalCode(event.target.value) }}
                      autoComplete="postal-code"
                    />
                    <input
                      type="text"
                      className="cart-checkout-input"
                      placeholder="Country"
                      value={shippingCountry}
                      onChange={function(event) { setShippingCountry(event.target.value) }}
                      autoComplete="country-name"
                    />
                  </div>

                  {checkoutError ? <p className="cart-checkout-error">{checkoutError}</p> : null}

                  <button type="submit" className="cart-drawer-button" disabled={isSubmitting}>
                    {isSubmitting ? 'SAVING PAYMENT...' : 'PAY WITH QR CODE'}
                  </button>
                </form>
              ) : (
                <div className="cart-checkout-guest">
                  <p className="cart-checkout-copy">Sign in to sync your cart and save the order in your account.</p>
                  <button type="button" className="cart-drawer-button" onClick={onRequestLogin}>
                    SIGN IN TO CHECK OUT
                  </button>
                </div>
              )}
            </>
          ) : (
            <button type="button" className="cart-drawer-button" onClick={onClose}>
              Continue shopping
            </button>
          )}
        </div>
      </aside>

      <PaymentQrModal
        open={paymentModalOpen}
        totalLabel={totalLabel}
        customerName={customerName}
        customerEmail={customerEmail}
        paymentReference={paymentReference}
        qrCodeImage={paymentQrCodeImage}
        proofPreview={paymentProofImage}
        proofName={paymentProofName}
        error={paymentModalError}
        isSubmitting={isSubmitting}
        onClose={function() {
          if (!isSubmitting) {
            resetPaymentState()
          }
        }}
        onFileChange={handlePaymentProofChange}
        onClearProof={clearPaymentUpload}
        onConfirm={handlePaymentConfirm}
      />
    </>
  )
}
