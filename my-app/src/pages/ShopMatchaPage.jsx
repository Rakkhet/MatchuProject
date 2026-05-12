import { useState, useRef, useEffect } from 'react'
import { useInView } from '../hooks/useInView'
import ProductCard from '../components/ProductCard'
import { fetchMatchaShopProducts } from '../lib/storefrontApi'
import { createAdminProduct, deleteAdminProduct, fetchAdminProducts, updateAdminProduct } from '../lib/adminApi'

var shopMatchaProducts = [
  {
    id: 1,
    slug: 'rockys',
    name: "ROCKY'S — 20G",
    origin: 'From Kagoshima',
    price: '1650.00 B',
    badge: 'NEW',
    soldOut: false,
    image: '/ROCKY1.jpg',
    filters: {
      size: '20g-tin',
      subscription: 'available',
      origin: 'kagoshima',
      cultivar: 'blend',
      offering: 'singles',
    },
  },
  {
    id: 2,
    slug: 'anya',
    name: 'ANYA — 50G',
    origin: 'From Fukuoka',
    price: '2100.00 B',
    badge: 'NEW',
    soldOut: false,
    image: '/ANYA1.jpg',
    filters: {
      size: '50g-pouch',
      subscription: 'available',
      origin: 'fukuoka',
      cultivar: 'kirari-31',
      offering: 'collections',
    },
  },
  {
    id: 3,
    slug: 'rockys-dreamin',
    name: "ROCKY'S DREAMIN — 50G",
    origin: 'From Kyoto',
    price: '1950.00 B',
    badge: 'NEW',
    soldOut: false,
    image: '/ROCKYS_DREAMIN1.jpg',
    filters: {
      size: '50g-pouch',
      subscription: 'not-available',
      origin: 'kyoto',
      cultivar: 'koshun',
      offering: 'collections',
    },
  },
  {
    id: 4,
    slug: 'mellow',
    name: 'MELLOW — 50G',
    origin: 'From Uji',
    price: '1990.00 B',
    badge: 'NEW',
    soldOut: false,
    image: '/MELLOW1.jpg',
    filters: {
      size: '50g-pouch',
      subscription: 'available',
      origin: 'uji',
      cultivar: 'gokou',
      offering: 'collections',
    },
  },
  {
    id: 5,
    slug: 'rockys-single-cultivar',
    name: "ROCKY'S SINGLE CULTIVAR — 50G",
    origin: 'From Shizuoka',
    price: '2850.00 B',
    badge: 'NEW',
    soldOut: false,
    image: '/ROCKYS_SINGLE_CULTIVAR1.jpg',
    filters: {
      size: '50g-pouch',
      subscription: 'not-available',
      origin: 'shizuoka',
      cultivar: 'gokou',
      offering: 'singles',
    },
  },
]

var filterCatalog = [
  {
    key: 'size',
    label: 'SIZE',
    options: [
      { value: '20g-tin', label: '20g Tin', color: '#1a1a1a' },
      { value: '50g-pouch', label: '50g Pouch', color: '#8ab520' },
    ],
  },
  {
    key: 'subscription',
    label: 'SUBSCRIPTION',
    options: [
      { value: 'available', label: 'Available', color: '#c8ff00' },
      { value: 'not-available', label: 'Not Available', color: '#2f2f2f' },
    ],
  },
  {
    key: 'origin',
    label: 'ORIGIN',
    options: [
      { value: 'kagoshima', label: 'Kagoshima', color: '#111111' },
      { value: 'fukuoka', label: 'Fukuoka', color: '#ded7cf' },
      { value: 'kyoto', label: 'Kyoto', color: '#614127' },
      { value: 'uji', label: 'Uji', color: '#2d5a1b' },
      { value: 'shizuoka', label: 'Shizuoka', color: '#96b92d' },
    ],
  },
  {
    key: 'cultivar',
    label: 'CULTIVAR',
    options: [
      { value: 'blend', label: 'Blend', color: '#1a1a1a' },
      { value: 'gokou', label: 'Gokou', color: '#486f25' },
      { value: 'kirari-31', label: 'Kirari 31', color: '#808e59' },
      { value: 'koshun', label: 'Koshun', color: '#f0d7c6' },
    ],
  },
  {
    key: 'offering',
    label: 'OFFERING',
    options: [
      { value: 'singles', label: 'Singles', color: '#1a1a1a' },
      { value: 'collections', label: 'Collections', color: '#8ab520' },
    ],
  },
]

