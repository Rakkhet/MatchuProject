import { useState, useEffect, useRef } from 'react'
import HomePage from './pages/HomePage'
import ShopMatchaPage from './pages/ShopMatchaPage'
import ShopKitPage from './pages/ShopKitPage'
import ShopToolsPage from './pages/ShopToolsPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import LoginPage from './pages/LoginPage'
import CartDrawer from './components/CartDrawer'
import { parsePriceLabel } from './lib/cartUtils'
import { fetchServerCart, syncServerCart, placeOrder, fetchOrders } from './lib/cartApi'
import './App.css'

// key พวกนี้ใช้เก็บข้อมูลใน localStorage
// เพื่อให้รีเฟรชหน้าแล้ว user กับ cart ยังอยู่เหมือนเดิม
var userStorageKey = 'glowmore-auth-user'
var cartStorageKey = 'glowmore-cart-items'
var cartOwnerStorageKey = 'glowmore-cart-owner'
var videoWarmupSources = ['/matcha1.mp4', '/matchaclip2.mp4', '/matcha3.mp4', '/matcha4.mp4']
var videoPosterSources = ['/matcha1-poster.png', '/matchaclip2-poster.png', '/matcha3-poster.png', '/matcha4-poster.png']
var kitBasePriceThb = 3900
var productPriceCatalogThb = {
  rockys: 1650,
  anya: 2100,
  'rockys-dreamin': 1950,
  mellow: 1990,
  'rockys-single-cultivar': 2850,
  'matcha-whisk-holder': 900,
  'latte-cup': 800,
  'matcha-whisk': 1700,
  'bamboo-whisk': 880,
  'matcha-strainer': 880,
}

function upgradeLegacyCartItem(item) {
  // ถ้าใน browser ยังมี cart เวอร์ชันเก่าอยู่
  // ฟังก์ชันนี้จะช่วยแปลงราคาจาก format เดิมให้เข้ากับระบบ THB ปัจจุบัน
  var currency = String(item && item.currency || '').toUpperCase()

  if (currency !== 'USD') {
    return item
  }

  var rawKey = String(item && (item.configKey || item.key) || '').trim().toLowerCase()
  var slug = item && item.itemType === 'KIT'
    ? rawKey.indexOf('kit:') === 0 ? rawKey.slice(4) : rawKey
    : rawKey.indexOf('product:') === 0 ? rawKey.slice(8) : rawKey
  var nextAmount = item && item.itemType === 'KIT'
    ? kitBasePriceThb + (slug && slug !== 'none' ? productPriceCatalogThb[slug] || 0 : 0)
    : productPriceCatalogThb[slug]

  if (typeof nextAmount !== 'number') {
    return item
  }

  return Object.assign({}, item, {
    unitAmount: nextAmount,
    currency: 'THB',
    price: nextAmount.toFixed(2) + ' B',
  })
}

function formatUserDate(value) {
  // เอาไว้ format วันที่ให้เป็นรูปแบบอ่านง่ายบนหน้าเว็บ
  if (!value) {
    return '—'
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value))
  } catch (_error) {
    return '—'
  }
}

