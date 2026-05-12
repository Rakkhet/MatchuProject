import { useState } from 'react'

export default function ProductCard(props) {
  var product = props.product
  var delay = props.delay || 0
  var animate = props.animate
  var onAddToCart = props.onAddToCart

  var hoverState = useState(false)
  var hovered = hoverState[0]
  var setHovered = hoverState[1]

  var badgeClass = product.badge === 'SOLD OUT'
    ? 'badge badge-soldout'
    : product.badge === 'TOOLS'
    ? 'badge badge-tools'
    : 'badge badge-new'

  function handleAddToCart(event) {
    event.preventDefault()
    event.stopPropagation()

    if (product.soldOut || typeof onAddToCart !== 'function') {
      return
    }

    onAddToCart(product)
  }

  return (
    <div
      className={'product-card reveal' + (animate ? ' revealed' : '')}
      style={{ transitionDelay: animate ? delay + 'ms' : '0ms' }}
      onMouseEnter={function() { setHovered(true) }}
      onMouseLeave={function() { setHovered(false) }}
    >
      <div className="card-image">
        {product.image ? (
          <img src={product.image} alt={product.name} className="card-product-image" />
        ) : (
          <div className="card-image-inner">
            <span className="card-product-icon">&#25277;&#33590;</span>
            <span className="card-product-label">MATCHA</span>
          </div>
        )}
        {product.badge && <span className={badgeClass}>{product.badge}</span>}
        {hovered && (
          <div className="card-hover-overlay">
            <span className="card-tooltip">{product.name}</span>
            {product.soldOut
              ? <button type="button" className="btn-add-cart btn-soldout" disabled>SOLD OUT</button>
              : <button type="button" className="btn-add-cart" onClick={handleAddToCart}>ADD TO CART</button>
            }
          </div>
        )}
      </div>
      <div className="card-info">
        {product.origin && <p className="card-origin">{product.origin}</p>}
        <h3 className="card-name">{product.name}</h3>
        <p className="card-price">{product.price}</p>
      </div>
    </div>
  )
}