function getProductFilterValue(product, key) {
  return product && product.filters ? product.filters[key] : null
}

function buildFilterDefs(products) {
  return filterCatalog.map(function(def) {
    return {
      key: def.key,
      label: def.label,
      options: def.options.filter(function(option) {
        return products.some(function(product) {
          return getProductFilterValue(product, def.key) === option.value
        })
      }),
    }
  }).filter(function(def) {
    return def.options.length > 0
  })
}

function productMatchesFilters(product, filters) {
  return Object.keys(filters).every(function(key) {
    var selectedValues = filters[key]

    if (!selectedValues || selectedValues.size === 0) {
      return true
    }

    return selectedValues.has(getProductFilterValue(product, key))
  })
}

function getActiveFilterCount(filters) {
  return Object.keys(filters).reduce(function(total, key) {
    return total + filters[key].size
  }, 0)
}

function buildShopMatchaDraft() {
  // ค่าเริ่มต้นตอน admin กดเพิ่มสินค้า matcha ใหม่
  return {
    collection: 'MATCHA',
    name: '',
    displayName: '',
    slug: '',
    originLabel: '',
    priceAmount: '',
    imagePath: '',
    badgeLabel: 'NEW',
    stockQuantity: '10',
    sortOrder: '',
    soldOut: false,
    featuredOnHome: false,
    featuredInKit: false,
    includedInKit: false,
  }
}

function buildEditDraftFromProduct(product) {
  // แปลงข้อมูลสินค้าจาก database ให้เอามาใส่ในฟอร์มแก้ไขได้
  return {
    collection: product.collection || 'MATCHA',
    name: product.name || '',
    displayName: product.displayName || '',
    slug: product.slug || '',
    originLabel: product.originLabel || '',
    priceAmount: product.priceAmount != null ? String(product.priceAmount) : '',
    imagePath: product.imagePath || '',
    badgeLabel: product.badgeLabel || '',
    stockQuantity: product.stockQuantity != null ? String(product.stockQuantity) : '10',
    sortOrder: product.sortOrder != null ? String(product.sortOrder) : '',
    soldOut: Boolean(product.soldOut),
    featuredOnHome: Boolean(product.featuredOnHome),
    featuredInKit: Boolean(product.featuredInKit),
    includedInKit: Boolean(product.includedInKit),
  }
}

