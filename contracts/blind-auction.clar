;; Blind Auction Smart Contract for Stacks
;; Implements sealed-bid auction mechanism with commit-reveal scheme

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-auction-not-found (err u101))
(define-constant err-auction-ended (err u102))
(define-constant err-auction-not-ended (err u103))
(define-constant err-already-revealed (err u104))
(define-constant err-invalid-reveal (err u105))
(define-constant err-no-bid (err u106))
(define-constant err-not-winner (err u107))
(define-constant err-already-claimed (err u108))
(define-constant err-auction-active (err u109))
(define-constant err-insufficient-funds (err u110))

;; Data Variables
(define-data-var auction-nonce uint u0)

;; Data Maps
(define-map auctions
  { auction-id: uint }
  {
    creator: principal,
    item-name: (string-ascii 64),
    item-description: (string-utf8 256),
    min-bid: uint,
    commit-end-block: uint,
    reveal-end-block: uint,
    highest-bid: uint,
    highest-bidder: (optional principal),
    claimed: bool
  }
)

(define-map sealed-bids
  { auction-id: uint, bidder: principal }
  { commit-hash: (buff 32), revealed: bool, bid-amount: uint }
)

(define-map bid-deposits
  { auction-id: uint, bidder: principal }
  { amount: uint }
)

;; Read-only functions

(define-read-only (get-auction (auction-id uint))
  (map-get? auctions { auction-id: auction-id })
)

(define-read-only (get-sealed-bid (auction-id uint) (bidder principal))
  (map-get? sealed-bids { auction-id: auction-id, bidder: bidder })
)

(define-read-only (get-deposit (auction-id uint) (bidder principal))
  (default-to { amount: u0 } (map-get? bid-deposits { auction-id: auction-id, bidder: bidder }))
)

(define-read-only (get-auction-count)
  (var-get auction-nonce)
)

(define-read-only (is-commit-phase (auction-id uint))
  (match (get-auction auction-id)
    auction (< block-height (get commit-end-block auction))
    false
  )
)

(define-read-only (is-reveal-phase (auction-id uint))
  (match (get-auction auction-id)
    auction (and 
      (>= block-height (get commit-end-block auction))
      (< block-height (get reveal-end-block auction))
    )
    false
  )
)

(define-read-only (is-auction-ended (auction-id uint))
  (match (get-auction auction-id)
    auction (>= block-height (get reveal-end-block auction))
    false
  )
)

(define-read-only (hash-bid (bid-amount uint) (salt (buff 32)))
  (sha256 (concat (unwrap-panic (to-consensus-buff? bid-amount)) salt))
)

;; Public functions

;; Create a new auction
(define-public (create-auction 
  (item-name (string-ascii 64))
  (item-description (string-utf8 256))
  (min-bid uint)
  (commit-duration uint)
  (reveal-duration uint)
)
  (let
    (
      (auction-id (var-get auction-nonce))
      (commit-end (+ block-height commit-duration))
      (reveal-end (+ block-height commit-duration reveal-duration))
    )
    (map-set auctions
      { auction-id: auction-id }
      {
        creator: tx-sender,
        item-name: item-name,
        item-description: item-description,
        min-bid: min-bid,
        commit-end-block: commit-end,
        reveal-end-block: reveal-end,
        highest-bid: u0,
        highest-bidder: none,
        claimed: false
      }
    )
    (var-set auction-nonce (+ auction-id u1))
    (ok auction-id)
  )
)

;; Submit a sealed bid (commit phase)
(define-public (submit-sealed-bid (auction-id uint) (commit-hash (buff 32)) (deposit uint))
  (let
    (
      (auction (unwrap! (get-auction auction-id) err-auction-not-found))
    )
    ;; Check we're in commit phase
    (asserts! (< block-height (get commit-end-block auction)) err-auction-ended)
    ;; Check deposit meets minimum
    (asserts! (>= deposit (get min-bid auction)) err-insufficient-funds)
    ;; Transfer deposit
    (try! (stx-transfer? deposit tx-sender (as-contract tx-sender)))
    ;; Store sealed bid
    (map-set sealed-bids
      { auction-id: auction-id, bidder: tx-sender }
      { commit-hash: commit-hash, revealed: false, bid-amount: u0 }
    )
    ;; Store deposit
    (map-set bid-deposits
      { auction-id: auction-id, bidder: tx-sender }
      { amount: deposit }
    )
    (ok true)
  )
)

