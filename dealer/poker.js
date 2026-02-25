/**
 * Poker Arena — Off-chain hand evaluator
 * Standard 7-card best-5-hand evaluation (Texas Hold'em)
 * Pure JS, no dependencies.
 */

const RANKS = "23456789TJQKA";
const SUITS = "CDHS";

function rankIndex(r) { return RANKS.indexOf(r); }
function suitIndex(s) { return SUITS.indexOf(s); }

/**
 * Parse a card string like "Ah", "Td", "2c" into { rank, suit, rankIdx }
 */
function parseCard(str) {
    const rank = str[0].toUpperCase();
    const suit = str[1].toUpperCase();
    return { rank, suit, rankIdx: rankIndex(rank), suitIdx: suitIndex(suit) };
}

/**
 * Generate all 21 combinations of 5 cards from 7
 */
function combinations5from7(cards) {
    const result = [];
    for (let i = 0; i < cards.length - 4; i++)
        for (let j = i + 1; j < cards.length - 3; j++)
            for (let k = j + 1; k < cards.length - 2; k++)
                for (let l = k + 1; l < cards.length - 1; l++)
                    for (let m = l + 1; m < cards.length; m++)
                        result.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
    return result;
}

/**
 * Evaluate a 5-card hand. Returns a numeric score — higher is better.
 * Category (in millions) + tiebreakers.
 *
 * Categories (cat * 1_000_000):
 *  8 = Straight Flush
 *  7 = Four of a Kind
 *  6 = Full House
 *  5 = Flush
 *  4 = Straight
 *  3 = Three of a Kind
 *  2 = Two Pair
 *  1 = One Pair
 *  0 = High Card
 */
function evaluate5(hand) {
    const sorted = [...hand].sort((a, b) => b.rankIdx - a.rankIdx);
    const ranks = sorted.map(c => c.rankIdx);
    const suits = sorted.map(c => c.suitIdx);

    const isFlush = suits.every(s => s === suits[0]);
    let isStraight = ranks.every((r, i) => i === 0 || ranks[i - 1] - r === 1);
    // Wheel: A-2-3-4-5
    if (!isStraight && ranks[0] === 12 && ranks[1] === 3 && ranks[2] === 2 && ranks[3] === 1 && ranks[4] === 0) {
        isStraight = true;
        ranks.push(ranks.shift()); // move Ace to bottom, treat as 1
    }

    // Count rank occurrences
    const freq = {};
    for (const r of ranks) freq[r] = (freq[r] || 0) + 1;
    const counts = Object.values(freq).sort((a, b) => b - a);
    const byFreq = Object.entries(freq)
        .sort((a, b) => b[1] - a[1] || b[0] - a[0])
        .map(e => Number(e[0]));

    function tb(...vals) {
        return vals.reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);
    }

    if (isFlush && isStraight) return 8_000_000 + tb(...ranks);
    if (counts[0] === 4) return 7_000_000 + tb(...byFreq);
    if (counts[0] === 3 && counts[1] === 2) return 6_000_000 + tb(...byFreq);
    if (isFlush) return 5_000_000 + tb(...ranks);
    if (isStraight) return 4_000_000 + tb(...ranks);
    if (counts[0] === 3) return 3_000_000 + tb(...byFreq);
    if (counts[0] === 2 && counts[1] === 2) return 2_000_000 + tb(...byFreq);
    if (counts[0] === 2) return 1_000_000 + tb(...byFreq);
    return tb(...ranks);
}

/**
 * Find best 5-card score from up to 7 cards
 */
function bestHand(sevenCards) {
    const parsed = sevenCards.map(parseCard);
    const combos = parsed.length <= 5 ? [parsed] : combinations5from7(parsed);
    return Math.max(...combos.map(evaluate5));
}

/**
 * Given an array of agent hands (each being [holeCard1, holeCard2, ...communityCards]),
 * returns an array of winning seat indices (tie = multiple seats).
 */
function findWinners(agentHands) {
    const scores = agentHands.map(cards => cards ? bestHand(cards) : -1);
    const max = Math.max(...scores);
    return scores.reduce((acc, s, i) => { if (s === max) acc.push(i); return acc; }, []);
}

/**
 * Build a fresh shuffled deck of card strings ("Ah","2d",...52 cards)
 */
function makeDeck() {
    const deck = [];
    for (const r of RANKS) for (const s of SUITS) deck.push(r + S);
    // Fisher-Yates
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Fix typo in makeDeck — S should be s
function makeDeckFixed() {
    const deck = [];
    for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

module.exports = { makeDeck: makeDeckFixed, bestHand, findWinners, parseCard };