function FilterDropdown(props) {
  var def = props.def
  var selectedSet = props.selected
  var onToggle = props.onToggle

  var openState = useState(false)
  var isOpen = openState[0]
  var setOpen = openState[1]

  var dropdownRef = useRef(null)
  var count = selectedSet.size

  useEffect(function() {
    if (!isOpen) return

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return function() { document.removeEventListener('mousedown', handleClickOutside) }
  }, [isOpen])

  return (
    <div className="filter-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={'filter-dropdown-header' + (isOpen ? ' open' : '')}
        onClick={function() { setOpen(!isOpen) }}
      >
        <span>{def.label}{count > 0 ? ' (' + count + ')' : ''}</span>
        <span className={'filter-chevron' + (isOpen ? ' open' : '')}>&#8963;</span>
      </button>
      {isOpen && (
        <div className="filter-dropdown-panel">
          {def.options.map(function(option) {
            var checked = selectedSet.has(option.value)

            return (
              <label key={option.value} className="filter-option">
                <input
                  type="checkbox"
                  className="filter-checkbox"
                  checked={checked}
                  onChange={function() { onToggle(def.key, option.value) }}
                />
                <div className="filter-option-thumb" style={{ background: option.color }} />
                <span className="filter-option-label">{option.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ShopMatchaPage(props) {
  var onAddToCart = props.onAddToCart
  var authUser = props.authUser
  var onProductsChanged = props.onProductsChanged
  var refreshKey = props.refreshKey || 0
  var isAdmin = Boolean(authUser && authUser.isAdmin)

  useEffect(function() {
    window.scrollTo(0, 0)
  }, [])

  var productsState = useState(shopMatchaProducts)
  var products = productsState[0]
  var setProducts = productsState[1]

  // ใช้บอกว่าฟอร์ม admin ปิดอยู่ / เพิ่มใหม่ / แก้สินค้าชิ้นเดิม
  var adminFormProductState = useState(null)
  var adminFormProduct = adminFormProductState[0]
  var setAdminFormProduct = adminFormProductState[1]

  var adminFormDraftState = useState(buildShopMatchaDraft())
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
    // โหลดสินค้า matcha จาก backend และโหลดใหม่เมื่อหน้าอื่นเพิ่มสินค้า
    var ignore = false

    fetchMatchaShopProducts()
      .then(function(data) {
        if (!ignore) setProducts(data)
      })
      .catch(function() { return })

    return function() { ignore = true }
  }, [refreshKey])

  useEffect(function() {
    // โหลดข้อมูลแบบเต็มสำหรับ admin เพื่อใช้ตอนกดแก้สินค้า
    if (!isAdmin) return

    var ignore = false

    fetchAdminProducts(authUser.id)
      .then(function(data) {
        if (!ignore) setAdminProducts(Array.isArray(data) ? data : [])
      })
      .catch(function() { return })

    return function() { ignore = true }
  }, [isAdmin, refreshKey])

  var filterDefs = buildFilterDefs(products)

  var filtersState = useState(function() {
    var initialFilters = {}

    filterCatalog.forEach(function(def) {
      initialFilters[def.key] = new Set()
    })

    return initialFilters
  })
  var filters = filtersState[0]
  var setFilters = filtersState[1]

  function toggleFilter(key, value) {
    setFilters(function(previousFilters) {
      var nextFilters = {}

      Object.keys(previousFilters).forEach(function(filterKey) {
        nextFilters[filterKey] = new Set(previousFilters[filterKey])
      })

      if (nextFilters[key].has(value)) {
        nextFilters[key].delete(value)
      } else {
        nextFilters[key].add(value)
      }

      return nextFilters
    })
  }

  function clearFilters() {
    setFilters(function(previousFilters) {
      var nextFilters = {}

      Object.keys(previousFilters).forEach(function(key) {
        nextFilters[key] = new Set()
      })

      return nextFilters
    })
  }

  function openAdminForm() {
    // เปิดฟอร์มเพิ่มสินค้าใหม่
    setAdminFormProduct('new')
    setAdminFormDraft(buildShopMatchaDraft())
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
    // ส่งข้อมูลสินค้าไป backend แล้ว refresh หน้าอื่นที่ใช้สินค้าชุดเดียวกัน
    event.preventDefault()

    if (!isAdmin || adminFormSaving) return

    var isEditing = adminFormProduct && adminFormProduct !== 'new'

    setAdminFormSaving(true)
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')

    try {
      if (isEditing) {
        await updateAdminProduct(authUser.id, adminFormProduct.id, Object.assign({}, adminFormDraft, { collection: 'MATCHA' }))
      } else {
        await createAdminProduct(authUser.id, Object.assign({}, adminFormDraft, { collection: 'MATCHA' }))
      }

      var nextProducts = await fetchMatchaShopProducts()
      setProducts(Array.isArray(nextProducts) ? nextProducts : products)

      var nextAdminProducts = await fetchAdminProducts(authUser.id)
      setAdminProducts(Array.isArray(nextAdminProducts) ? nextAdminProducts : adminProducts)

      if (typeof onProductsChanged === 'function') onProductsChanged()

      if (isEditing) {
        setAdminFormFeedbackTone('success')
        setAdminFormFeedback('อัพเดทสินค้าเรียบร้อยแล้ว')
      } else {
        setAdminFormDraft(buildShopMatchaDraft())
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
    // ลบสินค้าออกจาก database แล้ว refresh ทุกหน้าที่ใช้สินค้า
    if (!isAdmin || !isEditing || adminDeleting) return

    var ok = window.confirm('Delete this product?')
    if (!ok) return

    setAdminDeleting(true)
    setAdminFormFeedback('')
    setAdminFormFeedbackTone('')

    try {
      await deleteAdminProduct(authUser.id, adminFormProduct.id)

      var nextProducts = await fetchMatchaShopProducts()
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

  var visibleProducts = products.filter(function(product) {
    return productMatchesFilters(product, filters)
  })
  var activeFilterCount = getActiveFilterCount(filters)

  var gridResult = useInView(0.05)
  var gridRef = gridResult[0]
  var gridIn = gridResult[1]

  var isEditing = adminFormProduct && adminFormProduct !== 'new'

  return (
    <div className="shop-page">
      <div className="shop-page-header">
        <h2 className="section-h-serif">The lineup</h2>
        <p className="section-h-cursive">Shop our cult classics and limited drops</p>
      </div>

      <div className="filter-bar">
        {filterDefs.map(function(def) {
          return (
            <FilterDropdown
              key={def.key}
              def={def}
              selected={filters[def.key]}
              onToggle={toggleFilter}
            />
          )
        })}
      </div>

      <div className="shop-results-meta">
        <p className="shop-results-copy">
          Showing {visibleProducts.length} of {products.length} matcha
        </p>
        {activeFilterCount > 0 ? (
          <button type="button" className="shop-results-reset" onClick={clearFilters}>
            CLEAR FILTERS
          </button>
        ) : null}
      </div>

      {visibleProducts.length > 0 || isAdmin ? (
        <div ref={gridRef} className="products-grid">
          {visibleProducts.map(function(product, index) {
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
              <span className="admin-add-product-label">ADD MATCHA</span>
              <span className="admin-add-product-copy">เพิ่มสินค้าใหม่ในหน้า Shop Matcha</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="shop-empty-state">
          <p className="shop-empty-title">No matcha fits that mix.</p>
          <p className="shop-empty-copy">Try clearing one of the filters to bring more products back in.</p>
        </div>
      )}

      {isAdmin && adminFormProduct !== null ? (
        <div className="shop-admin-product-modal-backdrop">
          <div className="shop-admin-product-modal" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit matcha product' : 'Add matcha product'}>
            <div className="shop-admin-product-modal-header">
              <div>
                <p className="shop-admin-product-eyebrow">SHOP MATCHA</p>
                <h3>{isEditing ? 'Edit matcha.' : 'Add new matcha.'}</h3>
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
                    placeholder="ROCKY'S"
                    value={adminFormDraft.name}
                    onChange={function(event) { updateDraft('name', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Display name</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="ROCKY'S — 20G"
                    value={adminFormDraft.displayName}
                    onChange={function(event) { updateDraft('displayName', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Slug</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="rockys-new"
                    value={adminFormDraft.slug}
                    onChange={function(event) { updateDraft('slug', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Origin label</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="From Uji"
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
                    placeholder="1650"
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
                    placeholder="/ROCKY1.jpg"
                    value={adminFormDraft.imagePath}
                    onChange={function(event) { updateDraft('imagePath', event.target.value) }}
                  />
                </label>

                <label className="shop-admin-product-field">
                  <span>Badge</span>
                  <input
                    type="text"
                    className="admin-order-input"
                    placeholder="NEW"
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
                    checked={adminFormDraft.featuredInKit}
                    onChange={function(event) { updateDraft('featuredInKit', event.target.checked) }}
                  />
                  Featured kit
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
