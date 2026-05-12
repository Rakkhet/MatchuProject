import { useState, useEffect } from 'react'
import { useInView } from '../hooks/useInView'
import ProductCard from '../components/ProductCard'
import BackgroundVideo from '../components/BackgroundVideo'
import { fetchKitStorefront } from '../lib/storefrontApi'
import { createAdminProduct, deleteAdminProduct } from '../lib/adminApi'
import { getKitCartImage } from '../lib/kitCartImage'

var kitVideo = '/matcha3.mp4'

var kitItems = [
  { id: 1, name: 'MATCHA WHISK HOLDER', desc: 'Holds your whisk securely between uses.', color: '#1a1a1a', image: '/MATCHA WHISK HOLDER.jpg' },
  { id: 2, name: 'MATCHA WHISK', desc: 'Traditional bamboo whisk for perfect matcha preparation.', color: '#3a7d44', image: '/MATCHA WHISK.jpg' },
  { id: 3, name: 'BAMBOO WHISK', desc: 'Premium bamboo whisk for smooth whisking.', color: '#d4b896', image: '/BAMBOO WHISK.jpg' },
  { id: 4, name: 'LATTE CUP', desc: 'Beautiful ceramic cup for your matcha latte.', color: '#f0f0f0', image: '/LATTE CUP.jpg' },
  { id: 5, name: 'MATCHA STRAINER', desc: 'Fine mesh strainer for clump-free matcha powder.', color: '#8b9a7a', image: '/MATCHA STRAINER.jpg' },
]

var matchaOptions = [
  { value: 'none',                   label: 'No matcha',                          price: 0  },
  { value: 'rockys',                 label: "ROCKY'S — 20g",                      price: 1650 },
  { value: 'anya',                   label: 'ANYA — 50g',                         price: 2100 },
  { value: 'rockys-dreamin',         label: "ROCKY'S DREAMIN — 50g",             price: 1950 },
  { value: 'mellow',                 label: 'MELLOW — 50g',                       price: 1990 },
  { value: 'rockys-single-cultivar', label: "ROCKY'S SINGLE CULTIVAR — 50g",     price: 2850 },
]

var curatedProducts = [
  { id: 2, slug: 'anya', name: 'ANYA — 50G',                    origin: 'From Fukuoka', price: '2100.00 B', badge: 'NEW', soldOut: false, image: '/ANYA1.jpg' },
  { id: 3, slug: 'rockys-dreamin', name: "ROCKY'S DREAMIN — 50G", origin: 'From Kyoto',  price: '1950.00 B', badge: 'NEW', soldOut: false, image: '/ROCKYS_DREAMIN1.jpg' },
  { id: 4, slug: 'mellow', name: 'MELLOW — 50G',                origin: 'From Uji',     price: '1990.00 B', badge: 'NEW', soldOut: false, image: '/MELLOW1.jpg' },
]

function buildKitProductDraft(collection) {
  // ค่าเริ่มต้นของฟอร์มเพิ่มสินค้าในหน้า kit
  var isTool = collection === 'TOOLS'

  return {
    collection: collection,
    name: '',
    displayName: '',
    slug: '',
    originLabel: isTool ? 'From Japan' : '',
    priceAmount: '',
    imagePath: '',
    kitItemDescription: '',
    badgeLabel: isTool ? 'TOOLS' : 'NEW',
    stockQuantity: '10',
    sortOrder: '',
    soldOut: false,
    featuredOnHome: false,
    featuredInKit: !isTool,
    includedInKit: isTool,
  }
}

