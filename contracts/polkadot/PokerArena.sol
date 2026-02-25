// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

/// @title Poker Arena — Unified poker + betting contract
/// @notice Global VPS dealer manages all tables. Anyone creates tables.
///         Bots join and play. Humans bet on bots. Platform earns 5%.
interface PokerArena {

    // ========================================================================
    // EVENTS
    // ========================================================================
    event TableCreated(uint32 indexed tableId);
    event AgentJoined(uint32 indexed tableId, uint8 seat);
    event BetPlaced(uint32 indexed tableId, uint8 agentSeat);
    event HandResolved(uint32 indexed tableId, uint32 handNumber, uint8 winningSeat);
    event SessionEnded(uint32 indexed tableId);
    event AgentKicked(uint32 indexed tableId, uint8 seat, address agent);

    // ========================================================================
    // TABLE MANAGEMENT
    // ========================================================================

    /// @notice Create a table. msg.value = prize pool (locked until session end).
    /// @param buyIn   Exact DOT each agent must send to join
    /// @param maxAgents 2–8
    /// @param sessionLength Number of hands in the session
    /// @param betDeadline  Unix timestamp — human bets rejected after this
    /// @return tableId
    function createTable(
        uint256 buyIn,
        uint8   maxAgents,
        uint32  sessionLength,
        uint64  betDeadline
    ) external payable returns (uint32 tableId);

    /// @notice Agent joins table. Must send exact buyIn as msg.value.
    /// @return seat Seat number assigned (0-indexed)
    function joinTable(uint32 tableId) external payable returns (uint8 seat);

    /// @notice Human places bet on an agent. msg.value = bet amount.
    ///         Only accepted while state=Open and before betDeadline.
    function placeBet(uint32 tableId, uint8 agentSeat) external payable;

    // ========================================================================
    // DEALER ACTIONS (global VPS only)
    // ========================================================================

    /// @notice Start a hand. Resets per-hand state. Closes betting on first deal.
    /// @param deckHash Commitment to the shuffled deck (revealed at showdown off-chain)
    function deal(uint32 tableId, bytes32 deckHash) external;

    /// @notice Submit a player action.
    ///         If caller = dealer → timeout fold → missed turns counter ticked.
    ///         3 missed turns → agent kicked, chips forfeit to prize pool.
    /// @param action 0=fold, 1=check, 2=call, 3=raise
    /// @param amount Chips to raise by (only for action=3)
    function action(uint32 tableId, uint8 action, uint256 amount) external;

    /// @notice Award pot to hand winner. Checks session-end condition.
    function resolveHand(uint32 tableId, uint8 winningSeat) external;

    /// @notice Dealer manually ends the session (or cancels if still Open).
    function endSession(uint32 tableId) external;

    // ========================================================================
    // PERMISSIONLESS SAFETY VALVE
    // ========================================================================

    /// @notice Cancel a table if dealer vanished. Strictly guarded:
    ///         (A) state=Open AND now > betDeadline AND no hands dealt, OR
    ///         (B) state=Playing AND now - lastAction > 3600 seconds.
    ///         Griefing impossible — active games update lastAction every tx.
    function cancel(uint32 tableId) external;

    // ========================================================================
    // PLATFORM ADMIN
    // ========================================================================

    /// @notice Update the global dealer address. Only platform (deployer) can call.
    function updateDealer(address newDealer) external;

    // ========================================================================
    // PAYOUTS
    // ========================================================================

    /// @notice Agent withdraws remaining chip count. No platform fee.
    ///         Valid only after session ends.
    function claimChips(uint32 tableId) external;

    /// @notice Chip leader(s) claim prize pool. 5% platform fee deducted once.
    ///         If tied, each tied agent gets equal share of 95%.
    function claimPrize(uint32 tableId) external;

    /// @notice Bettors who backed the chip leader claim winnings.
    ///         5% platform fee deducted once from total bet pool.
    ///         Payout proportional to bet size vs total bets on that agent.
    function claimBetWinnings(uint32 tableId) external;

    /// @notice Full refunds for state=Cancelled tables.
    ///         Creator gets prize pool. Agents get buy-in. Bettors get bet amount.
    function refund(uint32 tableId) external;

    // ========================================================================
    // VIEW FUNCTIONS
    // ========================================================================

    function getTableInfo(uint32 tableId) external view returns (
        address creator,
        uint256 prizePool,
        uint256 buyIn,
        uint8   maxAgents,
        uint8   agentCount,
        uint32  sessionLength,
        uint32  currentHand,
        uint64  betDeadline,
        uint8   state  // 0=Open, 1=Playing, 2=Ended, 3=Cancelled
    );

    function getAgentInfo(uint32 tableId, uint8 seat) external view returns (
        address agent,
        uint256 chips,
        bool    folded,
        bool    kicked,
        uint8   missedTurns
    );

    function getBetInfo(uint32 tableId, address bettor) external view returns (
        uint8   agentSeat,
        uint256 amount,
        bool    claimed
    );

    function getAgentBetTotal(uint32 tableId, uint8 seat) external view returns (uint256);
    function getTotalBetPool(uint32 tableId)              external view returns (uint256);
    function getCurrentPot(uint32 tableId)                external view returns (uint256);
}
