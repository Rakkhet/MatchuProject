import { useState, useEffect } from 'react'
import { useInView } from '../hooks/useInView'
import ProductCard from '../components/ProductCard'
import { fetchToolsShopProducts } from '../lib/storefrontApi'
import { createAdminProduct, deleteAdminProduct, fetchAdminProducts, updateAdminProduct } from '../lib/adminApi'

var toolsProducts = [
  { id: 6, slug: 'matcha-whisk-holder', name: 'MATCHA WHISK HOLDER', price: '900.00 B', badge: 'SOLD OUT', soldOut: true, image: '/MATCHA WHISK HOLDER.jpg' },
  { id: 7, slug: 'latte-cup', name: 'LATTE CUP', price: '800.00 B', badge: 'TOOLS', soldOut: false, image: '/LATTE CUP.jpg' },
  { id: 8, slug: 'matcha-whisk', name: 'MATCHA WHISK', price: '1700.00 B', badge: 'SOLD OUT', soldOut: true, image: '/MATCHA WHISK.jpg' },
  { id: 9, slug: 'bamboo-whisk', name: 'BAMBOO WHISK', price: '880.00 B', badge: 'TOOLS', soldOut: false, image: '/BAMBOO WHISK.jpg' },
  { id: 10, slug: 'matcha-strainer', name: 'MATCHA STRAINER', price: '880.00 B', badge: 'TOOLS', soldOut: false, image: '/MATCHA STRAINER.jpg' },
]

function buildShopToolsDraft() {
  // ค่าเริ่มต้นตอน admin กดเพิ่มสินค้า tools ใหม่
  return {
    collection: 'TOOLS',
    name: '',
    displayName: '',
    slug: '',
    originLabel: '',
    priceAmount: '',
    imagePath: '',
    kitItemDescription: '',
    badgeLabel: 'TOOLS',
    stockQuantity: '10',
    sortOrder: '',
    soldOut: false,
    featuredOnHome: false,
    featuredInKit: false,
    includedInKit: false,
  }
}

function buildEditDraftFromProduct(product) {
  // แปลงข้อมูลสินค้าเดิมให้พร้อมแสดงในฟอร์มแก้ไข
  return {
    collection: product.collection || 'TOOLS',
    name: product.name || '',
    displayName: product.displayName || '',
    slug: product.slug || '',
    originLabel: product.originLabel || '',
    priceAmount: product.priceAmount != null ? String(product.priceAmount) : '',
    imagePath: product.imagePath || '',
    kitItemDescription: product.kitItemDescription || '',
    badgeLabel: product.badgeLabel || '',
    stockQuantity: product.stockQuantity != null ? String(product.stockQuantity) : '10',
    sortOrder: product.sortOrder != null ? String(product.sortOrder) : '',
    soldOut: Boolean(product.soldOut),
    featuredOnHome: Boolean(product.featuredOnHome),
    featuredInKit: Boolean(product.featuredInKit),
    includedInKit: Boolean(product.includedInKit),
  }
}