;; Reveal bid (reveal phase)
(define-public (reveal-bid (auction-id uint) (bid-amount uint) (salt (buff 32)))
  (let
    (
      (auction (unwrap! (get-auction auction-id) err-auction-not-found))
      (sealed-bid (unwrap! (get-sealed-bid auction-id tx-sender) err-no-bid))
      (deposit-info (get-deposit auction-id tx-sender))
      (computed-hash (hash-bid bid-amount salt))
    )
    ;; Check we're in reveal phase
    (asserts! (>= block-height (get commit-end-block auction)) err-auction-active)
    (asserts! (< block-height (get reveal-end-block auction)) err-auction-ended)
    ;; Check not already revealed
    (asserts! (not (get revealed sealed-bid)) err-already-revealed)
    ;; Verify hash matches
    (asserts! (is-eq computed-hash (get commit-hash sealed-bid)) err-invalid-reveal)
    ;; Check bid doesn't exceed deposit
    (asserts! (<= bid-amount (get amount deposit-info)) err-insufficient-funds)
    ;; Update sealed bid as revealed
    (map-set sealed-bids
      { auction-id: auction-id, bidder: tx-sender }
      { commit-hash: (get commit-hash sealed-bid), revealed: true, bid-amount: bid-amount }
    )
    ;; Update highest bid if this is higher
    (if (> bid-amount (get highest-bid auction))
      (map-set auctions
        { auction-id: auction-id }
        (merge auction { highest-bid: bid-amount, highest-bidder: (some tx-sender) })
      )
      true
    )
    (ok true)
  )
)

;; Claim prize (winner only, after auction ends)
(define-public (claim-prize (auction-id uint))
  (let
    (
      (auction (unwrap! (get-auction auction-id) err-auction-not-found))
      (winner (unwrap! (get highest-bidder auction) err-no-bid))
    )
    ;; Check auction ended
    (asserts! (>= block-height (get reveal-end-block auction)) err-auction-not-ended)
    ;; Check caller is winner
    (asserts! (is-eq tx-sender winner) err-not-winner)
    ;; Check not already claimed
    (asserts! (not (get claimed auction)) err-already-claimed)
    ;; Mark as claimed
    (map-set auctions
      { auction-id: auction-id }
      (merge auction { claimed: true })
    )
    ;; Transfer winning bid to creator
    (as-contract (stx-transfer? (get highest-bid auction) tx-sender (get creator auction)))
  )
)

;; Withdraw deposit (non-winners, after auction ends)
(define-public (withdraw-deposit (auction-id uint))
  (let
    (
      (auction (unwrap! (get-auction auction-id) err-auction-not-found))
      (deposit-info (get-deposit auction-id tx-sender))
      (sealed-bid (get-sealed-bid auction-id tx-sender))
      (is-winner (is-eq (get highest-bidder auction) (some tx-sender)))
      (bid-amount (match sealed-bid bid (get bid-amount bid) u0))
      (refund-amount (if is-winner
        (- (get amount deposit-info) bid-amount)
        (get amount deposit-info)
      ))
    )
    ;; Check auction ended
    (asserts! (>= block-height (get reveal-end-block auction)) err-auction-not-ended)
    ;; Check has deposit
    (asserts! (> (get amount deposit-info) u0) err-no-bid)
    ;; Clear deposit
    (map-set bid-deposits
      { auction-id: auction-id, bidder: tx-sender }
      { amount: u0 }
    )
    ;; Return deposit
    (as-contract (stx-transfer? refund-amount tx-sender tx-sender))
  )
)
