import { useRef, useState, useEffect } from 'react'
import { useInView } from '../hooks/useInView'
import ProductCard from '../components/ProductCard'
import BackgroundVideo from '../components/BackgroundVideo'
import { fetchHomeStorefront } from '../lib/storefrontApi'
import { fetchHomepageReviews, submitHomepageReview } from '../lib/reviewsApi'

var heroVideo = '/matcha1.mp4'
var storyVideo = '/matchaclip2.mp4'

// ข้อมูลชุดนี้เป็น fallback ชั่วคราว
// ใช้แสดงก่อนที่หน้า home จะดึงข้อมูลจริงจาก backend กลับมา
var matchaProducts = [
  { id: 1, slug: 'rockys', name: "ROCKY'S", origin: 'From Kagoshima', price: '1650.00 B', badge: 'NEW', soldOut: false, image: '/ROCKY1.jpg' },
  { id: 2, slug: 'anya', name: 'ANYA', origin: 'From Fukuoka', price: '2100.00 B', badge: 'NEW', soldOut: false, image: '/ANYA1.jpg' },
  { id: 3, slug: 'rockys-dreamin', name: "ROCKY'S DREAMIN", origin: 'From Kyoto', price: '1950.00 B', badge: 'NEW', soldOut: false, image: '/ROCKYS_DREAMIN1.jpg' },
  { id: 4, slug: 'mellow', name: 'MELLOW', origin: 'From Uji', price: '1990.00 B', badge: 'NEW', soldOut: false, image: '/MELLOW1.jpg' },
  { id: 5, slug: 'rockys-single-cultivar', name: "ROCKY'S SINGLE CULTIVAR", origin: 'From Shizuoka', price: '2850.00 B', badge: 'NEW', soldOut: false, image: '/ROCKYS_SINGLE_CULTIVAR1.jpg' },
]

var tools = [
  { id: 6, slug: 'matcha-whisk-holder', name: 'MATCHA WHISK HOLDER', price: '900.00 B', badge: 'SOLD OUT', soldOut: true, image: '/MATCHA WHISK HOLDER.jpg' },
  { id: 7, slug: 'latte-cup', name: 'LATTE CUP', price: '800.00 B', badge: 'TOOLS', soldOut: false, image: '/LATTE CUP.jpg' },
  { id: 8, slug: 'matcha-whisk', name: 'MATCHA WHISK', price: '1700.00 B', badge: 'SOLD OUT', soldOut: true, image: '/MATCHA WHISK.jpg' },
  { id: 9, slug: 'bamboo-whisk', name: 'BAMBOO WHISK', price: '880.00 B', badge: 'TOOLS', soldOut: false, image: '/BAMBOO WHISK.jpg' },
  { id: 10, slug: 'matcha-strainer', name: 'MATCHA STRAINER', price: '880.00 B', badge: 'TOOLS', soldOut: false, image: '/MATCHA STRAINER.jpg' },
]

var sourceRegions = [
  {
    id: '01',
    name: 'Uji, Kyoto',
    profile: 'Silky umami, sweet finish, and the kind of ceremonial depth that made Uji famous.',
    detail: 'Stone-milled from shaded first-harvest leaves.',
  },
  {
    id: '02',
    name: 'Yame, Fukuoka',
    profile: 'Floral aromatics and mellow sweetness with a soft, lingering finish.',
    detail: 'A slow-grown style prized for elegant complexity.',
  },
  {
    id: '03',
    name: 'Kagoshima',
    profile: 'Bright green lift, fresh grass notes, and a fuller-bodied cup.',
    detail: 'Southern volcanic soil brings extra energy to the blend.',
  },
]

var sourceVisualItems = [
  { id: 'story-1', type: 'MATCHA', name: "ROCKY'S", image: '/ROCKY1.jpg', className: 'v1' },
  { id: 'story-2', type: 'MATCHA', name: 'ANYA', image: '/ANYA1.jpg', className: 'v2' },
  { id: 'story-3', type: 'TOOLS', name: 'MATCHA WHISK HOLDER', image: '/MATCHA WHISK HOLDER.jpg', className: 'v3' },
  { id: 'story-4', type: 'TOOLS', name: 'BAMBOO WHISK', image: '/BAMBOO WHISK.jpg', className: 'v4' },
]