export default function ShopToolsPage(props) {
  var onAddToCart = props.onAddToCart
  var authUser = props.authUser
  var onProductsChanged = props.onProductsChanged
  var refreshKey = props.refreshKey || 0
  var isAdmin = Boolean(authUser && authUser.isAdmin)

  useEffect(function() { window.scrollTo(0, 0) }, [])

  var productsState = useState(toolsProducts)
  var products = productsState[0]
  var setProducts = productsState[1]

  // ใช้บอกว่าฟอร์ม admin ปิดอยู่ / เพิ่มใหม่ / แก้สินค้าชิ้นเดิม
  var adminFormProductState = useState(null)
  var adminFormProduct = adminFormProductState[0]
  var setAdminFormProduct = adminFormProductState[1]

  var adminFormDraftState = useState(buildShopToolsDraft())
  var adminFormDraft = adminFormDraftState[0]
  var setAdminFormDraft = adminFormDraftState[1]

  var adminFormSavingState = useState(false)
  var adminFormSaving = adminFormSavingState[0]
  var setAdminFormSaving = adminFormSavingState[1]

  var adminDeletingState = useState(false)
  var adminDeleting = adminDeletingState[0]
  var setAdminDeleting = adminDeletingState[1]

  var adminFormFeedbackState = useState('')
  var adminFormFeedback = adminFormFeedbackState[0]
  var setAdminFormFeedback = adminFormFeedbackState[1]

  var adminFormFeedbackToneState = useState('')
  var adminFormFeedbackTone = adminFormFeedbackToneState[0]
  var setAdminFormFeedbackTone = adminFormFeedbackToneState[1]

  var adminProductsState = useState([])
  var adminProducts = adminProductsState[0]
  var setAdminProducts = adminProductsState[1]

  useEffect(function() {
    // โหลดสินค้า tools จาก backend และโหลดใหม่เมื่อหน้าอื่นเพิ่มสินค้า
    var ignore = false

    fetchToolsShopProducts()
      .then(function(data) {
        if (!ignore) setProducts(data)
      })
      .catch(function() { return })

    return function() { ignore = true }
  }, [refreshKey])

  useEffect(function() {
    // โหลดข้อมูลเต็มของสินค้าไว้ให้ admin แก้ไขได้
    if (!isAdmin) return

    var ignore = false

    fetchAdminProducts(authUser.id)
      .then(function(data) {
        if (!ignore) setAdminProducts(Array.isArray(data) ? data : [])
      })
      .catch(function() { return })

    return function() { ignore = true }
  }, [isAdmin, refreshKey])

  function openAdminForm() {
    // เปิดฟอร์มเพิ่มสินค้า tools
    setAdminFormProduct('new')
    setAdminFormDraft(buildShopToolsDraft())
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')
  }

  function openEditForm(product) {
    // เปิดฟอร์มแก้ไข โดยหา record เต็มจาก adminProducts ก่อน
    var full = adminProducts.find(function(p) { return p.id === product.id }) || product
    setAdminFormProduct(full)
    setAdminFormDraft(buildEditDraftFromProduct(full))
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')
  }

  function closeAdminForm() {
    // ปิดฟอร์ม ถ้ากำลัง save อยู่จะยังไม่ให้ปิด
    if (adminFormSaving) return
    setAdminFormProduct(null)
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')
  }

  function updateDraft(key, value) {
    // อัปเดตค่าช่อง input ในฟอร์ม
    setAdminFormDraft(function(d) { return Object.assign({}, d, { [key]: value }) })
  }

  async function handleAdminFormSubmit(event) {
    // ส่งข้อมูลสินค้าไป backend แล้ว refresh หน้าอื่นที่เกี่ยวข้อง
    event.preventDefault()

    if (!isAdmin || adminFormSaving) return

    var isEditing = adminFormProduct && adminFormProduct !== 'new'

    setAdminFormSaving(true)
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')

    try {
      if (isEditing) {
        await updateAdminProduct(authUser.id, adminFormProduct.id, Object.assign({}, adminFormDraft, { collection: 'TOOLS' }))
      } else {
        await createAdminProduct(authUser.id, Object.assign({}, adminFormDraft, { collection: 'TOOLS' }))
      }

      var nextProducts = await fetchToolsShopProducts()
      setProducts(Array.isArray(nextProducts) ? nextProducts : products)

      var nextAdminProducts = await fetchAdminProducts(authUser.id)
      setAdminProducts(Array.isArray(nextAdminProducts) ? nextAdminProducts : adminProducts)

      if (typeof onProductsChanged === 'function') onProductsChanged()

      if (isEditing) {
        setAdminFormFeedbackTone('success')
        setAdminFormFeedback('อัพเดทสินค้าเรียบร้อยแล้ว')
      } else {
        setAdminFormDraft(buildShopToolsDraft())
        setAdminFormFeedbackTone('success')
        setAdminFormFeedback('เพิ่มสินค้าเรียบร้อยแล้ว สามารถเพิ่มต่อได้เลย')
      }
    } catch (err) {
      setAdminFormFeedbackTone('error')
      setAdminFormFeedback(
        err && err.message
          ? err.message
          : (isEditing ? 'อัพเดทสินค้าไม่สำเร็จ' : 'เพิ่มสินค้าไม่สำเร็จ')
      )
    } finally {
      setAdminFormSaving(false)
    }
  }

  async function handleDeleteProduct() {
    // ลบสินค้า tools ออกจาก database แล้ว refresh หน้าอื่น
    if (!isAdmin || !isEditing || adminDeleting) return

    var ok = window.confirm('Delete this product?')
    if (!ok) return

    setAdminDeleting(true)
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')

    try {
      await deleteAdminProduct(authUser.id, adminFormProduct.id)

      var nextProducts = await fetchToolsShopProducts()
      setProducts(Array.isArray(nextProducts) ? nextProducts : [])

      var nextAdminProducts = await fetchAdminProducts(authUser.id)
      setAdminProducts(Array.isArray(nextAdminProducts) ? nextAdminProducts : [])

      if (typeof onProductsChanged === 'function') onProductsChanged()

      setAdminFormProduct(null)
      setAdminFormFeedback('')
      setAdminFormFeedbackTone('')
    } catch (err) {
      setAdminFormFeedbackTone('error')
      setAdminFormFeedback(err && err.message ? err.message : 'ลบสินค้าไม่สำเร็จ')
    } finally {
      setAdminDeleting(false)
    }
  }

  var gridResult = useInView(0.05)
  var gridRef = gridResult[0]
  var gridIn = gridResult[1]

  var isEditing = adminFormProduct && adminFormProduct !== 'new'

  return (
    <div className="shop-page">
      <div className="shop-page-header">
        <h2 className="section-h-serif">The tools</h2>
        <p className="section-h-cursive">Shop our premium tools and accessories</p>
      </div>

      <div ref={gridRef} className="products-grid">
        {products.map(function(product, index) {
          if (isAdmin) {
            return (
              <div key={product.id} className="product-card-admin-wrapper">
                <ProductCard product={product} animate={gridIn} delay={index * 60} onAddToCart={onAddToCart} />
                <button
                  type="button"
                  className="product-card-admin-edit-btn"
                  onClick={function() { openEditForm(product) }}
                >
                  EDIT
                </button>
              </div>
            )
          }

          return (
            <ProductCard
              key={product.id}
              product={product}
              animate={gridIn}
              delay={index * 60}
              onAddToCart={onAddToCart}
            />
          )
        })}
        {isAdmin ? (
          <button type="button" className="admin-add-product-card" onClick={openAdminForm}>
            <span className="admin-add-product-plus">+</span>
            <span className="admin-add-product-label">ADD TOOL</span>
            <span className="admin-add-product-copy">เพิ่มสินค้าใหม่ในหน้า Shop Tools</span>
          </button>
        ) : null}
      </div>

      {isAdmin && adminFormProduct !== null ? (
        <div className="shop-admin-product-modal-backdrop">
          <div className="shop-admin-product-modal" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit tool product' : 'Add tool product'}>
            <div className="shop-admin-product-modal-header">
              <div>
                <p className="shop-admin-product-eyebrow">SHOP TOOLS</p>
                <h3>{isEditing ? 'Edit tool.' : 'Add new tool.'}</h3>
                <p>{isEditing ? 'แก้ไขข้อมูลสินค้า แล้วกดบันทึก' : 'กรอกข้อมูลสินค้า แล้วกดเพิ่ม ระบบจะบันทึกลง database และดึงรายการใหม่กลับมาแสดงทันที'}</p>
              </div>
              <button type="button" className="shop-admin-product-close" onClick={closeAdminForm}>
                X
              </button>
            </div>

            <form className="shop-admin-product-form" onSubmit={handleAdminFormSubmit}>
              <div className="shop-admin-product-form-grid">
                <label className="shop-admin-product-field">
                  <span>Name</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="MATCHA WHISK"
                    value={adminFormDraft.name}
                    onChange={function(event) { updateDraft('name', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Display name</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="MATCHA WHISK"
                    value={adminFormDraft.displayName}
                    onChange={function(event) { updateDraft('displayName', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Slug</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="matcha-whisk"
                    value={adminFormDraft.slug}
                    onChange={function(event) { updateDraft('slug', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Origin label</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="From Japan"
                    value={adminFormDraft.originLabel}
                    onChange={function(event) { updateDraft('originLabel', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Price (THB)</span>
                  <input
                    type="number"
                    min="0"
                    className="admin-order-input"
                    placeholder="900"
                    value={adminFormDraft.priceAmount}
                    onChange={function(event) { updateDraft('priceAmount', event.target.value) }}
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
                    onChange={function(event) { updateDraft('stockQuantity', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field shop-admin-product-field-wide">
                  <span>Image path</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="/MATCHA WHISK.jpg"
                    value={adminFormDraft.imagePath}
                    onChange={function(event) { updateDraft('imagePath', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field shop-admin-product-field-wide">
                  <span>Kit description</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="Short detail shown in The Kit"
                    value={adminFormDraft.kitItemDescription}
                    onChange={function(event) { updateDraft('kitItemDescription', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Badge</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="TOOLS"
                    value={adminFormDraft.badgeLabel}
                    onChange={function(event) { updateDraft('badgeLabel', event.target.value) }}
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
                    onChange={function(event) { updateDraft('sortOrder', event.target.value) }}
                  />
                </label>
              </div>

              <div className="shop-admin-product-flags">
                <label>
                  <input
                    type="checkbox"
                    checked={adminFormDraft.soldOut}
                    onChange={function(event) { updateDraft('soldOut', event.target.checked) }}
                  />
                  Sold out
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={adminFormDraft.featuredOnHome}
                    onChange={function(event) { updateDraft('featuredOnHome', event.target.checked) }}
                  />
                  Featured home
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={adminFormDraft.includedInKit}
                    onChange={function(event) { updateDraft('includedInKit', event.target.checked) }}
                  />
                  Included in kit
                </label>
              </div>

              {adminFormFeedback ? (
                <p className={'shop-admin-product-feedback ' + adminFormFeedbackTone}>
                  {adminFormFeedback}
                </p>
              ) : null}

              <div className="shop-admin-product-actions">
                {isEditing ? (
                  <button type="button" className="shop-admin-product-delete" onClick={handleDeleteProduct} disabled={adminDeleting || adminFormSaving}>
                    {adminDeleting ? 'Deleting...' : 'Delete product'}
                  </button>
                ) : null}
                <button type="button" className="shop-admin-product-cancel" onClick={closeAdminForm}>
                  Cancel
                </button>
                <button type="submit" className="shop-admin-product-submit" disabled={adminFormSaving}>
                  {adminFormSaving
                    ? (isEditing ? 'Saving...' : 'Adding...')
                    : (isEditing ? 'Save changes' : 'Add product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
