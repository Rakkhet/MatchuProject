import { useEffect, useState } from 'react'
import { fetchAdminOrders, updateAdminOrderStatus } from '../lib/adminApi'

// ปุ่มชุดนี้ไว้สำหรับ action ฝั่ง payment
// เช่น สลิปถูกส่งมาแล้ว, กำลังตรวจ, หรือจ่ายผ่านแล้ว
var paymentActionOptions = [
  { value: 'UPLOADED', label: 'Uploaded' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'PAID', label: 'Approve payment' },
]

// ปุ่มชุดนี้ไว้สำหรับ action ฝั่งการจัดส่ง
// admin จะกดเมื่อเริ่มแพ็กของ, ส่งของ, ส่งถึง หรือยกเลิกออเดอร์
var fulfillmentActionOptions = [
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'SHIPPED', label: 'Mark shipped' },
  { value: 'DELIVERED', label: 'Mark delivered' },
  { value: 'CANCELLED', label: 'Cancel order' },
]

function formatAdminDateTime(value) {
  // แปลงวันเวลาให้ admin อ่านง่ายบน dashboard
  if (!value) {
    return '—'
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch (_error) {
    return '—'
  }
}

function formatStatusLabel(value) {
  // แปลง status key จากระบบให้เป็นข้อความสั้นๆ ที่อ่านง่ายขึ้น
  var normalized = String(value || '').toUpperCase()

  if (normalized === 'UNDER_REVIEW') return 'Under review'
  if (normalized === 'UPLOADED') return 'Uploaded'
  if (normalized === 'PENDING') return 'Pending'
  if (normalized === 'PAID') return 'Paid'
  if (normalized === 'PREPARING') return 'Preparing'
  if (normalized === 'SHIPPED') return 'Shipped'
  if (normalized === 'DELIVERED') return 'Delivered'
  if (normalized === 'CANCELLED') return 'Cancelled'
  if (normalized === 'REFUNDED') return 'Refunded'
  return normalized || '—'
}

function getAdminStatusTone(value) {
  // ใช้กำหนดโทนสีของ badge สถานะบนการ์ดออเดอร์
  if (value === 'CANCELLED') {
    return 'neutral'
  }

  if (value === 'SHIPPED' || value === 'DELIVERED' || value === 'PAID') {
    return 'success'
  }

  return 'pending'
}

function buildDraftFromOrder(order) {
  // draft คือค่าชั่วคราวที่ admin กำลังพิมพ์อยู่ในฟอร์ม
  // เช่น carrier, tracking และ note ก่อนกดบันทึกสถานะ
  return {
    shippingCarrier: order.shippingCarrier || '',
    trackingNumber: order.trackingNumber || '',
    adminNote: '',
  }
}

function formatShippingAddress(order) {
  // รวมที่อยู่หลายช่องให้กลายเป็นข้อความเดียวสำหรับแสดงผล
  var shippingAddress = order && order.shippingAddress ? order.shippingAddress : {}

  return [
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.district,
    shippingAddress.province,
    shippingAddress.postalCode,
    shippingAddress.country,
  ].filter(Boolean).join(', ')
}

function formatHistoryEvent(entry) {
  // แปลง event type ใน timeline ให้เป็นภาษาที่คนอ่านเข้าใจง่าย
  if (!entry) {
    return 'Status updated'
  }

  if (entry.eventType === 'CHECKOUT_SUBMITTED') {
    return 'Payment proof submitted'
  }

  if (entry.eventType === 'PAYMENT_STATUS_CHANGED') {
    return 'Payment moved to ' + formatStatusLabel(entry.toPaymentStatus)
  }

  if (entry.eventType === 'SHIPPING_STATUS_CHANGED') {
    return 'Fulfillment moved to ' + formatStatusLabel(entry.toShippingStatus)
  }

  if (entry.eventType === 'TRACKING_UPDATED') {
    return 'Tracking details updated'
  }

  if (entry.eventType === 'ORDER_CANCELLED') {
    return 'Order cancelled'
  }

  if (entry.eventType === 'INVENTORY_ADJUSTED') {
    return 'Inventory updated'
  }

  return 'Status updated'
}

export default function AdminDashboardPage(props) {
  var authUser = props.authUser
  var goHome = props.goHome

  // เก็บรายการออเดอร์ทั้งหมดที่โหลดมาจาก backend
  var ordersState = useState([])
  var orders = ordersState[0]
  var setOrders = ordersState[1]

  // เก็บค่าที่ admin กำลังกรอกแยกตาม order id
  var draftsState = useState({})
  var drafts = draftsState[0]
  var setDrafts = draftsState[1]

  // ใช้บอกว่ากำลังโหลดข้อมูลทั้งหน้าอยู่หรือไม่
  var loadingState = useState(true)
  var loading = loadingState[0]
  var setLoading = loadingState[1]

  // ใช้จำว่า order ไหนกำลังกดบันทึกอยู่
  // จะได้ disable ปุ่มของ order นั้นชั่วคราว
  var savingOrderIdState = useState(null)
  var savingOrderId = savingOrderIdState[0]
  var setSavingOrderId = savingOrderIdState[1]

  // เก็บข้อความ error หลักของหน้า
  var errorState = useState('')
  var error = errorState[0]
  var setError = errorState[1]

  // ถ้า admin กดดูสลิป จะเอา order ที่เลือกมาเก็บไว้ตรงนี้
  var selectedSlipState = useState(null)
  var selectedSlip = selectedSlipState[0]
  var setSelectedSlip = selectedSlipState[1]

  useEffect(function() {
    // ตอนเข้า dashboard จะดึงออเดอร์ทั้งหมดจาก backend
    // ถ้า user ไม่ใช่ admin ก็ไม่ต้องโหลด และเคลียร์ state ทิ้งไว้ก่อน
    var ignore = false

    if (!authUser || !authUser.isAdmin) {
      setOrders([])
      setDrafts({})
      setLoading(false)
      return function() { ignore = true }
    }

    setLoading(true)
    setError('')

    fetchAdminOrders(authUser.id)
      .then(function(nextOrders) {
        if (ignore) {
          return
        }

        var safeOrders = Array.isArray(nextOrders) ? nextOrders : []
        setOrders(safeOrders)
        setDrafts(safeOrders.reduce(function(result, order) {
          result[order.id] = buildDraftFromOrder(order)
          return result
        }, {}))
      })
      .catch(function(nextError) {
        if (ignore) {
          return
        }

        setError(nextError && nextError.message ? nextError.message : 'Could not load admin orders right now.')
      })
      .finally(function() {
        if (ignore) {
          return
        }

        setLoading(false)
      })

    return function() { ignore = true }
  }, [authUser])

  if (!authUser || !authUser.isAdmin) {
    return (
      <section className="admin-dashboard admin-dashboard-empty">
        <div className="admin-dashboard-shell">
          <p className="admin-dashboard-eyebrow">ADMIN</p>
          <h1 className="admin-dashboard-title">Access denied.</h1>
          <p className="admin-dashboard-description">
            This dashboard is only available to the admin account.
          </p>
          <button type="button" className="admin-dashboard-home" onClick={goHome}>
            Back to home
          </button>
        </div>
      </section>
    )
  }

  var totalOrders = orders.length
  var awaitingReviewCount = orders.filter(function(order) {
    return order.adminStatus === 'UPLOADED' || order.adminStatus === 'UNDER_REVIEW'
  }).length
  var paidOrders = orders.filter(function(order) { return order.adminStatus === 'PAID' }).length
  var activeShipments = orders.filter(function(order) {
    return order.adminStatus === 'PREPARING' || order.adminStatus === 'SHIPPED'
  }).length
  var deliveredOrders = orders.filter(function(order) { return order.adminStatus === 'DELIVERED' }).length
  function updateDraft(orderId, key, value) {
    // เวลา admin พิมพ์ carrier / tracking / note
    // จะอัปเดตเฉพาะ draft ของออเดอร์ใบที่กำลังแก้อยู่
    setDrafts(function(previousDrafts) {
      var nextOrderDraft = Object.assign({}, previousDrafts[orderId] || {}, {
        [key]: value,
      })

      return Object.assign({}, previousDrafts, {
        [orderId]: nextOrderDraft,
      })
    })
  }

  async function handleApplyStatus(order, nextStatus) {
    // ฟังก์ชันนี้คือหัวใจของหน้า admin
    // ใช้ส่งสถานะใหม่พร้อมข้อมูล tracking/note ไป backend เพื่ออัปเดตออเดอร์จริง
    if (!order || savingOrderId) {
      return
    }

    var draft = drafts[order.id] || buildDraftFromOrder(order)

    setSavingOrderId(order.id)
    setError('')

    try {
      var updatedOrder = await updateAdminOrderStatus(authUser.id, order.id, nextStatus, draft)

      setOrders(function(previousOrders) {
        return previousOrders.map(function(previousOrder) {
          return previousOrder.id === order.id ? updatedOrder : previousOrder
        })
      })

      setDrafts(function(previousDrafts) {
        return Object.assign({}, previousDrafts, {
          [order.id]: buildDraftFromOrder(updatedOrder),
        })
      })
    } catch (nextError) {
      setError(nextError && nextError.message ? nextError.message : 'Could not update this order.')
    } finally {
      setSavingOrderId(null)
    }
  }

  return (
    <section className="admin-dashboard">
      <div className="admin-dashboard-shell">
        <div className="admin-dashboard-header">
          <div>
            <p className="admin-dashboard-eyebrow">ADMIN DASHBOARD</p>
            <h1 className="admin-dashboard-title">Review, approve, ship.</h1>
            <p className="admin-dashboard-description">
              Signed in as {authUser.displayName}. Track uploaded slips, approve payments,
              attach shipping details, and keep every customer updated from the same queue.
            </p>
          </div>

          <button type="button" className="admin-dashboard-home" onClick={goHome}>
            Back to storefront
          </button>
        </div>

        <div className="admin-dashboard-summary admin-dashboard-summary-wide">
          <article className="admin-dashboard-stat">
            <span className="admin-dashboard-stat-label">Total orders</span>
            <strong className="admin-dashboard-stat-value">{totalOrders}</strong>
          </article>
          <article className="admin-dashboard-stat">
            <span className="admin-dashboard-stat-label">Awaiting review</span>
            <strong className="admin-dashboard-stat-value">{awaitingReviewCount}</strong>
          </article>
          <article className="admin-dashboard-stat">
            <span className="admin-dashboard-stat-label">Paid</span>
            <strong className="admin-dashboard-stat-value">{paidOrders}</strong>
          </article>
          <article className="admin-dashboard-stat">
            <span className="admin-dashboard-stat-label">In progress</span>
            <strong className="admin-dashboard-stat-value">{activeShipments}</strong>
          </article>
          <article className="admin-dashboard-stat">
            <span className="admin-dashboard-stat-label">Delivered</span>
            <strong className="admin-dashboard-stat-value">{deliveredOrders}</strong>
          </article>
        </div>

        {error ? <p className="admin-dashboard-error">{error}</p> : null}

        {loading ? (
          <div className="admin-dashboard-feedback">Loading admin orders...</div>
        ) : orders.length ? (
          <div className="admin-order-grid">
            {orders.map(function(order) {
              var draft = drafts[order.id] || buildDraftFromOrder(order)
              var statusTone = getAdminStatusTone(order.adminStatus)

              return (
                <article key={order.id} className="admin-order-card">
                  <div className="admin-order-card-top">
                    <div>
                      <p className="admin-order-id">Order #{order.id}</p>
                      <p className="admin-order-date">{formatAdminDateTime(order.createdAt)}</p>
                    </div>

                    <span className={'admin-order-badge ' + statusTone}>
                      {formatStatusLabel(order.adminStatus)}
                    </span>
                  </div>

                  <div className="admin-order-customer">
                    <div>
                      <span className="admin-order-label">Customer</span>
                      <strong>{order.customerName}</strong>
                      <p>{order.customerEmail}</p>
                      <p>{order.customerPhone || 'No phone provided'}</p>
                    </div>

                    <div>
                      <span className="admin-order-label">Shipping address</span>
                      <strong>{formatShippingAddress(order) || 'No shipping address yet'}</strong>
                    </div>
                  </div>

                  <div className="admin-order-meta-grid">
                    <div>
                      <span className="admin-order-label">Total</span>
                      <strong>{order.totals && order.totals.totalLabel ? order.totals.totalLabel : order.totalSummary}</strong>
                    </div>
                    <div>
                      <span className="admin-order-label">Payment reference</span>
                      <strong>{order.paymentReference || '—'}</strong>
                    </div>
                    <div>
                      <span className="admin-order-label">Payment</span>
                      <strong>{formatStatusLabel(order.paymentStatus || 'UPLOADED')}</strong>
                    </div>
                    <div>
                      <span className="admin-order-label">Fulfillment</span>
                      <strong>{formatStatusLabel(order.shippingStatus || 'PENDING')}</strong>
                    </div>
                  </div>

                  <div className="admin-order-meta-grid">
                    <div>
                      <span className="admin-order-label">Slip uploaded</span>
                      <strong>{formatAdminDateTime(order.paymentSubmittedAt)}</strong>
                    </div>
                    <div>
                      <span className="admin-order-label">Tracking</span>
                      <strong>
                        {[order.shippingCarrier, order.trackingNumber].filter(Boolean).join(' · ') || 'Not assigned yet'}
                      </strong>
                    </div>
                    <div>
                      <span className="admin-order-label">Stock reserved</span>
                      <strong>{order.inventoryCommitted ? 'Yes' : 'Not yet'}</strong>
                    </div>
                    <div>
                      <span className="admin-order-label">Placed by</span>
                      <strong>{order.user && order.user.displayName ? order.user.displayName : 'Guest'}</strong>
                    </div>
                  </div>

                  {order.notes ? (
                    <div className="admin-order-notes">
                      <span className="admin-order-label">Checkout notes</span>
                      <p>{order.notes}</p>
                    </div>
                  ) : null}

                  <div className="admin-order-items">
                    {order.items.map(function(item) {
                      return (
                        <div key={item.key} className="admin-order-item">
                          <span>{item.name}</span>
                          <strong>x{item.quantity}</strong>
                        </div>
                      )
                    })}
                  </div>

                  <div className="admin-order-draft-grid">
                    <input
                      type="text"
                      className="admin-order-input"
                      placeholder="Shipping carrier"
                      value={draft.shippingCarrier}
                      onChange={function(event) { updateDraft(order.id, 'shippingCarrier', event.target.value) }}
                    />
                    <input
                      type="text"
                      className="admin-order-input"
                      placeholder="Tracking number"
                      value={draft.trackingNumber}
                      onChange={function(event) { updateDraft(order.id, 'trackingNumber', event.target.value) }}
                    />
                    <textarea
                      className="admin-order-textarea"
                      placeholder="Admin note for this update"
                      value={draft.adminNote}
                      onChange={function(event) { updateDraft(order.id, 'adminNote', event.target.value) }}
                    />
                  </div>

                  <div className="admin-order-actions admin-order-actions-stack">
                    <button
                      type="button"
                      className="admin-order-slip-button"
                      disabled={!order.proofImageData}
                      onClick={function() {
                        if (order.proofImageData) {
                          setSelectedSlip(order)
                        }
                      }}
                    >
                      {order.proofImageData ? 'View slip' : 'No slip uploaded'}
                    </button>

                    <div className="admin-order-action-groups">
                      <div className="admin-order-action-group">
                        <span className="admin-order-label">Payment actions</span>
                        <div className="admin-order-action-buttons">
                          {paymentActionOptions.map(function(option) {
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={'admin-order-action-button' + (order.adminStatus === option.value ? ' active' : '')}
                                disabled={savingOrderId === order.id}
                                onClick={function() { handleApplyStatus(order, option.value) }}
                              >
                                {option.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="admin-order-action-group">
                        <span className="admin-order-label">Fulfillment actions</span>
                        <div className="admin-order-action-buttons">
                          {fulfillmentActionOptions.map(function(option) {
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={'admin-order-action-button' + (order.adminStatus === option.value ? ' active' : '')}
                                disabled={savingOrderId === order.id}
                                onClick={function() { handleApplyStatus(order, option.value) }}
                              >
                                {savingOrderId === order.id && option.value === order.adminStatus ? 'Saving...' : option.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {order.history && order.history.length ? (
                    <div className="admin-order-history">
                      <span className="admin-order-label">Order timeline</span>
                      <div className="admin-order-history-list">
                        {order.history.map(function(entry) {
                          return (
                            <div key={entry.id} className="admin-order-history-item">
                              <div>
                                <strong>{formatHistoryEvent(entry)}</strong>
                                <p>
                                  {entry.note || [entry.shippingCarrier, entry.trackingNumber].filter(Boolean).join(' · ') || 'No note'}
                                </p>
                              </div>
                              <span>
                                {entry.changedByUser && entry.changedByUser.displayName
                                  ? entry.changedByUser.displayName + ' · '
                                  : ''}
                                {formatAdminDateTime(entry.createdAt)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="admin-dashboard-feedback">No orders yet. Once customers check out, they will show up here.</div>
        )}
      </div>

      {selectedSlip ? (
        <div
          className="admin-slip-modal-backdrop"
          role="presentation"
          onClick={function() { setSelectedSlip(null) }}
        >
          <div
            className="admin-slip-modal"
            role="dialog"
            aria-modal="true"
            aria-label={'Payment slip for order #' + selectedSlip.id}
            onClick={function(event) { event.stopPropagation() }}
          >
            <button
              type="button"
              className="admin-slip-modal-close"
              onClick={function() { setSelectedSlip(null) }}
              aria-label="Close slip preview"
            >
              ✕
            </button>

            <div className="admin-slip-modal-copy">
              <p className="admin-dashboard-eyebrow">PAYMENT PROOF</p>
              <h2 className="admin-slip-modal-title">Order #{selectedSlip.id}</h2>
              <p className="admin-slip-modal-meta">
                {selectedSlip.proofFileName || 'Uploaded payment slip'} · {formatAdminDateTime(selectedSlip.paymentSubmittedAt)}
              </p>
            </div>

            <div className="admin-slip-modal-frame">
              <img
                src={selectedSlip.proofImageData}
                alt={'Payment slip for order #' + selectedSlip.id}
                className="admin-slip-modal-image"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