var kitVisualItems = [
  { id: 'kit-1', name: "ROCKY'S", image: '/ROCKY1.jpg', className: 'kc1' },
  { id: 'kit-2', name: 'ANYA', image: '/ANYA1.jpg', className: 'kc2' },
  { id: 'kit-3', name: 'MELLOW', image: '/MELLOW1.jpg', className: 'kc3' },
]

function SourceMapGraphic() {
  // ส่วนรูปแผนที่ใน popup learn more
  // แยกเป็น component ย่อยไว้เพื่อให้ JSX ของ modal ไม่ยาวเกินไป
  return (
    <div className="source-map-frame">
      <div className="source-map-badge" aria-hidden="true">
        <span className="source-map-badge-dot" />
        <span>Uji • Yame • Kagoshima</span>
      </div>

      <div className="source-map-image-shell">
        <img
          className="source-map-image"
          src="/japanmap2.png"
          alt="Stylized map of Japan highlighting matcha source regions including Uji, Yame, and Kagoshima."
        />
        <div className="source-map-image-tint" aria-hidden="true" />
      </div>
    </div>
  )
}

function Carousel(props) {
  // component แถวสินค้าแบบเลื่อนข้าง
  // ใช้ซ้ำได้ทั้ง section matcha และ tools
  var items = props.items
  var label = props.label
  var animate = props.animate
  var onAddToCart = props.onAddToCart
  var scrollRef = useRef(null)

  function scroll(dir) {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 420, behavior: 'smooth' })
    }
  }

  return (
    <div className="carousel-wrapper">
      <div className="carousel" ref={scrollRef}>
        {items.map(function (p, i) {
          return <ProductCard key={p.id} product={p} animate={animate} delay={i * 80} onAddToCart={onAddToCart} />
        })}
      </div>
      <button className="carousel-arrow carousel-arrow-right" onClick={function () { scroll(1) }} aria-label={'Scroll ' + label + ' right'}>
        &#8250;
      </button>
    </div>
  )
}

function createDefaultReviewViewer(authUser) {
  // ค่านี้คือ state เริ่มต้นของส่วนรีวิว
  // ใช้ก่อนที่เราจะรู้จาก backend ว่า user คนนี้มีสิทธิ์รีวิวหรือยัง
  if (!authUser) {
    return {
      canSubmit: false,
      hasCompletedPurchase: false,
      reviewedOrderCount: 0,
      eligibleOrderId: null,
      eligibleOrderLabel: '',
      message: 'Sign in after your first paid order to leave a verified review.',
    }
  }

  return {
    canSubmit: false,
    hasCompletedPurchase: false,
    reviewedOrderCount: 0,
    eligibleOrderId: null,
    eligibleOrderLabel: '',
    message: 'Reviews unlock after your first paid order is approved.',
  }
}

