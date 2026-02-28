;; Auction v3 - Simplified (no escrow)
;; Simple auction without STX escrow

(define-constant err-not-found (err u101))
(define-constant err-ended (err u102))
(define-constant err-low-bid (err u103))

(define-data-var auction-count uint u0)

(define-map auctions
  { auction-id: uint }
  { creator: principal, title: (string-ascii 64), min-bid: uint, highest-bid: uint, highest-bidder: (optional principal), end-block: uint }
)

(define-read-only (get-auction (auction-id uint))
  (map-get? auctions { auction-id: auction-id })
)

(define-read-only (get-auction-count)
  (var-get auction-count)
)

(define-public (create-auction (title (string-ascii 64)) (min-bid uint) (duration uint))
  (let ((auction-id (var-get auction-count)))
    (map-set auctions
      { auction-id: auction-id }
      { creator: tx-sender, title: title, min-bid: min-bid, highest-bid: u0, highest-bidder: none, end-block: (+ block-height duration) }
    )
    (var-set auction-count (+ auction-id u1))
    (ok auction-id)
  )
)

(define-public (place-bid (auction-id uint) (amount uint))
  (let ((auction (unwrap! (get-auction auction-id) err-not-found)))
    (asserts! (< block-height (get end-block auction)) err-ended)
    (asserts! (> amount (get highest-bid auction)) err-low-bid)
    (asserts! (>= amount (get min-bid auction)) err-low-bid)
    (map-set auctions { auction-id: auction-id }
      (merge auction { highest-bid: amount, highest-bidder: (some tx-sender) })
    )
    (ok amount)
  )
)