function getOrderStatusMeta(order) {
  // backend ส่ง status มาเป็นหลายแบบ เช่น payment / shipping / order
  // ฟังก์ชันนี้รวมให้เหลือข้อความสั้นๆ ที่เอาไปแสดงใน dropdown ของ user ได้เลย
  var normalizedOrderStatus = String(order && order.status || '').toUpperCase()
  var normalizedPaymentStatus = String(order && order.paymentStatus || '').toUpperCase()
  var normalizedShippingStatus = String(order && order.shippingStatus || '').toUpperCase()
  var normalizedPaymentMethod = String(order && order.paymentMethod || '').toUpperCase()
  var fulfillmentLabel = 'Waiting to ship'
  var paymentLabel = 'Awaiting payment'
  var tone = 'pending'

  if (normalizedOrderStatus === 'CANCELLED' || normalizedShippingStatus === 'CANCELLED') {
    fulfillmentLabel = 'Cancelled'
    if (normalizedPaymentStatus === 'REFUNDED') {
      paymentLabel = 'Refunded'
    } else if (normalizedPaymentStatus === 'PAID') {
      paymentLabel = 'Paid before cancellation'
    } else if (normalizedPaymentStatus === 'UNDER_REVIEW') {
      paymentLabel = 'Review stopped'
    } else if (normalizedPaymentStatus === 'UPLOADED') {
      paymentLabel = 'Payment proof was submitted'
    } else {
      paymentLabel = 'Cancelled'
    }
    tone = 'neutral'
    return {
      fulfillmentLabel: fulfillmentLabel,
      paymentLabel: paymentLabel,
      tone: tone,
    }
  }

  if (normalizedPaymentStatus === 'UPLOADED' || normalizedPaymentStatus === 'PENDING') {
    fulfillmentLabel = 'Waiting for payment review'
    paymentLabel = 'Payment proof submitted'
    return {
      fulfillmentLabel: fulfillmentLabel,
      paymentLabel: paymentLabel,
      tone: tone,
    }
  }

  if (normalizedPaymentStatus === 'UNDER_REVIEW') {
    fulfillmentLabel = 'Payment under review'
    paymentLabel = 'Admin review in progress'
    return {
      fulfillmentLabel: fulfillmentLabel,
      paymentLabel: paymentLabel,
      tone: tone,
    }
  }

  if (normalizedShippingStatus === 'PREPARING') {
    fulfillmentLabel = 'Preparing order'
  } else if (normalizedShippingStatus === 'SHIPPED') {
    fulfillmentLabel = 'Shipped'
    tone = 'success'
  } else if (normalizedShippingStatus === 'DELIVERED') {
    fulfillmentLabel = 'Delivered'
    tone = 'success'
  }

  if (normalizedPaymentStatus === 'PAID') {
    if (normalizedPaymentMethod === 'PROMPTPAY_QR') {
      paymentLabel = 'Paid via PromptPay QR'
    } else {
      paymentLabel = 'Paid'
    }
  } else if (normalizedPaymentStatus === 'REFUNDED') {
    paymentLabel = 'Refunded'
    tone = 'neutral'
  }

  return {
    fulfillmentLabel: fulfillmentLabel,
    paymentLabel: paymentLabel,
    tone: tone,
  }
}

function loadStoredUser() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    var raw = window.localStorage.getItem(userStorageKey)
    return raw ? JSON.parse(raw) : null
  } catch (_error) {
    return null
  }
}

function loadStoredCart() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    var raw = window.localStorage.getItem(cartStorageKey)
    var parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.map(function(item) {
          return upgradeLegacyCartItem(item)
        })
      : []
  } catch (_error) {
    return []
  }
}

function loadStoredCartOwner() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.localStorage.getItem(cartOwnerStorageKey) || ''
  } catch (_error) {
    return ''
  }
}

function normalizeCartKeySegment(value) {
  var text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return text || 'item'
}

function createCartItem(rawItem) {
  // ทำให้ item ที่เก็บใน cart มีโครงสร้างเหมือนกันทั้งหมด
  // ไม่ว่าจะมาจากหน้า matcha, tools หรือ kit จะได้จัดการต่อได้ง่าย
  var priceData = parsePriceLabel(rawItem.price)
  var quantity = Math.max(1, Number(rawItem.quantity) || 1)

  return {
    key: rawItem.key,
    itemType: rawItem.itemType || 'PRODUCT',
    productId: rawItem.productId || null,
    configKey: rawItem.configKey || rawItem.key || '',
    name: rawItem.name,
    image: rawItem.image || '',
    price: priceData.label || String(rawItem.price || ''),
    unitAmount: priceData.amount,
    currency: priceData.currency,
    quantity: quantity,
    details: rawItem.details || '',
  }
}

function cartSignature(items) {
  return items
    .slice()
    .sort(function(a, b) { return a.key < b.key ? -1 : 1 })
    .map(function(item) { return item.key + ':' + item.quantity + ':' + String(item.unitAmount || 0) })
    .join('|')
}

function mergeCartItems(primaryItems, secondaryItems) {
  // ใช้ตอน user ล็อกอินแล้วมี cart ฝั่ง guest ค้างอยู่
  // เราจะรวมของเดิมใน server กับของที่ user ใส่ไว้ก่อนล็อกอินเข้าด้วยกัน
  var itemMap = new Map()

  function pushItems(items) {
    items.forEach(function(item) {
      if (!item || !item.key) {
        return
      }

      if (!itemMap.has(item.key)) {
        itemMap.set(item.key, Object.assign({}, item))
        return
      }

      var existing = itemMap.get(item.key)
      itemMap.set(item.key, Object.assign({}, existing, {
        itemType: existing.itemType || item.itemType,
        productId: existing.productId || item.productId,
        configKey: existing.configKey || item.configKey,
        image: existing.image || item.image,
        details: existing.details || item.details,
        price: item.price || existing.price,
        unitAmount: typeof item.unitAmount === 'number' ? item.unitAmount : existing.unitAmount,
        currency: item.currency || existing.currency,
        quantity: existing.quantity + item.quantity,
      }))
    })
  }

  pushItems(primaryItems)
  pushItems(secondaryItems)

  return Array.from(itemMap.values())
}