export default function ShopKitPage(props) {
  var onAddToCart = props.onAddToCart
  var onAddKitToCart = props.onAddKitToCart
  var authUser = props.authUser
  var onProductsChanged = props.onProductsChanged
  var isActive = props.isActive !== false
  var refreshKey = props.refreshKey || 0
  var isAdmin = Boolean(authUser && authUser.isAdmin)

  useEffect(function() {
    if (isActive) {
      window.scrollTo(0, 0)
    }
  }, [isActive])

  var kitItemsState = useState(kitItems)
  var visibleKitItems = kitItemsState[0]
  var setVisibleKitItems = kitItemsState[1]

  var matchaOptionsState = useState(matchaOptions)
  var visibleMatchaOptions = matchaOptionsState[0]
  var setVisibleMatchaOptions = matchaOptionsState[1]

  var curatedProductsState = useState(curatedProducts)
  var visibleCuratedProducts = curatedProductsState[0]
  var setVisibleCuratedProducts = curatedProductsState[1]

  var qtyState = useState(1)
  var qty = qtyState[0]
  var setQty = qtyState[1]

  var matchaState = useState('none')
  var selectedMatcha = matchaState[0]
  var setSelectedMatcha = matchaState[1]

  var matchaOpenState = useState(false)
  var matchaOpen = matchaOpenState[0]
  var setMatchaOpen = matchaOpenState[1]

  var adminFormCollectionState = useState(null)
  var adminFormCollection = adminFormCollectionState[0]
  var setAdminFormCollection = adminFormCollectionState[1]

  var adminFormDraftState = useState(buildKitProductDraft('TOOLS'))
  var adminFormDraft = adminFormDraftState[0]
  var setAdminFormDraft = adminFormDraftState[1]

  var adminFormSavingState = useState(false)
  var adminFormSaving = adminFormSavingState[0]
  var setAdminFormSaving = adminFormSavingState[1]

  var adminDeletingProductIdState = useState(null)
  var adminDeletingProductId = adminDeletingProductIdState[0]
  var setAdminDeletingProductId = adminDeletingProductIdState[1]

  var adminFormFeedbackState = useState('')
  var adminFormFeedback = adminFormFeedbackState[0]
  var setAdminFormFeedback = adminFormFeedbackState[1]

  var adminFormFeedbackToneState = useState('')
  var adminFormFeedbackTone = adminFormFeedbackToneState[0]
  var setAdminFormFeedbackTone = adminFormFeedbackToneState[1]

  var curatedResult = useInView(0.05)
  var curatedRef = curatedResult[0]
  var curatedIn = curatedResult[1]

  var basePrice = 3900
  var selectedMatchaOption = visibleMatchaOptions.find(function(m) { return m.value === selectedMatcha }) || visibleMatchaOptions[0] || { value: 'none', label: 'No matcha', price: 0 }
  var matchaPrice = selectedMatchaOption.price
  var totalPrice = basePrice + matchaPrice

  function applyKitData(data) {
    // เอาข้อมูลจาก backend มาอัปเดตหน้า kit ทั้งสามส่วน
    if (data.kitItems) setVisibleKitItems(data.kitItems)
    if (data.matchaOptions) setVisibleMatchaOptions(data.matchaOptions)
    if (data.curatedProducts) setVisibleCuratedProducts(data.curatedProducts)
  }

  useEffect(function() {
    // โหลดข้อมูลหน้า kit ใหม่เมื่อมีสินค้าในหมวดที่เกี่ยวข้องเปลี่ยน
    var ignore = false

    fetchKitStorefront()
      .then(function(data) {
        if (ignore) return
        applyKitData(data)
      })
      .catch(function() {
        return
      })

    return function() { ignore = true }
  }, [refreshKey])

  useEffect(function() {
    if (isActive) {
      return
    }

    setMatchaOpen(false)
  }, [isActive])

  function selectMatcha(val) {
    // เลือกมัทฉะในชุด kit
    setSelectedMatcha(val)
    setMatchaOpen(false)
  }

  function formatKitPrice(amount) {
    // แปลงตัวเลขราคาให้เป็นรูปแบบเงินบาท
    return Number(amount || 0).toFixed(2) + ' B'
  }

  function handleAddKit() {
    // รวมข้อมูล kit ปัจจุบันแล้วส่งเข้า cart
    if (typeof onAddKitToCart !== 'function') {
      return
    }

    var kitDetails = selectedMatchaOption.value === 'none'
      ? 'Kit only'
      : 'Matcha choice: ' + selectedMatchaOption.label

    onAddKitToCart({
      key: 'kit:' + selectedMatcha,
      name: 'THE KIT',
      image: getKitCartImage({
        selectedMatcha: selectedMatcha,
        details: kitDetails,
      }),
      quantity: qty,
      price: formatKitPrice(totalPrice),
      details: kitDetails,
    })
  }

  function openAdminForm(collection) {
    // เปิดฟอร์มเพิ่มสินค้า โดยแยก default ระหว่าง MATCHA กับ TOOLS
    setAdminFormCollection(collection)
    setAdminFormDraft(buildKitProductDraft(collection))
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')
  }

  function closeAdminForm() {
    // ปิดฟอร์ม ถ้ากำลัง save อยู่จะยังไม่ให้ปิด
    if (adminFormSaving) return
    setAdminFormCollection(null)
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')
  }

  function updateAdminDraft(key, value) {
    // อัปเดตค่าช่อง input ในฟอร์มเพิ่มสินค้า
    setAdminFormDraft(function(draft) {
      return Object.assign({}, draft, { [key]: value })
    })
  }

  async function handleCreateKitProduct(event) {
    // เพิ่มสินค้าใน database แล้ว refresh หน้า kit และหน้าอื่นที่ใช้สินค้าเดียวกัน
    event.preventDefault()

    if (!isAdmin || !adminFormCollection || adminFormSaving) return

    setAdminFormSaving(true)
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')

    try {
      await createAdminProduct(authUser.id, Object.assign({}, adminFormDraft, {
        collection: adminFormCollection,
      }))

      var data = await fetchKitStorefront()
      applyKitData(data)

      if (typeof onProductsChanged === 'function') onProductsChanged()

      setAdminFormDraft(buildKitProductDraft(adminFormCollection))
      setAdminFormFeedbackTone('success')
      setAdminFormFeedback('เพิ่มสินค้าเรียบร้อยแล้ว สามารถเพิ่มต่อได้เลย')
    } catch (err) {
      setAdminFormFeedbackTone('error')
      setAdminFormFeedback(err && err.message ? err.message : 'เพิ่มสินค้าไม่สำเร็จ')
    } finally {
      setAdminFormSaving(false)
    }
  }

  async function handleDeleteKitProduct(product) {
    // ลบสินค้าที่อยู่ในหน้า kit แล้ว refresh หน้าอื่นที่เกี่ยวข้อง
    if (!isAdmin || !product || !product.id || adminDeletingProductId) return

    var ok = window.confirm('Delete this product?')
    if (!ok) return

    setAdminDeletingProductId(product.id)

    try {
      await deleteAdminProduct(authUser.id, product.id)

      var data = await fetchKitStorefront()
      applyKitData(data)

      if (selectedMatcha === product.value) {
        setSelectedMatcha('none')
      }

      if (typeof onProductsChanged === 'function') onProductsChanged()
    } catch (_err) {
      return
    } finally {
      setAdminDeletingProductId(null)
    }
  }

  return (
    <div className="kitpage">

      {/* ── Product split ── */}
      <div className="kitpage-product">

        {/* Left: sticky visual */}
        <div className="kitpage-media">
          <div className="kitpage-media-inner">
            {kitVideo ? (
              <BackgroundVideo
                className="kitpage-media-video"
                src={kitVideo}
                poster="/matcha3-poster.png"
                preload="auto"
              />
            ) : null}
            <div className="kitpage-media-overlay" />
            <div className="kitpage-media-content">
              <span className="kitpage-media-label">The Kit</span>
            </div>
          </div>
        </div>

        {/* Right: details */}
        <div className="kitpage-details">
          <span className="kitpage-badge">TOOLS</span>
          <h1 className="kitpage-title">The Kit</h1>
          <p className="kitpage-price">{formatKitPrice(totalPrice)}</p>
          <p className="kitpage-tagline">If Apple made a matcha kit,<br />this would be that kit.</p>

          {/* What's included */}
          <div className="kitpage-includes">
            <h3 className="kitpage-includes-heading">WHAT&#39;S INCLUDED</h3>
            {visibleKitItems.map(function(item) {
              return (
                <div key={item.id} className="kitpage-item">
                  <div className="kitpage-item-thumb">
                    <img
                      className="kitpage-item-thumb-image"
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                    />
                  </div>
                  <div className="kitpage-item-info">
                    <p className="kitpage-item-name">{item.name}</p>
                    <p className="kitpage-item-desc">{item.desc}</p>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="kitpage-admin-delete"
                      disabled={adminDeletingProductId === item.id}
                      onClick={function() { handleDeleteKitProduct(item) }}
                    >
                      {adminDeletingProductId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {isAdmin ? (
            <div className="kitpage-admin-controls">
              <button type="button" className="kitpage-admin-add" onClick={function() { openAdminForm('TOOLS') }}>
                + ADD KIT TOOL
              </button>
              <button type="button" className="kitpage-admin-add" onClick={function() { openAdminForm('MATCHA') }}>
                + ADD MATCHA OPTION
              </button>
            </div>
          ) : null}

          {/* Choose matcha */}
          <div className="kitpage-matcha">
            <button
              type="button"
              className={'kitpage-matcha-header' + (matchaOpen ? ' open' : '')}
              onClick={function() { setMatchaOpen(!matchaOpen) }}
            >
              <span>CHOOSE YOUR MATCHA</span>
              <span className={'kitpage-matcha-chevron' + (matchaOpen ? ' open' : '')}>&#8964;</span>
            </button>

            {!matchaOpen && (
              <div className="kitpage-matcha-selected">
                <span>{selectedMatchaOption.label}</span>
                <span>{formatKitPrice(matchaPrice)}</span>
              </div>
            )}

            {matchaOpen && (
              <div className="kitpage-matcha-options">
                {visibleMatchaOptions.map(function(opt) {
                  var active = selectedMatcha === opt.value
                  if (isAdmin && opt.value !== 'none') {
                    return (
                      <div key={opt.value} className="kitpage-matcha-option-row">
                        <button
                          type="button"
                          className={'kitpage-matcha-option' + (active ? ' active' : '')}
                          onClick={function() { selectMatcha(opt.value) }}
                        >
                          <span>{opt.label}</span>
                          <span>{formatKitPrice(opt.price)}</span>
                        </button>
                        <button
                          type="button"
                          className="kitpage-matcha-option-delete"
                          disabled={adminDeletingProductId === opt.id}
                          onClick={function() { handleDeleteKitProduct(opt) }}
                        >
                          {adminDeletingProductId === opt.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    )
                  }

                  return (
                    <button
                      type="button"
                      key={opt.value}
                      className={'kitpage-matcha-option' + (active ? ' active' : '')}
                      onClick={function() { selectMatcha(opt.value) }}
                    >
                      <span>{opt.label}</span>
                      <span>{formatKitPrice(opt.price)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Qty + Add to cart */}
          <div className="kitpage-actions">
            <div className="kitpage-qty">
              <button type="button" onClick={function() { setQty(Math.max(1, qty - 1)) }}>&#8722;</button>
              <span>{qty}</span>
              <button type="button" onClick={function() { setQty(qty + 1) }}>+</button>
            </div>
            <button type="button" className="kitpage-add-cart" onClick={handleAddKit}>ADD TO CART</button>
          </div>

          <p className="kitpage-guarantee">&#10084; Love it or it&#39;s free, no questions asked guarantee.</p>
        </div>
      </div>

      {isAdmin && adminFormCollection ? (
        <div className="shop-admin-product-modal-backdrop">
          <div className="shop-admin-product-modal" role="dialog" aria-modal="true" aria-label="Add kit product">
            <div className="shop-admin-product-modal-header">
              <div>
                <p className="shop-admin-product-eyebrow">SHOP KIT</p>
                <h3>{adminFormCollection === 'TOOLS' ? 'Add kit tool.' : 'Add kit matcha.'}</h3>
                <p>
                  {adminFormCollection === 'TOOLS'
                    ? "เพิ่มสินค้า tools เข้า WHAT'S INCLUDED ของชุด kit"
                    : 'เพิ่ม matcha เข้า dropdown เลือกมัทฉะ และแสดงใน Curated for you'}
                </p>
              </div>
              <button type="button" className="shop-admin-product-close" onClick={closeAdminForm}>
                X
              </button>
            </div>

            <form className="shop-admin-product-form" onSubmit={handleCreateKitProduct}>
              <div className="shop-admin-product-form-grid">
                <label className="shop-admin-product-field">
                  <span>Name</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder={adminFormCollection === 'TOOLS' ? 'MATCHA WHISK' : "ROCKY'S"}
                    value={adminFormDraft.name}
                    onChange={function(event) { updateAdminDraft('name', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Display name</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder={adminFormCollection === 'TOOLS' ? 'MATCHA WHISK' : "ROCKY'S — 20G"}
                    value={adminFormDraft.displayName}
                    onChange={function(event) { updateAdminDraft('displayName', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Slug</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder={adminFormCollection === 'TOOLS' ? 'matcha-whisk' : 'rockys-new'}
                    value={adminFormDraft.slug}
                    onChange={function(event) { updateAdminDraft('slug', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Origin label</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder={adminFormCollection === 'TOOLS' ? 'From Japan' : 'From Uji'}
                    value={adminFormDraft.originLabel}
                    onChange={function(event) { updateAdminDraft('originLabel', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Price (THB)</span>
                  <input
                    type="number"
                    min="0"
                    className="admin-order-input"
                    placeholder={adminFormCollection === 'TOOLS' ? '900' : '1650'}
                    value={adminFormDraft.priceAmount}
                    onChange={function(event) { updateAdminDraft('priceAmount', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Stock</span>
                  <input
                    type="number"
                    min="0"
                    className="admin-order-input"
                    placeholder="10"
                    value={adminFormDraft.stockQuantity}
                    onChange={function(event) { updateAdminDraft('stockQuantity', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field shop-admin-product-field-wide">
                  <span>Image path</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder={adminFormCollection === 'TOOLS' ? '/MATCHA WHISK.jpg' : '/ROCKY1.jpg'}
                    value={adminFormDraft.imagePath}
                    onChange={function(event) { updateAdminDraft('imagePath', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field shop-admin-product-field-wide">
                  <span>Kit description</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="Short detail shown in The Kit"
                    value={adminFormDraft.kitItemDescription}
                    onChange={function(event) { updateAdminDraft('kitItemDescription', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Badge</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder={adminFormCollection === 'TOOLS' ? 'TOOLS' : 'NEW'}
                    value={adminFormDraft.badgeLabel}
                    onChange={function(event) { updateAdminDraft('badgeLabel', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Sort order</span>
                  <input
                    type="number"
                    min="0"
                    className="admin-order-input"
                    placeholder="10"
                    value={adminFormDraft.sortOrder}
                    onChange={function(event) { updateAdminDraft('sortOrder', event.target.value) }}
                  />
                </label>
              </div>

              <div className="shop-admin-product-flags">
                <label>
                  <input
                    type="checkbox"
                    checked={adminFormDraft.soldOut}
                    onChange={function(event) { updateAdminDraft('soldOut', event.target.checked) }}
                  />
                  Sold out
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={adminFormDraft.featuredOnHome}
                    onChange={function(event) { updateAdminDraft('featuredOnHome', event.target.checked) }}
                  />
                  Featured home
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={adminFormDraft.includedInKit}
                    onChange={function(event) { updateAdminDraft('includedInKit', event.target.checked) }}
                  />
                  Included in kit
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={adminFormDraft.featuredInKit}
                    onChange={function(event) { updateAdminDraft('featuredInKit', event.target.checked) }}
                  />
                  Featured in kit
                </label>
              </div>

              {adminFormFeedback ? (
                <p className={'shop-admin-product-feedback ' + adminFormFeedbackTone}>
                  {adminFormFeedback}
                </p>
              ) : null}

              <div className="shop-admin-product-actions">
                <button type="button" className="shop-admin-product-cancel" onClick={closeAdminForm}>
                  Cancel
                </button>
                <button type="submit" className="shop-admin-product-submit" disabled={adminFormSaving}>
                  {adminFormSaving ? 'Adding...' : 'Add product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Curated for you ── */}
      <div className="kitpage-curated">
        <h2 className="kitpage-curated-heading">Curated for you</h2>
        <div ref={curatedRef} className="products-grid">
          {visibleCuratedProducts.map(function(p, i) {
            return <ProductCard key={p.id} product={p} animate={curatedIn} delay={i * 80} onAddToCart={onAddToCart} />
          })}
        </div>
      </div>

    </div>
  )
}