function formatReviewDate(value) {
  // แปลงวันที่รีวิวให้สั้นและอ่านง่าย
  if (!value) {
    return ''
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch (_error) {
    return ''
  }
}

function formatReviewStars(rating) {
  // แปลงเลข rating 1-5 ให้เป็นดาวเต็ม/ดาวว่าง
  var filled = Math.max(0, Math.min(5, Number(rating) || 0))
  return '\u2605'.repeat(filled) + '\u2606'.repeat(5 - filled)
}

export default function HomePage(props) {
  var goShop = props.goShop
  var goKit = props.goKit
  var goTools = props.goTools
  var goLogin = props.goLogin
  var onAddToCart = props.onAddToCart
  var authUser = props.authUser
  var isActive = props.isActive !== false
  var refreshKey = props.refreshKey || 0
  var sourceModalState = useState(false)
  var sourceModalOpen = sourceModalState[0]
  var setSourceModalOpen = sourceModalState[1]

  var homeMatchaState = useState(matchaProducts)
  var homeMatchaProducts = homeMatchaState[0]
  var setHomeMatchaProducts = homeMatchaState[1]

  var homeToolsState = useState(tools)
  var homeToolsProducts = homeToolsState[0]
  var setHomeToolsProducts = homeToolsState[1]

  var homeReviewsState = useState([])
  var homeReviews = homeReviewsState[0]
  var setHomeReviews = homeReviewsState[1]

  var reviewViewerState = useState(createDefaultReviewViewer(authUser))
  var reviewViewer = reviewViewerState[0]
  var setReviewViewer = reviewViewerState[1]

  var reviewsLoadingState = useState(true)
  var reviewsLoading = reviewsLoadingState[0]
  var setReviewsLoading = reviewsLoadingState[1]

  var reviewsErrorState = useState('')
  var reviewsError = reviewsErrorState[0]
  var setReviewsError = reviewsErrorState[1]

  var reviewRatingState = useState(5)
  var reviewRating = reviewRatingState[0]
  var setReviewRating = reviewRatingState[1]

  var reviewTextState = useState('')
  var reviewText = reviewTextState[0]
  var setReviewText = reviewTextState[1]

  var reviewSubmittingState = useState(false)
  var reviewSubmitting = reviewSubmittingState[0]
  var setReviewSubmitting = reviewSubmittingState[1]

  var reviewFeedbackState = useState('')
  var reviewFeedback = reviewFeedbackState[0]
  var setReviewFeedback = reviewFeedbackState[1]

  var reviewFeedbackToneState = useState('')
  var reviewFeedbackTone = reviewFeedbackToneState[0]
  var setReviewFeedbackTone = reviewFeedbackToneState[1]

  useEffect(function() {
    var ignore = false

    fetchHomeStorefront()
      .then(function(data) {
        if (ignore) return
        if (data.matchaProducts) setHomeMatchaProducts(data.matchaProducts)
        if (data.toolsProducts) setHomeToolsProducts(data.toolsProducts)
      })
      .catch(function() {
        return
      })

    return function() { ignore = true }
  }, [refreshKey])

  useEffect(function() {
    // ดึงรีวิวจริงจากฐานข้อมูล
    // พร้อมเช็กด้วยว่า user ที่ login อยู่มีสิทธิ์เขียนรีวิวหรือไม่
    var ignore = false
    var viewerFallback = createDefaultReviewViewer(authUser)

    setReviewsLoading(true)
    setReviewsError('')

    fetchHomepageReviews(authUser ? authUser.id : null)
      .then(function(data) {
        if (ignore) return

        setHomeReviews(Array.isArray(data && data.reviews) ? data.reviews : [])
        setReviewViewer(data && data.viewer ? data.viewer : viewerFallback)
      })
      .catch(function(error) {
        if (ignore) return

        setHomeReviews([])
        setReviewViewer(viewerFallback)
        setReviewsError(error && error.message ? error.message : 'Could not load customer reviews right now.')
      })
      .finally(function() {
        if (!ignore) {
          setReviewsLoading(false)
        }
      })

    return function() { ignore = true }
  }, [authUser ? authUser.id : 0])

  useEffect(function() {
    // ถ้าหน้า home ถูกซ่อนไว้เพราะ user เปลี่ยนไปหน้าอื่น
    // ให้ปิด popup และเคลียร์ข้อความ feedback บางส่วนไว้ก่อน
    if (isActive) {
      return
    }

    setSourceModalOpen(false)
    setReviewFeedback('')
    setReviewFeedbackTone('')
  }, [isActive])

  async function handleReviewSubmit(event) {
    // การส่งรีวิวจะผูกกับออเดอร์ที่จ่ายเงินจริงแล้วเท่านั้น
    // เพื่อให้รีวิวบนหน้า home เป็นรีวิวจากลูกค้าจริง ไม่ใช่ใครก็โพสต์ได้
    event.preventDefault()

    if (!authUser) {
      if (typeof goLogin === 'function') {
        goLogin()
      }
      return
    }

    if (!reviewViewer.canSubmit || !reviewViewer.eligibleOrderId || reviewSubmitting) {
      return
    }

    setReviewSubmitting(true)
    setReviewFeedback('')
    setReviewFeedbackTone('')

    try {
      var result = await submitHomepageReview({
        userId: authUser.id,
        orderId: reviewViewer.eligibleOrderId,
        rating: reviewRating,
        text: reviewText,
      })

      if (result && result.review) {
        setHomeReviews(function(currentReviews) {
          return [result.review]
            .concat(currentReviews.filter(function(entry) { return entry.id !== result.review.id }))
            .slice(0, 6)
        })
      }

      setReviewViewer(result && result.viewer ? result.viewer : createDefaultReviewViewer(authUser))
      setReviewText('')
      setReviewRating(5)
      setReviewFeedbackTone('success')
      setReviewFeedback('Your verified review is now live.')
    } catch (error) {
      setReviewFeedbackTone('error')
      setReviewFeedback(error && error.message ? error.message : 'Could not save your review right now.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  useEffect(function() {
    // ตอนเปิด modal แหล่งที่มาของ matcha
    // จะล็อก scroll ของหน้าไว้และให้กด Escape เพื่อปิด modal ได้
    if (!sourceModalOpen || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    var previousOverflow = document.body.style.overflow

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setSourceModalOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return function() {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [sourceModalOpen, isActive])

  var lineupResult = useInView()
  var toolsResult = useInView()
  var storyResult = useInView()
  var kitResult = useInView()
  var reviewsResult = useInView()
  var newsResult = useInView()

  var lineupRef = lineupResult[0]; var lineupIn = lineupResult[1]
  var toolsRef = toolsResult[0]; var toolsIn = toolsResult[1]
  var storyRef = storyResult[0]; var storyIn = storyResult[1]
  var kitRef = kitResult[0]; var kitIn = kitResult[1]
  var reviewsRef = reviewsResult[0]; var reviewsIn = reviewsResult[1]
  var newsRef = newsResult[0]; var newsIn = newsResult[1]

  return (
    <>
      {/* Hero */}
      <section className="hero">
        {heroVideo ? (
          <BackgroundVideo
            className="hero-video"
            src={heroVideo}
            poster="/matcha1-poster.png"
            preload="auto"
          />
        ) : (
          <img className="hero-video" src="/matcha1-poster.png" alt="" />
        )}
        <div className="hero-overlay">
          <h1 className="hero-title anim-hero-title">
            Matcha. Made with<br />uncommon care.
          </h1>
          <p className="hero-sub anim-hero-sub">From Japan.</p>
          <div className="hero-buttons anim-hero-btns">
            <button className="btn-lime" onClick={goShop}>SHOP MATCHA</button>
            <button className="btn-white-outline" onClick={goKit}>SHOP KIT</button>
          </div>
        </div>
        <div className="hero-scroll-hint anim-hero-scroll">
          <span />
        </div>
      </section>

      {/* The Lineup */}
      <section ref={lineupRef} className={'section reveal' + (lineupIn ? ' revealed' : '')}>
        <div className="section-header">
          <div>
            <h2 className="section-h-serif">The lineup</h2>
            <p className="section-h-cursive">Shop our cult classics and limited drops</p>
          </div>
          <button className="btn-black-outline" onClick={goShop}>SHOP THE MATCHA</button>
        </div>
        <Carousel items={homeMatchaProducts} label="matcha" animate={lineupIn} onAddToCart={onAddToCart} />
      </section>

      {/* Tools */}
      <section ref={toolsRef} className={'section section-light reveal' + (toolsIn ? ' revealed' : '')}>
        <div className="section-header">
          <div>
            <h2 className="section-h-serif">Tools of the trade</h2>
            <p className="section-h-cursive">Elevate your craft</p>
          </div>
          <button className="btn-black-outline" onClick={goTools}>SHOP TOOLS</button>
        </div>
        <Carousel items={homeToolsProducts} label="tools" animate={toolsIn} onAddToCart={onAddToCart} />

      </section>

      {/* Story Band */}
      <section ref={storyRef} className="story-band">
        <div className={'story-band-inner reveal reveal-left' + (storyIn ? ' revealed' : '')}>
          {storyVideo ? (
            <BackgroundVideo
              className="story-band-video"
              src={storyVideo}
              poster="/matchaclip2-poster.png"
              preload="auto"
            />
          ) : null}
          <div className="story-band-overlay" />
          <div className="story-band-content">
            <p className="story-label">TO THE SOURCE</p>
            <h2 className="story-heading">Japan&#39;s finest,<br />brought to you.</h2>
            <p className="story-body">
              We partner directly with small family farms across Kagoshima, Yame,
              and Uji &#8212; regions where matcha has been grown for centuries. Every
              bag carries a story of place, season, and uncommon care.
            </p>
            <button className="btn-lime" type="button" onClick={function() { setSourceModalOpen(true) }}>
              LEARN MORE
            </button>
          </div>
        </div>
        <div className={'story-band-visual reveal reveal-right' + (storyIn ? ' revealed' : '')}>
          <div className="story-visual-grid">
            {sourceVisualItems.map(function(item) {
              return (
                <div key={item.id} className={'visual-block ' + item.className}>
                  <img className="visual-block-image" src={item.image} alt={item.name} />
                  <div className="visual-block-copy">
                    <span className="visual-block-kicker">{item.type}</span>
                    <span className="visual-block-name">{item.name}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Kit Showcase */}
      <section ref={kitRef} className="kit-section">
        <div className={'kit-content reveal reveal-left' + (kitIn ? ' revealed' : '')}>
          <p className="kit-eyebrow">THE KIT</p>
          <h2 className="section-h-serif">Everything you need<br />to get started.</h2>
          <p className="kit-body">
            Curated bundles of our best matcha paired with the tools to brew it right.
            No guesswork. Just great matcha.
          </p>
          <button className="btn-black-outline" onClick={goKit}>SHOP KIT</button>
        </div>
        <div className={'kit-visual reveal reveal-right' + (kitIn ? ' revealed' : '')}>
          <div className="kit-card-stack">
            {kitVisualItems.map(function(item) {
              return (
                <div key={item.id} className={'kit-card ' + item.className}>
                  <img className="kit-card-image" src={item.image} alt={item.name} />
                  <div className="kit-card-overlay" />
                  <span className="kit-card-label">{item.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section ref={reviewsRef} className="reviews-section">
        <div className={'reviews-header reveal' + (reviewsIn ? ' revealed' : '')}>
          <h2 className="section-h-serif">What rebels say.</h2>
          <p className="section-h-cursive">The community speaks</p>
        </div>
        <div className={'review-composer reveal' + (reviewsIn ? ' revealed' : '')}>
          <div className="review-composer-copy">
            <p className="review-composer-eyebrow">Verified reviews only</p>
            <h3 className="review-composer-title">Real cups. Real customers.</h3>
            <p className="review-composer-body">{reviewViewer.message}</p>
            {reviewViewer.eligibleOrderLabel ? (
              <p className="review-composer-meta">Eligible order: {reviewViewer.eligibleOrderLabel}</p>
            ) : reviewViewer.reviewedOrderCount ? (
              <p className="review-composer-meta">
                {reviewViewer.reviewedOrderCount} verified review{reviewViewer.reviewedOrderCount > 1 ? 's' : ''} already shared from this account.
              </p>
            ) : null}
          </div>

          {authUser && reviewViewer.canSubmit ? (
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <div className="review-form-stars" aria-label="Choose a star rating">
                {[1, 2, 3, 4, 5].map(function(starValue) {
                  var active = starValue <= reviewRating

                  return (
                    <button
                      key={starValue}
                      type="button"
                      className={'review-star-button' + (active ? ' active' : '')}
                      onClick={function() { setReviewRating(starValue) }}
                      aria-label={'Rate ' + starValue + ' stars'}
                    >
                      &#9733;
                    </button>
                  )
                })}
              </div>

              <textarea
                className="review-textarea"
                placeholder="Tell other matcha lovers what stood out in your order."
                value={reviewText}
                onChange={function(event) { setReviewText(event.target.value) }}
                maxLength={420}
              />

              <div className="review-form-footer">
                <p className="review-form-note">Only paid customer orders can publish a review here.</p>
                <button type="submit" className="btn-lime review-submit-button" disabled={reviewSubmitting}>
                  {reviewSubmitting ? 'POSTING...' : 'POST VERIFIED REVIEW'}
                </button>
              </div>

              {reviewFeedback ? (
                <p className={'review-form-feedback ' + reviewFeedbackTone}>{reviewFeedback}</p>
              ) : null}
            </form>
          ) : (
            <div className="review-composer-side">
              {!authUser ? (
                <button type="button" className="btn-black-outline review-login-button" onClick={goLogin}>
                  SIGN IN TO REVIEW
                </button>
              ) : null}
              <p className="review-composer-side-note">
                Reviews on this section come only from accounts with real paid orders in the system.
              </p>
            </div>
          )}
        </div>

        {reviewsError ? <p className="reviews-feedback error">{reviewsError}</p> : null}

        {reviewsLoading ? (
          <div className="reviews-empty-state">
            <p className="reviews-empty-title">Loading verified reviews...</p>
          </div>
        ) : homeReviews.length ? (
          <div className="reviews-grid">
            {homeReviews.map(function (r, i) {
              var reviewDate = formatReviewDate(r.createdAt)

              return (
                <div
                  key={r.id || i}
                  className={'review-card reveal' + (reviewsIn ? ' revealed' : '')}
                  style={{ transitionDelay: reviewsIn ? (i * 120) + 'ms' : '0ms' }}
                >
                  <div className="review-stars" aria-label={String(r.rating || 5) + ' out of 5 stars'}>
                    {formatReviewStars(r.rating || 5)}
                  </div>
                  <p className="review-text">&#8220;{r.text}&#8221;</p>
                  <p className="review-author">{r.author} <span className="review-location">&#8212; {r.location}</span></p>
                  <p className="review-card-meta">
                    Verified customer{reviewDate ? ' • ' + reviewDate : ''}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="reviews-empty-state">
            <p className="reviews-empty-title">No verified reviews yet.</p>
            <p className="reviews-empty-copy">
              This section will fill itself with real customer reviews once paid orders start sharing feedback.
            </p>
          </div>
        )}
      </section>

      {/* Newsletter */}
      <section ref={newsRef} className="newsletter">
        <div className={'newsletter-inner reveal' + (newsIn ? ' revealed' : '')}>
          <h2 className="newsletter-heading">Join the rebellion.</h2>
          <p className="newsletter-sub">New drops, matcha guides, and behind-the-scenes from Japan.</p>
          <form className="newsletter-form" onSubmit={function (e) { e.preventDefault() }}>
            <input type="email" placeholder="your@email.com" />
            <button type="submit" className="btn-lime">SUBSCRIBE</button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="footer-logo">GLOWMORE</span>
            <p className="footer-tagline">Matcha. Made with uncommon care.</p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h4>Shop</h4>
              <a href="#" onClick={goShop}>Shop Matcha</a>
              <a href="#" onClick={goKit}>Shop Kit</a>
              <a href="#" onClick={goTools}>Shop Tools</a>
            </div>
            <div className="footer-col">
              <h4>Explore</h4>
              <a href="#">To The Source</a>
              <a href="#">Matchacation</a>
            </div>
            <div className="footer-col">
              <h4>Info</h4>
              <a href="#">About Us</a>
              <a href="#">Shipping</a>
              <a href="#">Returns</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&#169; 2025 Glowmore. All rights reserved.</p>
          <div className="footer-socials">
            <a href="#">Instagram</a>
            <a href="#">TikTok</a>
            <a href="#">X</a>
          </div>
        </div>
      </footer>

      {sourceModalOpen ? (
        <div className="source-modal-backdrop" onClick={function() { setSourceModalOpen(false) }}>
          <div
            className="source-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="source-modal-title"
            onClick={function(event) { event.stopPropagation() }}
          >
            <button
              className="source-modal-close"
              type="button"
              aria-label="Close source details"
              onClick={function() { setSourceModalOpen(false) }}
            >
              &#215;
            </button>

            <div className="source-modal-copy">
              <p className="source-modal-eyebrow">MATCHA ORIGINS</p>
              <h3 className="source-modal-title" id="source-modal-title">From misty hillsides to your cup.</h3>
              <p className="source-modal-body">
                Each region shapes the bowl differently. Uji brings ceremonial depth, Yame adds floral sweetness,
                and Kagoshima layers in a bright, volcanic lift. Together they tell the story behind every whisk.
              </p>

              <div className="source-origin-list">
                {sourceRegions.map(function(region) {
                  return (
                    <article key={region.id} className="source-origin-item">
                      <p className="source-origin-index">{region.id}</p>
                      <div className="source-origin-content">
                        <h4 className="source-origin-name">{region.name}</h4>
                        <p className="source-origin-profile">{region.profile}</p>
                        <p className="source-origin-detail">{region.detail}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>

            <div className="source-modal-visual">
              <div className="source-map-card">
                <div className="source-map-head">
                  <p className="source-map-kicker">Japan origin map</p>
                  <p className="source-map-caption">Direct-trade farms across the south and west of Japan.</p>
                </div>
                <SourceMapGraphic />
                <div className="source-map-footer">
                  <span>Shade grown</span>
                  <span>First harvest</span>
                  <span>Stone milled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