export default function App() {
  // ส่วนนี้คือ state หลักของทั้งแอป
  // เช่นตอนนี้อยู่หน้าไหน, login อยู่ไหม, cart เปิดไหม และมีออเดอร์ล่าสุดอะไร
  var pageState = useState('home')
  var currentPage = pageState[0]
  var setPage = pageState[1]

  var menuState = useState(false)
  var menuOpen = menuState[0]
  var setMenuOpen = menuState[1]

  var scrollState = useState(false)
  var scrolled = scrollState[0]
  var setScrolled = scrollState[1]

  var userState = useState(function() { return loadStoredUser() })
  var authUser = userState[0]
  var setAuthUser = userState[1]

  var cartState = useState(function() { return loadStoredCart() })
  var cartItems = cartState[0]
  var setCartItems = cartState[1]

  var cartOwnerState = useState(function() { return loadStoredCartOwner() })
  var cartOwner = cartOwnerState[0]
  var setCartOwner = cartOwnerState[1]

  var cartOpenState = useState(false)
  var cartOpen = cartOpenState[0]
  var setCartOpen = cartOpenState[1]

  var cartSyncState = useState(function() { return !loadStoredUser() })
  var cartSyncReady = cartSyncState[0]
  var setCartSyncReady = cartSyncState[1]

  var latestOrderState = useState(null)
  var latestOrder = latestOrderState[0]
  var setLatestOrder = latestOrderState[1]

  var userMenuOpenState = useState(false)
  var userMenuOpen = userMenuOpenState[0]
  var setUserMenuOpen = userMenuOpenState[1]

  var userOrdersState = useState([])
  var userOrders = userOrdersState[0]
  var setUserOrders = userOrdersState[1]

  var userOrdersLoadingState = useState(false)
  var userOrdersLoading = userOrdersLoadingState[0]
  var setUserOrdersLoading = userOrdersLoadingState[1]

  var userOrderCountState = useState(null)
  var userOrderCount = userOrderCountState[0]
  var setUserOrderCount = userOrderCountState[1]

  var userOrdersErrorState = useState('')
  var userOrdersError = userOrdersErrorState[0]
  var setUserOrdersError = userOrdersErrorState[1]

  var productRefreshKeyState = useState(0)
  var productRefreshKey = productRefreshKeyState[0]
  var setProductRefreshKey = productRefreshKeyState[1]

  var userMenuRef = useRef(null)

  useEffect(function() {
    // ใช้ดูว่าเลื่อนหน้าลงมาหรือยัง
    // เพื่อเปลี่ยน style ของ navbar ตอน scroll
    function onScroll() { setScrolled(window.scrollY > 40) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return function() { window.removeEventListener('scroll', onScroll) }
  }, [])

  useEffect(function() {
    // ทุกครั้งที่เปลี่ยนหน้าในแอป ให้เด้งกลับไปด้านบนสุดก่อน
    window.scrollTo(0, 0)
  }, [currentPage])

  useEffect(function() {
    // โหลด metadata ของวิดีโอไว้ล่วงหน้า
    // เวลาสลับหน้าแล้ววิดีโอจะขึ้นไวขึ้น ไม่ดำค้างนาน
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    var warmedVideos = videoWarmupSources.map(function(source) {
      var video = document.createElement('video')

      video.preload = 'metadata'
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.src = source
      video.load()

      return video
    })

    videoPosterSources.forEach(function(source) {
      var image = new window.Image()
      image.src = source
    })

    return function() {
      warmedVideos.forEach(function(video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      })
    }
  }, [])

  useEffect(function() {
    // ถ้ามี user ที่ login อยู่ ให้บันทึกไว้ใน localStorage
    // พอเปิดเว็บใหม่จะได้ดึงกลับมาใช้ต่อได้
    if (typeof window === 'undefined') {
      return
    }

    try {
      if (authUser) {
        window.localStorage.setItem(userStorageKey, JSON.stringify(authUser))
      } else {
        window.localStorage.removeItem(userStorageKey)
      }
    } catch (_error) {
      return
    }
  }, [authUser])

  function preventNav(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
  }

  function goShop(e) {
    preventNav(e)
    setPage('shop')
    setMenuOpen(false)
    setCartOpen(false)
    setUserMenuOpen(false)
  }

  function goKit(e) {
    preventNav(e)
    setPage('kit')
    setMenuOpen(false)
    setCartOpen(false)
    setUserMenuOpen(false)
  }

  function goTools(e) {
    preventNav(e)
    setPage('tools')
    setMenuOpen(false)
    setCartOpen(false)
    setUserMenuOpen(false)
  }

  function goHome(e) {
    preventNav(e)
    setPage('home')
    setMenuOpen(false)
    setCartOpen(false)
    setUserMenuOpen(false)
  }

  function goLogin(e) {
    preventNav(e)
    setPage('login')
    setMenuOpen(false)
    setCartOpen(false)
    setUserMenuOpen(false)
  }

  function goAdmin(e) {
    preventNav(e)

    if (!authUser || !authUser.isAdmin) {
      setPage(authUser ? 'home' : 'login')
      setMenuOpen(false)
      setCartOpen(false)
      setUserMenuOpen(false)
      return
    }

    setPage('admin')
    setMenuOpen(false)
    setCartOpen(false)
    setUserMenuOpen(false)
  }

  function handleAuthSuccess(user) {
    setLatestOrder(null)

    // ถ้าเปลี่ยนบัญชี อย่าให้ cart ของบัญชีเก่าค้างบนหน้าจอ
    // ยกเว้น cart แบบ guest ที่ตั้งใจให้ merge หลัง login ได้
    if (user && cartOwner && cartOwner !== 'guest' && cartOwner !== String(user.id)) {
      setCartItems([])
      setCartOwner('')
    }

    setAuthUser(user)
    setUserMenuOpen(false)
    setPage(user && user.isAdmin ? 'admin' : 'home')
  }

  function handleLogout(e) {
    preventNav(e)
    setAuthUser(null)
    setCartItems([])
    setCartOwner('')
    setLatestOrder(null)
    setPage('home')
    setMenuOpen(false)
    setCartOpen(false)
    setUserMenuOpen(false)
  }

  useEffect(function() {
    // เก็บ cart ลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems))
    } catch (_error) {
      return
    }
  }, [cartItems])

  useEffect(function() {
    // เก็บว่า cart นี้เป็นของ guest หรือของ user id ไหน
    // จะได้รู้ว่าตอน login ต้อง merge cart หรือไม่
    if (typeof window === 'undefined') {
      return
    }

    try {
      if (cartOwner) {
        window.localStorage.setItem(cartOwnerStorageKey, cartOwner)
      } else {
        window.localStorage.removeItem(cartOwnerStorageKey)
      }
    } catch (_error) {
      return
    }
  }, [cartOwner])

  useEffect(function() {
    // กันเคสเปิดเว็บมาแล้ว localStorage ยังมี cart ของ user คนเก่าค้างอยู่
    // ถ้าเจ้าของ cart ไม่ตรงกับ user ปัจจุบัน ให้ล้างก่อน ไม่โชว์ข้ามบัญชี
    if (authUser && !cartOwner && cartItems.length > 0) {
      setCartItems([])
      return
    }

    if (!cartOwner || cartOwner === 'guest') {
      return
    }

    if (!authUser || cartOwner !== String(authUser.id)) {
      setCartItems([])
      setCartOwner('')
    }
  }, [authUser, cartOwner, cartItems.length])

  useEffect(function() {
    // ตอนเปิด cart drawer จะล็อก scroll ของ body ไว้ก่อน
    // เพื่อไม่ให้หน้าเว็บด้านหลังเลื่อนตาม
    if (typeof document === 'undefined') {
      return
    }

    var previousOverflow = document.body.style.overflow

    if (cartOpen) {
      document.body.style.overflow = 'hidden'
    }

    return function() {
      document.body.style.overflow = previousOverflow
    }
  }, [cartOpen])

  useEffect(function() {
    // effect นี้ทำงานตอน user login
    // หน้าที่คือไปดึง cart จาก server แล้วตัดสินใจว่าจะรวมกับ cart แบบ guest ที่ค้างอยู่ไหม
    var ignore = false

    if (!authUser) {
      setCartSyncReady(true)
      return function() { ignore = true }
    }

    setCartSyncReady(false)

    fetchServerCart(authUser.id)
      .then(function(serverItems) {
        if (ignore) {
          return
        }

        var nextItems = serverItems
        var shouldMergeGuestCart = cartOwner === 'guest' && cartItems.length > 0

        if (shouldMergeGuestCart) {
          nextItems = mergeCartItems(serverItems, cartItems)

          return syncServerCart(authUser.id, nextItems)
            .then(function(savedItems) {
              if (ignore) {
                return
              }

              setCartItems(savedItems)
              setCartOwner(String(authUser.id))
              setCartSyncReady(true)
            })
            .catch(function() {
              if (ignore) {
                return
              }

              setCartItems(nextItems)
              setCartOwner(String(authUser.id))
              setCartSyncReady(true)
            })
        }

        setCartItems(nextItems)
        setCartOwner(String(authUser.id))
        setCartSyncReady(true)
      })
      .catch(function() {
        if (ignore) {
          return
        }

        setCartSyncReady(true)
      })

    return function() { ignore = true }
  }, [authUser])

  useEffect(function() {
    if (!authUser || !cartSyncReady) {
      return
    }

    var ignore = false
    syncServerCart(authUser.id, cartItems)
      .then(function(serverItems) {
        if (ignore) return
        if (cartSignature(serverItems) !== cartSignature(cartItems)) {
          setCartItems(serverItems)
        }
      })
      .catch(function() { return })
    return function() { ignore = true }
  }, [authUser, cartItems, cartSyncReady])

  useEffect(function() {
    // ให้กดปุ่ม Escape เพื่อปิด cart ได้
    if (!cartOpen) {
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setCartOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return function() {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [cartOpen])

  function onProductsChanged() {
    setProductRefreshKey(function(k) { return k + 1 })
  }

  function openCart(e) {
    preventNav(e)
    setMenuOpen(false)
    setCartOpen(true)
    setUserMenuOpen(false)
  }

  function closeCart() {
    setCartOpen(false)
  }

  useEffect(function() {
    // ถ้า logout แล้ว ให้ล้างข้อมูลใน dropdown account ด้วย
    if (!authUser) {
      setUserMenuOpen(false)
      setUserOrders([])
      setUserOrderCount(null)
      setUserOrdersError('')
      setUserOrdersLoading(false)
    }
  }, [authUser])

  useEffect(function() {
    // กันกรณี user ที่ไม่ใช่ admin พยายามเข้าหน้า admin
    // ถ้าไม่ผ่านเงื่อนไขก็พากลับไปหน้าที่เหมาะสม
    if (currentPage !== 'admin') {
      return
    }

    if (!authUser) {
      setPage('login')
      return
    }

    if (!authUser.isAdmin) {
      setPage('home')
    }
  }, [authUser, currentPage])

  useEffect(function() {
    // จะโหลดประวัติออเดอร์ก็ต่อเมื่อ user เปิด dropdown ของตัวเอง
    // แบบนี้ช่วยลดการยิง API โดยไม่จำเป็น
    var ignore = false

    if (!authUser || !userMenuOpen) {
      return function() { ignore = true }
    }

    setUserOrdersLoading(true)
    setUserOrdersError('')

    fetchOrders(authUser.id)
      .then(function(result) {
        if (ignore) {
          return
        }

        setUserOrders(Array.isArray(result && result.orders) ? result.orders : [])
        setUserOrderCount(typeof result?.nonCancelledOrderCount === 'number' ? result.nonCancelledOrderCount : 0)
        setUserOrdersError('')
      })
      .catch(function(error) {
        if (ignore) {
          return
        }

        setUserOrderCount(null)
        setUserOrdersError(error && error.message ? error.message : 'Could not load your orders right now.')
      })
      .finally(function() {
        if (ignore) {
          return
        }

        setUserOrdersLoading(false)
      })

    return function() { ignore = true }
  }, [authUser, userMenuOpen, latestOrder])

  useEffect(function() {
    // ถ้าเปิด dropdown อยู่ ให้กดข้างนอกหรือกด Escape เพื่อปิดได้
    if (!userMenuOpen || typeof document === 'undefined') {
      return
    }

    function handlePointerDown(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return function() {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [userMenuOpen])

  function addCartItem(nextItem) {
    // เพิ่มสินค้าเข้า cart
    // ถ้ามีชิ้นเดิมอยู่แล้วจะเพิ่ม quantity แทน ไม่สร้างรายการซ้ำ
    setLatestOrder(null)
    setCartItems(function(prevItems) {
      var existingIndex = prevItems.findIndex(function(item) {
        return item.key === nextItem.key
      })

      if (existingIndex === -1) {
        return [nextItem].concat(prevItems)
      }

      return prevItems.map(function(item, index) {
        if (index !== existingIndex) {
          return item
        }

        return Object.assign({}, item, {
          quantity: item.quantity + nextItem.quantity,
          image: nextItem.image || item.image,
          price: nextItem.price || item.price,
          unitAmount: typeof nextItem.unitAmount === 'number' ? nextItem.unitAmount : item.unitAmount,
          currency: nextItem.currency || item.currency,
          details: nextItem.details || item.details,
        })
      })
    })

    setCartOwner(authUser ? String(authUser.id) : 'guest')
    setCartOpen(true)
  }

  function handleAddToCart(product) {
    // แปลงข้อมูลสินค้าปกติจากหน้า shop ให้กลายเป็น cart item
    var itemKey = 'product:' + normalizeCartKeySegment(product.slug || product.id || product.name)

    addCartItem(
      createCartItem({
        key: itemKey,
        itemType: 'PRODUCT',
        productId: product.id || null,
        configKey: product.slug || itemKey,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity: 1,
        details: product.origin || '',
      })
    )
  }

  function handleAddKitToCart(config) {
    // คล้ายกับด้านบน แต่กรณีนี้เป็นชุด kit ที่มี config เพิ่มเข้ามา
    var itemKey = config.key || ('kit:' + normalizeCartKeySegment(config.name))

    addCartItem(
      createCartItem({
        key: itemKey,
        itemType: 'KIT',
        productId: null,
        configKey: config.key || itemKey,
        name: config.name,
        image: config.image,
        price: config.price,
        quantity: config.quantity,
        details: config.details,
      })
    )
  }

  function changeCartItemQuantity(itemKey, delta) {
    setLatestOrder(null)
    setCartItems(function(prevItems) {
      return prevItems.reduce(function(nextItems, item) {
        if (item.key !== itemKey) {
          nextItems.push(item)
          return nextItems
        }

        var nextQuantity = item.quantity + delta

        if (nextQuantity > 0) {
          nextItems.push(Object.assign({}, item, { quantity: nextQuantity }))
        }

        return nextItems
      }, [])
    })

    setCartOwner(authUser ? String(authUser.id) : 'guest')
  }

  function removeCartItem(itemKey) {
    setLatestOrder(null)
    setCartItems(function(prevItems) {
      return prevItems.filter(function(item) {
        return item.key !== itemKey
      })
    })

    setCartOwner(authUser ? String(authUser.id) : 'guest')
  }

  async function handleCheckout(payload) {
    // ส่งข้อมูล checkout ทั้งหมดไป backend
    // ถ้าสั่งซื้อสำเร็จจะล้าง cart และเก็บออเดอร์ล่าสุดไว้โชว์ต่อ
    if (!authUser) {
      setPage('login')
      setCartOpen(false)
      throw new Error('Please sign in before placing your order.')
    }

    var order = await placeOrder({
      userId: authUser.id,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      shippingAddressLine1: payload.shippingAddressLine1,
      shippingAddressLine2: payload.shippingAddressLine2,
      shippingDistrict: payload.shippingDistrict,
      shippingProvince: payload.shippingProvince,
      shippingPostalCode: payload.shippingPostalCode,
      shippingCountry: payload.shippingCountry,
      notes: payload.notes || '',
      paymentMethod: payload.paymentMethod,
      paymentReference: payload.paymentReference,
      paymentQrCodeImage: payload.paymentQrCodeImage,
      paymentProofImage: payload.paymentProofImage,
      paymentProofFileName: payload.paymentProofFileName,
      paymentProofMimeType: payload.paymentProofMimeType,
    })

    setCartItems([])
    setCartOwner(String(authUser.id))
    setLatestOrder(order)
    return order
  }

  var cartItemCount = cartItems.reduce(function(total, item) {
    return total + item.quantity
  }, 0)
  var showCartEntry = currentPage !== 'admin'

  var accountOrderCountText = userOrdersLoading && userOrderCount === null
    ? 'Loading...'
    : userOrderCount === null
      ? '—'
      : String(userOrderCount)

  function pageShellClass(pageName) {
    // ใช้กำหนด class ว่าหน้าไหน active อยู่
    // หน้าอื่นจะถูกซ่อนไว้ แต่ยัง mount ค้างอยู่เพื่อให้วิดีโอลื่นขึ้น
    return 'app-page-shell' + (currentPage === pageName ? ' app-page-shell-active' : ' app-page-shell-hidden')
  }

  return (
    <div className="landing">

      {/* Page border frame */}
      <div className="page-border" aria-hidden="true" />

      {/* Navbar */}
      <header className={'navbar' + (scrolled ? ' navbar-scrolled' : '')}>
        <nav className="nav-left">
          <a href="#" onClick={goShop}>SHOP MATCHA</a>
          <a href="#" onClick={goKit}>SHOP KIT</a>
          <a href="#" onClick={goTools}>SHOP TOOLS</a>
        </nav>
        <a href="#" className="nav-logo" onClick={goHome}>GLOWMORE</a>
        <nav className="nav-right">
          {authUser ? (
            <div className="nav-user">
              <div className="nav-user-menu" ref={userMenuRef}>
                <button
                  type="button"
                  className={'nav-username-button' + (userMenuOpen ? ' open' : '')}
                  onClick={function() { setUserMenuOpen(!userMenuOpen) }}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="dialog"
                >
                  <span className="nav-username">{authUser.displayName}</span>
                  <span className="nav-user-caret">&#9662;</span>
                </button>

                {userMenuOpen ? (
                  <div className="account-dropdown" role="dialog" aria-label="Account overview">
                    <div className="account-dropdown-section">
                      <p className="account-dropdown-eyebrow">ACCOUNT</p>
                      <h3 className="account-dropdown-title">{authUser.displayName}</h3>
                      <p className="account-dropdown-email">{authUser.email}</p>
                      {authUser.isAdmin ? (
                        <button type="button" className="account-admin-link" onClick={goAdmin}>
                          Admin dashboard
                        </button>
                      ) : null}
                      <div className="account-summary-grid">
                        <div className="account-summary-card">
                          <span className="account-summary-label">Member since</span>
                          <strong className="account-summary-value">{formatUserDate(authUser.createdAt)}</strong>
                        </div>
                        <div className="account-summary-card">
                          <span className="account-summary-label">Orders placed</span>
                          <strong className="account-summary-value">{accountOrderCountText}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="account-dropdown-section">
                      <div className="account-dropdown-heading-row">
                        <div>
                          <p className="account-dropdown-eyebrow">RECENT ORDERS</p>
                          <h4 className="account-dropdown-subtitle">Track your matcha</h4>
                        </div>
                      </div>

                      {userOrdersLoading ? (
                        <p className="account-dropdown-feedback">Loading your recent orders...</p>
                      ) : userOrdersError ? (
                        <p className="account-dropdown-feedback">{userOrdersError}</p>
	                      ) : userOrders.length ? (
	                        <div className="account-order-list">
	                          {userOrders.map(function(order) {
	                            var statusMeta = getOrderStatusMeta(order)
	                            var hasTrackingDetails = Boolean(order.trackingNumber || order.shippingCarrier)
	                            var trackingIsLive = order.shippingStatus === 'SHIPPED' || order.shippingStatus === 'DELIVERED'

	                            return (
	                              <article key={order.id} className="account-order-card">
                                <div className="account-order-top">
                                  <div>
                                    <p className="account-order-id">Order #{order.id}</p>
                                    <p className="account-order-date">{formatUserDate(order.createdAt)}</p>
                                  </div>
                                  <span className={'account-order-badge ' + statusMeta.tone}>
                                    {statusMeta.fulfillmentLabel}
                                  </span>
                                </div>

                                <div className="account-order-meta">
                                  <div>
                                    <span className="account-order-meta-label">Payment</span>
                                    <strong className="account-order-meta-value">{statusMeta.paymentLabel}</strong>
                                  </div>
                                  <div>
                                    <span className="account-order-meta-label">Total</span>
                                    <strong className="account-order-meta-value">
                                      {order.totals && order.totals.totalLabel ? order.totals.totalLabel : order.totalSummary}
                                    </strong>
                                  </div>
                                </div>

	                                {hasTrackingDetails ? (
	                                  <div className="account-order-tracking">
	                                    <span className="account-order-meta-label">
	                                      {trackingIsLive ? 'Tracking details' : 'Shipment details'}
	                                    </span>
	                                    <div className="account-order-tracking-grid">
	                                      {order.shippingCarrier ? (
	                                        <div>
	                                          <span className="account-order-meta-label">Carrier</span>
	                                          <strong className="account-order-meta-value">{order.shippingCarrier}</strong>
	                                        </div>
	                                      ) : null}
	                                      {order.trackingNumber ? (
	                                        <div>
	                                          <span className="account-order-meta-label">Tracking number</span>
	                                          <strong className="account-order-meta-value">{order.trackingNumber}</strong>
	                                        </div>
	                                      ) : null}
	                                    </div>
	                                    {trackingIsLive ? (
	                                      <p className="account-order-tracking-note">
	                                        Your parcel is on the way. Use this tracking number with the carrier for live delivery updates.
	                                      </p>
	                                    ) : (
	                                      <p className="account-order-tracking-note">
	                                        Your shipping label is being prepared. Tracking will become active as soon as the carrier scans the parcel.
	                                      </p>
	                                    )}
	                                  </div>
	                                ) : null}

	                                <div className="account-order-items">
                                  {order.items.map(function(item) {
                                    return (
                                      <div key={item.key} className="account-order-item">
                                        <span className="account-order-item-name">{item.name}</span>
                                        <span className="account-order-item-qty">x{item.quantity}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="account-dropdown-feedback">No orders yet. Your first bowl is still waiting.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <button type="button" className="nav-user-logout" onClick={handleLogout}>
                LOG OUT
              </button>
            </div>
          ) : (
            <a href="#" className="nav-icon-btn" onClick={goLogin} aria-label="Account">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </a>
          )}
          {showCartEntry ? (
            <button type="button" className="nav-icon-btn nav-cart-btn" onClick={openCart} aria-label="Cart">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              {cartItemCount > 0 ? <span className="nav-cart-count">{cartItemCount}</span> : null}
            </button>
          ) : null}
        </nav>
        <button className="nav-hamburger" onClick={function() { setMenuOpen(!menuOpen) }} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          {[
            { label: 'SHOP MATCHA', onClick: goShop },
            { label: 'SHOP KIT',    onClick: goKit },
            { label: 'SHOP TOOLS',  onClick: goTools },
            showCartEntry ? { label: cartItemCount > 0 ? 'CART (' + cartItemCount + ')' : 'CART', onClick: openCart } : null,
            authUser
              ? { label: authUser.displayName.toUpperCase(), onClick: function(e) { e.preventDefault(); setMenuOpen(false) } }
              : { label: 'ACCOUNT', onClick: goLogin },
            authUser && authUser.isAdmin
              ? { label: 'ADMIN DASHBOARD', onClick: goAdmin }
              : null,
            authUser
              ? { label: 'LOG OUT', onClick: handleLogout }
              : null,
          ].filter(Boolean).map(function(item) {
            return <a key={item.label} href="#" onClick={item.onClick}>{item.label}</a>
          })}
        </div>
      )}

      <div className={pageShellClass('home')}>
        <HomePage
          goShop={goShop}
          goKit={goKit}
          goTools={goTools}
          goLogin={goLogin}
          onAddToCart={handleAddToCart}
          authUser={authUser}
          isActive={currentPage === 'home'}
          refreshKey={productRefreshKey}
        />
      </div>

      <div className={pageShellClass('kit')}>
        <ShopKitPage
          onAddToCart={handleAddToCart}
          onAddKitToCart={handleAddKitToCart}
          authUser={authUser}
          onProductsChanged={onProductsChanged}
          isActive={currentPage === 'kit'}
          refreshKey={productRefreshKey}
        />
      </div>

      <div className={pageShellClass('login')}>
        <LoginPage
          goHome={goHome}
          onLogin={handleAuthSuccess}
          isActive={currentPage === 'login'}
        />
      </div>

      {currentPage === 'shop'
        ? <ShopMatchaPage onAddToCart={handleAddToCart} authUser={authUser} onProductsChanged={onProductsChanged} refreshKey={productRefreshKey} />
        : currentPage === 'tools'
        ? <ShopToolsPage onAddToCart={handleAddToCart} authUser={authUser} onProductsChanged={onProductsChanged} refreshKey={productRefreshKey} />
        : currentPage === 'admin'
        ? <AdminDashboardPage authUser={authUser} goHome={goHome} />
        : null}

      <CartDrawer
        open={cartOpen}
        items={cartItems}
        authUser={authUser}
        latestOrder={latestOrder}
        onClose={closeCart}
        onCheckout={handleCheckout}
        onRequestLogin={goLogin}
        onIncrement={function(itemKey) { changeCartItemQuantity(itemKey, 1) }}
        onDecrement={function(itemKey) { changeCartItemQuantity(itemKey, -1) }}
        onRemove={removeCartItem}
      />

    </div>
  )
}
