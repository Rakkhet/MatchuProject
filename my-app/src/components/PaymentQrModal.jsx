export default function PaymentQrModal(props) {
  var open = props.open
  var totalLabel = props.totalLabel
  var customerName = props.customerName
  var customerEmail = props.customerEmail
  var paymentReference = props.paymentReference
  var qrCodeImage = props.qrCodeImage
  var proofPreview = props.proofPreview
  var proofName = props.proofName
  var error = props.error
  var isSubmitting = props.isSubmitting
  var onClose = props.onClose
  var onFileChange = props.onFileChange
  var onClearProof = props.onClearProof
  var onConfirm = props.onConfirm

  return (
    <>
      <div
        className={'payment-qr-modal-backdrop' + (open ? ' open' : '')}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={'payment-qr-modal-shell' + (open ? ' open' : '')}
        aria-hidden={!open}
      >
        <section
          className="payment-qr-modal"
          role="dialog"
          aria-modal="true"
          aria-label="QR code payment"
        >
          <div className="payment-qr-modal-header">
            <div>
              <p className="payment-qr-modal-eyebrow">PROMPTPAY QR</p>
              <h3 className="payment-qr-modal-title">Scan, upload, confirm.</h3>
            </div>
            <button type="button" className="payment-qr-modal-close" onClick={onClose} aria-label="Close payment modal">
              &times;
            </button>
          </div>

          <div className="payment-qr-modal-body">
            <div className="payment-qr-panel payment-qr-panel-code">
              <div className="payment-qr-topline">
                <span>Total due</span>
                <strong>{totalLabel}</strong>
              </div>

              <div className="payment-qr-card">
                {qrCodeImage ? <img src={qrCodeImage} alt="Simulated payment QR code" className="payment-qr-image" /> : null}
              </div>

              <div className="payment-qr-reference">
                <span>Reference</span>
                <strong>{paymentReference}</strong>
              </div>

              <div className="payment-qr-customer">
                <p>{customerName}</p>
                <p>{customerEmail}</p>
              </div>

              <p className="payment-qr-note">
                Demo flow: scan this simulated QR, upload your payment proof, and send the order for admin review.
              </p>
            </div>

            <div className="payment-qr-panel payment-qr-panel-upload">
              <div className="payment-qr-upload-head">
                <span>Payment proof</span>
                {proofName ? <strong>{proofName}</strong> : <strong>Required</strong>}
              </div>

              <label className="payment-qr-upload-box">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} />
                {proofPreview ? (
                  <img src={proofPreview} alt="Uploaded payment proof preview" className="payment-qr-proof-preview" />
                ) : (
                  <div className="payment-qr-upload-placeholder">
                    <span>Upload QR screenshot or transfer slip</span>
                    <small>PNG, JPG, or WEBP up to 4 MB</small>
                  </div>
                )}
              </label>

              <div className="payment-qr-actions-row">
                <button type="button" className="payment-qr-secondary" onClick={onClearProof} disabled={!proofPreview}>
                  Clear upload
                </button>
              </div>

              {error ? <p className="payment-qr-error">{error}</p> : null}

              <button type="button" className="payment-qr-confirm" onClick={onConfirm} disabled={isSubmitting}>
                {isSubmitting ? 'SUBMITTING PAYMENT...' : 'SUBMIT PAYMENT FOR REVIEW'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
