#![no_main]
#![no_std]
#![allow(dead_code)]

use pallet_revive_uapi::{HostFn, HostFnImpl as api, ReturnFlags, StorageFlags};

// ============================================================================
// POKER ARENA — Final Contract
// Global dealer (VPS), prize pool per table, 5% platform fee,
// kick-on-3-misses, permissionless cancel with inactivity guard.
// ============================================================================

// ---- Function Selectors (keccak256 of Solidity ABI signatures) -------------
const CREATE_TABLE_SEL: [u8; 4] = [0xd6, 0x62, 0xaa, 0x80];
const JOIN_TABLE_SEL: [u8; 4] = [0x31, 0x27, 0x25, 0x27];
const PLACE_BET_SEL: [u8; 4] = [0x93, 0x03, 0xfd, 0xed];
const DEAL_SEL: [u8; 4] = [0xc0, 0x87, 0xcb, 0xbb];
const ACTION_SEL: [u8; 4] = [0x00, 0x42, 0x21, 0x67];
const RESOLVE_HAND_SEL: [u8; 4] = [0x7c, 0x30, 0x80, 0xfa];
const END_SESSION_SEL: [u8; 4] = [0xb7, 0xfb, 0x6a, 0x83];
const CANCEL_SEL: [u8; 4] = [0x13, 0x81, 0xe4, 0x00];
const UPDATE_DEALER_SEL: [u8; 4] = [0xc7, 0xad, 0x85, 0x73];
const CLAIM_CHIPS_SEL: [u8; 4] = [0x23, 0xcf, 0xe3, 0x47];
const CLAIM_PRIZE_SEL: [u8; 4] = [0x0d, 0x1b, 0x06, 0x5c];
const CLAIM_BET_WINNINGS_SEL: [u8; 4] = [0x20, 0x93, 0xdd, 0x89];
const REFUND_SEL: [u8; 4] = [0x1c, 0x48, 0xc0, 0x74];
const GET_TABLE_INFO_SEL: [u8; 4] = [0xf1, 0x08, 0xb7, 0xe8];
const GET_AGENT_INFO_SEL: [u8; 4] = [0x81, 0xd6, 0xb2, 0xbb];
const GET_BET_INFO_SEL: [u8; 4] = [0x36, 0xff, 0x33, 0x2a];
const GET_AGENT_BET_TOTAL_SEL: [u8; 4] = [0x6b, 0x4c, 0xd3, 0x5b];
const GET_TOTAL_BET_POOL_SEL: [u8; 4] = [0xbc, 0x32, 0x1b, 0x77];
const GET_CURRENT_POT_SEL: [u8; 4] = [0xa5, 0x45, 0x39, 0xb0];

// ---- Event Topics -----------------------------------------------------------
const TABLE_CREATED_TOPIC: [u8; 32] = [0x3e,0xb7,0x00,0xd7,0x44,0x54,0xd1,0x6e,0xe2,0xb9,0xcc,0x59,0x25,0xec,0xa3,0xba,0x71,0x25,0x53,0xc5,0x63,0x6d,0x65,0x99,0xea,0x95,0x07,0xea,0xfe,0xa9,0x19,0xbb];
const AGENT_JOINED_TOPIC: [u8; 32] = [0x53,0x91,0xae,0x3a,0x83,0x4c,0xdb,0x97,0xbf,0x2b,0x74,0x25,0xf3,0xc9,0x24,0x33,0x74,0x79,0x90,0x70,0x9b,0x12,0xfb,0x74,0x5c,0x43,0x98,0xfb,0x01,0x64,0xea,0xcf];
const BET_PLACED_TOPIC: [u8; 32] = [0xde,0x07,0xa5,0x2b,0xf7,0x80,0xdc,0x7b,0x08,0xfb,0x14,0xb0,0xcc,0x20,0x5c,0x36,0x2a,0x9a,0x62,0xd7,0xf1,0xaf,0x2d,0x88,0x43,0xe5,0xb7,0x8f,0x08,0xcf,0x1b,0x03];
const HAND_RESOLVED_TOPIC: [u8; 32] = [0x20,0x71,0x64,0x66,0x0a,0x45,0x14,0xbb,0xae,0xe1,0xee,0x0a,0x64,0xeb,0xe2,0xd3,0x54,0xf5,0xb8,0xff,0x09,0x7d,0xf4,0x33,0xd4,0x5a,0x20,0x0b,0xdf,0x7d,0xc6,0xd1];
const SESSION_ENDED_TOPIC: [u8; 32] = [0xd0,0x50,0xd1,0x0b,0x93,0x3c,0x19,0x15,0xcc,0x8e,0x44,0xa5,0x6b,0x9b,0x10,0xc1,0xfc,0x02,0x42,0xb0,0x3d,0x06,0x69,0x6c,0x69,0xcb,0x78,0x0b,0x76,0xa5,0x77,0xef];
const AGENT_KICKED_TOPIC: [u8; 32] = [0xa4,0x54,0xdc,0xb3,0xcf,0x56,0x2a,0xd4,0xac,0x2b,0xe9,0x9f,0xcc,0xd0,0x85,0x9c,0x8e,0xae,0x16,0xa6,0x8e,0x13,0x0e,0x55,0x79,0x30,0x4f,0x5d,0x58,0xa8,0x55,0x2b];

// ---- Constants --------------------------------------------------------------
const STATE_OPEN: u8 = 0;
const STATE_PLAYING: u8 = 1;
const STATE_ENDED: u8 = 2;
const STATE_CANCELLED: u8 = 3;

const ACT_FOLD: u8 = 0;
const ACT_CHECK: u8 = 1;
const ACT_CALL: u8 = 2;
const ACT_RAISE: u8 = 3;

const MAX_AGENTS: u8 = 8;
const MAX_BETTORS: u8 = 64;
const PLATFORM_FEE_BPS: u128 = 500;   // 5%
const INACTIVITY_SECS: u64 = 3600;    // 1 hour
const MISSED_TURNS_KICK: u8 = 3;

// ============================================================================
// STORAGE KEY LAYOUT
//
// Global:
//   [0x01, 0..] -> table_count (u32)
//   [0x02, 0..] -> platform_address ([u8;20])
//   [0x03, 0..] -> dealer_address ([u8;20])
//
// Per-table (prefix 0x10 + tableId[4]):
//   field byte selects the value
//
// Per-agent (prefix 0x20 + tableId[4] + seat):
//   field byte selects the value
//
// Per-bettor (prefix 0x30 + tableId[4] + bettor_idx):
//   field byte selects the value
//
// Per-agent bet total (prefix 0x40 + tableId[4] + seat):
//   single value -> u128
// ============================================================================

fn key_table_count() -> [u8; 32] { let mut k = [0u8;32]; k[0]=0x01; k }
fn key_platform()    -> [u8; 32] { let mut k = [0u8;32]; k[0]=0x02; k }
fn key_dealer()      -> [u8; 32] { let mut k = [0u8;32]; k[0]=0x03; k }

fn key_table(tid: u32, f: u8) -> [u8; 32] {
    let mut k = [0u8;32]; k[0]=0x10;
    k[1..5].copy_from_slice(&tid.to_be_bytes()); k[5]=f; k
}
fn key_agent(tid: u32, seat: u8, f: u8) -> [u8; 32] {
    let mut k = [0u8;32]; k[0]=0x20;
    k[1..5].copy_from_slice(&tid.to_be_bytes()); k[5]=seat; k[6]=f; k
}
fn key_bet(tid: u32, idx: u8, f: u8) -> [u8; 32] {
    let mut k = [0u8;32]; k[0]=0x30;
    k[1..5].copy_from_slice(&tid.to_be_bytes()); k[5]=idx; k[6]=f; k
}
fn key_agent_bet_total(tid: u32, seat: u8) -> [u8; 32] {
    let mut k = [0u8;32]; k[0]=0x40;
    k[1..5].copy_from_slice(&tid.to_be_bytes()); k[5]=seat; k
}

// ---- Table fields -----------------------------------------------------------
const TF_CREATOR: u8 = 0;
const TF_PRIZE_POOL: u8 = 1;
const TF_BUY_IN: u8 = 2;
const TF_MAX_AGENTS: u8 = 3;
const TF_AGENT_COUNT: u8 = 4;
const TF_SESSION_LEN: u8 = 5;
const TF_CURRENT_HAND: u8 = 6;
const TF_BET_DEADLINE: u8 = 7;
const TF_STATE: u8 = 8;
const TF_POT: u8 = 9;
const TF_CURRENT_TURN: u8 = 10;
const TF_CURRENT_BET: u8 = 11;
const TF_ACTIVE_COUNT: u8 = 12;
const TF_TOTAL_BET_POOL: u8 = 13;
const TF_BETTOR_COUNT: u8 = 14;
const TF_LAST_ACTION: u8 = 15;   // u64 timestamp
const TF_PRIZE_FEE_PAID: u8 = 16; // bool — platform fee sent for prize pool
const TF_BET_FEE_PAID: u8 = 17;   // bool — platform fee sent for bet pool

// ---- Agent fields -----------------------------------------------------------
const AF_ADDR: u8 = 0;
const AF_CHIPS: u8 = 1;
const AF_FOLDED: u8 = 2;
const AF_KICKED: u8 = 3;
const AF_MISSED: u8 = 4;
const AF_HAND_BET: u8 = 5;  // chips committed to current hand's pot
const AF_CHIPS_CLAIMED: u8 = 6;
const AF_PRIZE_CLAIMED: u8 = 7;

// ---- Bet fields -------------------------------------------------------------
const BF_ADDR: u8 = 0;
const BF_SEAT: u8 = 1;
const BF_AMOUNT: u8 = 2;
const BF_CLAIMED: u8 = 3;

// ============================================================================
// STORAGE HELPERS
// ============================================================================

fn store_u128(k: &[u8;32], v: u128) {
    let mut buf = [0u8;32]; buf[16..].copy_from_slice(&v.to_be_bytes());
    api::set_storage_or_clear(StorageFlags::empty(), k, &buf);
}
fn load_u128(k: &[u8;32]) -> u128 {
    let mut buf = [0u8;32];
    api::get_storage_or_zero(StorageFlags::empty(), k, &mut buf);
    u128::from_be_bytes(buf[16..].try_into().unwrap())
}
fn store_u64(k: &[u8;32], v: u64) {
    let mut buf = [0u8;32]; buf[24..].copy_from_slice(&v.to_be_bytes());
    api::set_storage_or_clear(StorageFlags::empty(), k, &buf);
}
fn load_u64(k: &[u8;32]) -> u64 {
    let mut buf = [0u8;32];
    api::get_storage_or_zero(StorageFlags::empty(), k, &mut buf);
    u64::from_be_bytes(buf[24..].try_into().unwrap())
}
fn store_u32(k: &[u8;32], v: u32) {
    let mut buf = [0u8;32]; buf[28..].copy_from_slice(&v.to_be_bytes());
    api::set_storage_or_clear(StorageFlags::empty(), k, &buf);
}
fn load_u32(k: &[u8;32]) -> u32 {
    let mut buf = [0u8;32];
    api::get_storage_or_zero(StorageFlags::empty(), k, &mut buf);
    u32::from_be_bytes(buf[28..].try_into().unwrap())
}
fn store_u8(k: &[u8;32], v: u8) {
    let mut buf = [0u8;32]; buf[31] = v;
    api::set_storage_or_clear(StorageFlags::empty(), k, &buf);
}
fn load_u8(k: &[u8;32]) -> u8 {
    let mut buf = [0u8;32];
    api::get_storage_or_zero(StorageFlags::empty(), k, &mut buf);
    buf[31]
}
fn store_addr(k: &[u8;32], a: &[u8;20]) {
    let mut buf = [0u8;32]; buf[12..].copy_from_slice(a);
    api::set_storage_or_clear(StorageFlags::empty(), k, &buf);
}
fn load_addr(k: &[u8;32]) -> [u8;20] {
    let mut buf = [0u8;32];
    api::get_storage_or_zero(StorageFlags::empty(), k, &mut buf);
    let mut a = [0u8;20]; a.copy_from_slice(&buf[12..]); a
}

// ============================================================================
// CALL HELPERS
// ============================================================================

fn get_caller() -> [u8;20] { let mut c=[0u8;20]; api::caller(&mut c); c }

fn get_value() -> u128 {
    let mut v=[0u8;32]; api::value_transferred(&mut v);
    u128::from_be_bytes(v[16..].try_into().unwrap())
}

fn get_now() -> u64 {
    let mut v=[0u8;32]; api::now(&mut v);
    u64::from_be_bytes(v[24..].try_into().unwrap())
}

fn addr_eq(a: &[u8;20], b: &[u8;20]) -> bool { *a == *b }

fn revert() -> ! { api::return_value(ReturnFlags::REVERT, &[]); }

fn return_empty() -> ! { api::return_value(ReturnFlags::empty(), &[]); }

fn return_u8(v: u8) -> ! {
    let mut r=[0u8;32]; r[31]=v;
    api::return_value(ReturnFlags::empty(), &r);
}

fn return_u32(v: u32) -> ! {
    let mut r=[0u8;32]; r[28..].copy_from_slice(&v.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &r);
}

fn read_word(offset: u32) -> [u8;32] {
    let mut w=[0u8;32]; api::call_data_load(&mut w, offset); w
}
fn read_u256_as_u128(offset: u32) -> u128 {
    let w=read_word(offset); u128::from_be_bytes(w[16..].try_into().unwrap())
}
fn read_u32_param(offset: u32) -> u32 {
    let w=read_word(offset); u32::from_be_bytes(w[28..].try_into().unwrap())
}
fn read_u8_param(offset: u32) -> u8 { read_word(offset)[31] }
fn read_u64_param(offset: u32) -> u64 {
    let w=read_word(offset); u64::from_be_bytes(w[24..].try_into().unwrap())
}
fn read_addr_param(offset: u32) -> [u8;20] {
    let w=read_word(offset); let mut a=[0u8;20]; a.copy_from_slice(&w[12..]); a
}

fn transfer_to(addr: &[u8;20], amount: u128) {
    if amount == 0 { return; }
    let mut value=[0u8;32]; value[16..].copy_from_slice(&amount.to_be_bytes());
    let deposit=[0u8;32];
    let _ = api::call(
        pallet_revive_uapi::CallFlags::empty(),
        addr, 0, 0, &deposit, &value, &[], None,
    );
}

fn emit(topic: &[u8;32], data: &[u8]) {
    api::deposit_event(&[*topic], data);
}

/// Refresh the inactivity timer (called on every dealer action)
fn touch_last_action(tid: u32) {
    store_u64(&key_table(tid, TF_LAST_ACTION), get_now());
}

// ============================================================================
// PANIC HANDLER
// ============================================================================
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp"); core::hint::unreachable_unchecked(); }
}

// ============================================================================
// ENTRY POINTS
// ============================================================================

#[polkavm_derive::polkavm_export]
pub extern "C" fn deploy() {
    let caller = get_caller();
    store_addr(&key_platform(), &caller);
    store_addr(&key_dealer(), &caller);   // platform = first dealer
    store_u32(&key_table_count(), 0);
}

#[polkavm_derive::polkavm_export]
pub extern "C" fn call() {
    if api::call_data_size() < 4 { revert(); }
    let mut sel=[0u8;4]; api::call_data_copy(&mut sel, 0);
    match sel {
        CREATE_TABLE_SEL        => handle_create_table(),
        JOIN_TABLE_SEL          => handle_join_table(),
        PLACE_BET_SEL           => handle_place_bet(),
        DEAL_SEL                => handle_deal(),
        ACTION_SEL              => handle_action(),
        RESOLVE_HAND_SEL        => handle_resolve_hand(),
        END_SESSION_SEL         => handle_end_session(),
        CANCEL_SEL              => handle_cancel(),
        UPDATE_DEALER_SEL       => handle_update_dealer(),
        CLAIM_CHIPS_SEL         => handle_claim_chips(),
        CLAIM_PRIZE_SEL         => handle_claim_prize(),
        CLAIM_BET_WINNINGS_SEL  => handle_claim_bet_winnings(),
        REFUND_SEL              => handle_refund(),
        GET_TABLE_INFO_SEL      => handle_get_table_info(),
        GET_AGENT_INFO_SEL      => handle_get_agent_info(),
        GET_BET_INFO_SEL        => handle_get_bet_info(),
        GET_AGENT_BET_TOTAL_SEL => handle_get_agent_bet_total(),
        GET_TOTAL_BET_POOL_SEL  => handle_get_total_bet_pool(),
        GET_CURRENT_POT_SEL     => handle_get_current_pot(),
        _                       => revert(),
    }
}

// ============================================================================
// TABLE MANAGEMENT
// ============================================================================

fn handle_create_table() -> ! {
    let buy_in       = read_u256_as_u128(4);
    let max_agents   = read_u8_param(36);
    let session_len  = read_u32_param(68);
    let bet_deadline = read_u64_param(100);

    if buy_in == 0                    { revert(); }
    if max_agents < 2 || max_agents > MAX_AGENTS { revert(); }
    if session_len == 0               { revert(); }
    if bet_deadline <= get_now()      { revert(); }

    // msg.value IS the prize pool
    let prize_pool = get_value();
    if prize_pool == 0                { revert(); }

    let caller = get_caller();
    let tc_key = key_table_count();
    let tid = load_u32(&tc_key);
    store_u32(&tc_key, tid + 1);

    store_addr(&key_table(tid, TF_CREATOR),       &caller);
    store_u128(&key_table(tid, TF_PRIZE_POOL),    prize_pool);
    store_u128(&key_table(tid, TF_BUY_IN),        buy_in);
    store_u8  (&key_table(tid, TF_MAX_AGENTS),    max_agents);
    store_u8  (&key_table(tid, TF_AGENT_COUNT),   0);
    store_u32 (&key_table(tid, TF_SESSION_LEN),   session_len);
    store_u32 (&key_table(tid, TF_CURRENT_HAND),  0);
    store_u64 (&key_table(tid, TF_BET_DEADLINE),  bet_deadline);
    store_u8  (&key_table(tid, TF_STATE),         STATE_OPEN);
    store_u128(&key_table(tid, TF_POT),           0);
    store_u128(&key_table(tid, TF_TOTAL_BET_POOL),0);
    store_u8  (&key_table(tid, TF_BETTOR_COUNT),  0);
    store_u64 (&key_table(tid, TF_LAST_ACTION),   get_now());
    store_u8  (&key_table(tid, TF_PRIZE_FEE_PAID),0);
    store_u8  (&key_table(tid, TF_BET_FEE_PAID),  0);

    emit(&TABLE_CREATED_TOPIC, &tid.to_be_bytes());
    return_u32(tid);
}

fn handle_join_table() -> ! {
    let tid = read_u32_param(4);
    if load_u8(&key_table(tid, TF_STATE)) != STATE_OPEN { revert(); }

    let buy_in = load_u128(&key_table(tid, TF_BUY_IN));
    if get_value() != buy_in { revert(); }

    let agent_count = load_u8(&key_table(tid, TF_AGENT_COUNT));
    let max = load_u8(&key_table(tid, TF_MAX_AGENTS));
    if agent_count >= max { revert(); }

    let caller = get_caller();
    // Prevent duplicate join
    let mut i: u8 = 0;
    while i < agent_count {
        if addr_eq(&load_addr(&key_agent(tid, i, AF_ADDR)), &caller) { revert(); }
        i += 1;
    }

    let seat = agent_count;
    store_addr(&key_agent(tid, seat, AF_ADDR),         &caller);
    store_u128(&key_agent(tid, seat, AF_CHIPS),        buy_in);
    store_u8  (&key_agent(tid, seat, AF_FOLDED),       0);
    store_u8  (&key_agent(tid, seat, AF_KICKED),       0);
    store_u8  (&key_agent(tid, seat, AF_MISSED),       0);
    store_u128(&key_agent(tid, seat, AF_HAND_BET),     0);
    store_u8  (&key_agent(tid, seat, AF_CHIPS_CLAIMED),0);
    store_u8  (&key_agent(tid, seat, AF_PRIZE_CLAIMED),0);
    store_u8  (&key_table(tid, TF_AGENT_COUNT), seat + 1);

    emit(&AGENT_JOINED_TOPIC, &[seat]);
    return_u8(seat);
}

fn handle_place_bet() -> ! {
    let tid = read_u32_param(4);
    let seat = read_u8_param(36);

    if load_u8(&key_table(tid, TF_STATE)) != STATE_OPEN   { revert(); }
    if get_now() >= load_u64(&key_table(tid, TF_BET_DEADLINE)) { revert(); }
    if seat >= load_u8(&key_table(tid, TF_AGENT_COUNT))   { revert(); }
    // Can't bet on a kicked agent
    if load_u8(&key_agent(tid, seat, AF_KICKED)) != 0     { revert(); }

    let amount = get_value();
    if amount == 0 { revert(); }

    let count = load_u8(&key_table(tid, TF_BETTOR_COUNT));
    if count >= MAX_BETTORS { revert(); }

    let caller = get_caller();
    store_addr(&key_bet(tid, count, BF_ADDR),   &caller);
    store_u8  (&key_bet(tid, count, BF_SEAT),   seat);
    store_u128(&key_bet(tid, count, BF_AMOUNT), amount);
    store_u8  (&key_bet(tid, count, BF_CLAIMED),0);
    store_u8  (&key_table(tid, TF_BETTOR_COUNT), count + 1);

    let abt = key_agent_bet_total(tid, seat);
    store_u128(&abt, load_u128(&abt) + amount);

    let tbp = key_table(tid, TF_TOTAL_BET_POOL);
    store_u128(&tbp, load_u128(&tbp) + amount);

    emit(&BET_PLACED_TOPIC, &[seat]);
    return_empty();
}

// ============================================================================
// DEALER ACTIONS
// ============================================================================

fn require_dealer(caller: &[u8;20]) {
    if !addr_eq(caller, &load_addr(&key_dealer())) { revert(); }
}

fn handle_deal() -> ! {
    let tid = read_u32_param(4);
    let caller = get_caller();
    require_dealer(&caller);

    let state = load_u8(&key_table(tid, TF_STATE));
    let agent_count = load_u8(&key_table(tid, TF_AGENT_COUNT));
    if agent_count < 2 { revert(); }

    if state == STATE_OPEN {
        store_u8(&key_table(tid, TF_STATE), STATE_PLAYING);
    } else if state != STATE_PLAYING {
        revert();
    }

    let hand = load_u32(&key_table(tid, TF_CURRENT_HAND));
    store_u32(&key_table(tid, TF_CURRENT_HAND), hand + 1);

    // Reset per-hand state for all non-kicked agents
    let mut active: u8 = 0;
    let mut first: u8 = 0;
    let mut found = false;
    let mut i: u8 = 0;
    while i < agent_count {
        if load_u8(&key_agent(tid, i, AF_KICKED)) == 0 {
            store_u8  (&key_agent(tid, i, AF_FOLDED),   0);
            store_u128(&key_agent(tid, i, AF_HAND_BET), 0);
            active += 1;
            if !found { first = i; found = true; }
        }
        i += 1;
    }
    if active < 2 { revert(); }

    store_u128(&key_table(tid, TF_POT),          0);
    store_u8  (&key_table(tid, TF_CURRENT_TURN), first);
    store_u128(&key_table(tid, TF_CURRENT_BET),  0);
    store_u8  (&key_table(tid, TF_ACTIVE_COUNT), active);
    touch_last_action(tid);
    return_empty();
}

fn handle_action() -> ! {
    let tid    = read_u32_param(4);
    let action = read_u8_param(36);
    let amount = read_u256_as_u128(68);

    if load_u8(&key_table(tid, TF_STATE)) != STATE_PLAYING { revert(); }

    let caller = get_caller();
    let dealer = load_addr(&key_dealer());
    let turn   = load_u8(&key_table(tid, TF_CURRENT_TURN));
    let agent_addr = load_addr(&key_agent(tid, turn, AF_ADDR));

    // Must be the agent whose turn it is, OR the global dealer (timeout submission)
    let is_dealer = addr_eq(&caller, &dealer);
    let is_agent  = addr_eq(&caller, &agent_addr);
    if !is_dealer && !is_agent { revert(); }

    let chips       = load_u128(&key_agent(tid, turn, AF_CHIPS));
    let cur_bet     = load_u128(&key_table(tid, TF_CURRENT_BET));
    let agent_bet   = load_u128(&key_agent(tid, turn, AF_HAND_BET));
    let to_call     = cur_bet.saturating_sub(agent_bet);
    let agent_count = load_u8(&key_table(tid, TF_AGENT_COUNT));

    match action {
        ACT_FOLD => {
            store_u8(&key_agent(tid, turn, AF_FOLDED), 1);
            let ac = load_u8(&key_table(tid, TF_ACTIVE_COUNT)) - 1;
            store_u8(&key_table(tid, TF_ACTIVE_COUNT), ac);

            // Dealer-submitted fold = timeout → track misses
            if is_dealer {
                let missed = load_u8(&key_agent(tid, turn, AF_MISSED)) + 1;
                store_u8(&key_agent(tid, turn, AF_MISSED), missed);
                if missed >= MISSED_TURNS_KICK {
                    kick_agent(tid, turn, &agent_addr, agent_count);
                    touch_last_action(tid);
                    return_empty();
                }
            }

            if ac == 1 {
                let winner = find_active(tid, agent_count);
                award_pot(tid, winner, agent_count);
                touch_last_action(tid);
                return_empty();
            }
        }
        ACT_CHECK => {
            if to_call != 0 { revert(); }
        }
        ACT_CALL => {
            if to_call == 0  { revert(); }
            if chips < to_call { revert(); }
            store_u128(&key_agent(tid, turn, AF_CHIPS),   chips - to_call);
            store_u128(&key_agent(tid, turn, AF_HAND_BET), agent_bet + to_call);
            let pot = load_u128(&key_table(tid, TF_POT));
            store_u128(&key_table(tid, TF_POT), pot + to_call);
        }
        ACT_RAISE => {
            if amount == 0 { revert(); }
            let total = to_call + amount;
            if chips < total { revert(); }
            let new_hand_bet = agent_bet + total;
            store_u128(&key_agent(tid, turn, AF_CHIPS),   chips - total);
            store_u128(&key_agent(tid, turn, AF_HAND_BET), new_hand_bet);
            store_u128(&key_table(tid, TF_CURRENT_BET),   new_hand_bet);
            let pot = load_u128(&key_table(tid, TF_POT));
            store_u128(&key_table(tid, TF_POT), pot + total);
        }
        _ => revert(),
    }

    // Voluntary action: reset missed turns
    if is_agent {
        store_u8(&key_agent(tid, turn, AF_MISSED), 0);
    }

    // Advance turn to next active agent
    let next = find_next_active(tid, turn, agent_count);
    store_u8(&key_table(tid, TF_CURRENT_TURN), next);
    touch_last_action(tid);
    return_empty();
}

fn handle_resolve_hand() -> ! {
    let tid    = read_u32_param(4);
    let winner = read_u8_param(36);

    let caller = get_caller();
    require_dealer(&caller);
    if load_u8(&key_table(tid, TF_STATE)) != STATE_PLAYING { revert(); }

    let agent_count = load_u8(&key_table(tid, TF_AGENT_COUNT));
    if winner >= agent_count { revert(); }
    if load_u8(&key_agent(tid, winner, AF_KICKED)) != 0 { revert(); }
    if load_u8(&key_agent(tid, winner, AF_FOLDED)) != 0 { revert(); }

    award_pot(tid, winner, agent_count);
    touch_last_action(tid);
    return_empty();
}

fn handle_end_session() -> ! {
    let tid = read_u32_param(4);
    let caller = get_caller();
    require_dealer(&caller);

    let state = load_u8(&key_table(tid, TF_STATE));
    if state == STATE_OPEN {
        store_u8(&key_table(tid, TF_STATE), STATE_CANCELLED);
    } else if state == STATE_PLAYING {
        store_u8(&key_table(tid, TF_STATE), STATE_ENDED);
    } else {
        revert();
    }
    emit(&SESSION_ENDED_TOPIC, &tid.to_be_bytes());
    return_empty();
}

fn handle_cancel() -> ! {
    let tid = read_u32_param(4);
    let state = load_u8(&key_table(tid, TF_STATE));
    let now = get_now();

    let can_cancel = match state {
        STATE_OPEN => {
            // Betting window closed and dealer never dealt
            now > load_u64(&key_table(tid, TF_BET_DEADLINE)) &&
            load_u32(&key_table(tid, TF_CURRENT_HAND)) == 0
        }
        STATE_PLAYING => {
            // Dealer has gone dark for over 1 hour
            let last = load_u64(&key_table(tid, TF_LAST_ACTION));
            now.saturating_sub(last) > INACTIVITY_SECS
        }
        _ => false,
    };

    if !can_cancel { revert(); }
    store_u8(&key_table(tid, TF_STATE), STATE_CANCELLED);
    emit(&SESSION_ENDED_TOPIC, &tid.to_be_bytes());
    return_empty();
}

fn handle_update_dealer() -> ! {
    let caller = get_caller();
    let platform = load_addr(&key_platform());
    if !addr_eq(&caller, &platform) { revert(); }

    let new_dealer = read_addr_param(4);
    store_addr(&key_dealer(), &new_dealer);
    return_empty();
}

// ============================================================================
// INTERNAL GAME LOGIC
// ============================================================================

/// Kick an agent: mark kicked, forfeit remaining chips to prize pool
fn kick_agent(tid: u32, seat: u8, addr: &[u8;20], _agent_count: u8) {
    store_u8(&key_agent(tid, seat, AF_KICKED), 1);

    // Forfeit chips to prize pool
    let chips = load_u128(&key_agent(tid, seat, AF_CHIPS));
    store_u128(&key_agent(tid, seat, AF_CHIPS), 0);
    let prize = load_u128(&key_table(tid, TF_PRIZE_POOL));
    store_u128(&key_table(tid, TF_PRIZE_POOL), prize + chips);

    let mut data = [0u8; 21];
    data[0] = seat;
    data[1..21].copy_from_slice(addr);
    emit(&AGENT_KICKED_TOPIC, &data);

    // Check if session should end
    maybe_end_session(tid);
}

/// Award pot to winner, check session end
fn award_pot(tid: u32, winner: u8, agent_count: u8) {
    let pot   = load_u128(&key_table(tid, TF_POT));
    let chips = load_u128(&key_agent(tid, winner, AF_CHIPS));
    store_u128(&key_agent(tid, winner, AF_CHIPS), chips + pot);
    store_u128(&key_table(tid, TF_POT), 0);

    let mut data = [0u8; 5];
    data[0..4].copy_from_slice(&load_u32(&key_table(tid, TF_CURRENT_HAND)).to_be_bytes());
    data[4] = winner;
    emit(&HAND_RESOLVED_TOPIC, &data);

    // Reset current bet for next hand
    store_u128(&key_table(tid, TF_CURRENT_BET), 0);

    // Count alive agents and check session end
    let _ = agent_count; // used via maybe_end_session
    maybe_end_session(tid);
}

fn maybe_end_session(tid: u32) {
    let hand    = load_u32(&key_table(tid, TF_CURRENT_HAND));
    let slen    = load_u32(&key_table(tid, TF_SESSION_LEN));
    let acount  = load_u8(&key_table(tid, TF_AGENT_COUNT));

    let mut alive: u8 = 0;
    let mut i: u8 = 0;
    while i < acount {
        if load_u8(&key_agent(tid, i, AF_KICKED)) == 0 { alive += 1; }
        i += 1;
    }

    if hand >= slen || alive <= 1 {
        store_u8(&key_table(tid, TF_STATE), STATE_ENDED);
        emit(&SESSION_ENDED_TOPIC, &tid.to_be_bytes());
    }
}

/// Find the first non-kicked, non-folded agent
fn find_active(tid: u32, count: u8) -> u8 {
    let mut i: u8 = 0;
    while i < count {
        if load_u8(&key_agent(tid, i, AF_KICKED)) == 0 &&
           load_u8(&key_agent(tid, i, AF_FOLDED)) == 0 { return i; }
        i += 1;
    }
    0
}

/// Find next active agent after `after` (wrapping)
fn find_next_active(tid: u32, after: u8, count: u8) -> u8 {
    let mut i: u8 = 1;
    while i < count {
        let seat = (after + i) % count;
        if load_u8(&key_agent(tid, seat, AF_KICKED)) == 0 &&
           load_u8(&key_agent(tid, seat, AF_FOLDED)) == 0 { return seat; }
        i += 1;
    }
    after
}

/// Find seat(s) with max chips; returns (max_chips, winner_count)
fn find_chip_leaders(tid: u32, count: u8) -> (u128, u8) {
    let mut max: u128 = 0;
    let mut num: u8 = 0;
    let mut i: u8 = 0;
    while i < count {
        let chips = load_u128(&key_agent(tid, i, AF_CHIPS));
        if chips > max  { max = chips; num = 1; }
        else if chips == max && max > 0 { num += 1; }
        i += 1;
    }
    (max, num)
}

// ============================================================================
// PAYOUTS
// ============================================================================

fn handle_claim_chips() -> ! {
    let tid = read_u32_param(4);
    if load_u8(&key_table(tid, TF_STATE)) != STATE_ENDED { revert(); }

    let caller = get_caller();
    let count = load_u8(&key_table(tid, TF_AGENT_COUNT));
    let mut i: u8 = 0;
    while i < count {
        if addr_eq(&load_addr(&key_agent(tid, i, AF_ADDR)), &caller) {
            if load_u8(&key_agent(tid, i, AF_CHIPS_CLAIMED)) != 0 { revert(); }
            let chips = load_u128(&key_agent(tid, i, AF_CHIPS));
            if chips == 0 { revert(); }
            store_u8(&key_agent(tid, i, AF_CHIPS_CLAIMED), 1);
            transfer_to(&caller, chips);
            return_empty();
        }
        i += 1;
    }
    revert();
}

fn handle_claim_prize() -> ! {
    let tid = read_u32_param(4);
    if load_u8(&key_table(tid, TF_STATE)) != STATE_ENDED { revert(); }

    let caller = get_caller();
    let count = load_u8(&key_table(tid, TF_AGENT_COUNT));
    let (max_chips, num_winners) = find_chip_leaders(tid, count);
    if max_chips == 0 { revert(); }

    // Find caller's seat and verify they're a chip leader
    let mut caller_seat: u8 = u8::MAX;
    let mut i: u8 = 0;
    while i < count {
        if addr_eq(&load_addr(&key_agent(tid, i, AF_ADDR)), &caller) {
            if load_u128(&key_agent(tid, i, AF_CHIPS)) != max_chips { revert(); }
            if load_u8(&key_agent(tid, i, AF_PRIZE_CLAIMED)) != 0   { revert(); }
            caller_seat = i;
            break;
        }
        i += 1;
    }
    if caller_seat == u8::MAX { revert(); }

    let prize_pool = load_u128(&key_table(tid, TF_PRIZE_POOL));
    if prize_pool == 0 { revert(); }

    // Pay platform fee once (first winner to claim triggers it)
    if load_u8(&key_table(tid, TF_PRIZE_FEE_PAID)) == 0 {
        store_u8(&key_table(tid, TF_PRIZE_FEE_PAID), 1);
        let fee = prize_pool * PLATFORM_FEE_BPS / 10_000;
        let platform = load_addr(&key_platform());
        transfer_to(&platform, fee);
    }

    // Caller gets 1/num_winners share of 95%
    let net_pool = prize_pool - (prize_pool * PLATFORM_FEE_BPS / 10_000);
    let payout = net_pool / (num_winners as u128);

    store_u8(&key_agent(tid, caller_seat, AF_PRIZE_CLAIMED), 1);
    transfer_to(&caller, payout);
    return_empty();
}

fn handle_claim_bet_winnings() -> ! {
    let tid = read_u32_param(4);
    if load_u8(&key_table(tid, TF_STATE)) != STATE_ENDED { revert(); }

    let caller = get_caller();
    let count = load_u8(&key_table(tid, TF_AGENT_COUNT));
    let (max_chips, _) = find_chip_leaders(tid, count);
    if max_chips == 0 { revert(); }

    // Determine winning seat(s) — for bets we pick the first chip leader
    // (if tie, bettors on any tied seat win; we handle per-seat separately)
    let total_pool = load_u128(&key_table(tid, TF_TOTAL_BET_POOL));
    if total_pool == 0 { revert(); }

    // Find caller's unclaimed bet record that backed a chip leader
    let bettor_count = load_u8(&key_table(tid, TF_BETTOR_COUNT));
    let mut j: u8 = 0;
    while j < bettor_count {
        if addr_eq(&load_addr(&key_bet(tid, j, BF_ADDR)), &caller) {
            if load_u8(&key_bet(tid, j, BF_CLAIMED)) == 0 {
                let seat = load_u8(&key_bet(tid, j, BF_SEAT));
                let seat_chips = load_u128(&key_agent(tid, seat, AF_CHIPS));
                if seat_chips == max_chips {
                    // This bettor backed a winner
                    let agent_total = load_u128(&key_agent_bet_total(tid, seat));

                    // Pay platform fee on bet pool once
                    if load_u8(&key_table(tid, TF_BET_FEE_PAID)) == 0 {
                        store_u8(&key_table(tid, TF_BET_FEE_PAID), 1);
                        let fee = total_pool * PLATFORM_FEE_BPS / 10_000;
                        let platform = load_addr(&key_platform());
                        transfer_to(&platform, fee);
                    }

                    let net_pool = total_pool - (total_pool * PLATFORM_FEE_BPS / 10_000);
                    let bet_amt  = load_u128(&key_bet(tid, j, BF_AMOUNT));
                    let payout   = if agent_total > 0 {
                        net_pool * bet_amt / agent_total
                    } else { 0 };

                    store_u8(&key_bet(tid, j, BF_CLAIMED), 1);
                    transfer_to(&caller, payout);
                    return_empty();
                }
            }
        }
        j += 1;
    }
    revert(); // no winning unclaimed bet found
}

fn handle_refund() -> ! {
    let tid = read_u32_param(4);
    if load_u8(&key_table(tid, TF_STATE)) != STATE_CANCELLED { revert(); }

    let caller = get_caller();
    let agent_count = load_u8(&key_table(tid, TF_AGENT_COUNT));
    let buy_in = load_u128(&key_table(tid, TF_BUY_IN));

    // Creator gets prize pool back (checked first)
    let creator = load_addr(&key_table(tid, TF_CREATOR));
    if addr_eq(&creator, &caller) && load_u8(&key_table(tid, TF_PRIZE_FEE_PAID)) == 0 {
        let pool = load_u128(&key_table(tid, TF_PRIZE_POOL));
        if pool > 0 {
            store_u8(&key_table(tid, TF_PRIZE_FEE_PAID), 1); // repurpose flag as "prize pool refunded"
            transfer_to(&caller, pool);
            return_empty();
        }
    }

    // Agent buy-in refund (only if not kicked — kicked agents forfeited mid-session; 
    // but if session was cancelled before play started, kick can't happen)
    let mut i: u8 = 0;
    while i < agent_count {
        if addr_eq(&load_addr(&key_agent(tid, i, AF_ADDR)), &caller) {
            if load_u8(&key_agent(tid, i, AF_CHIPS_CLAIMED)) == 0 {
                store_u8(&key_agent(tid, i, AF_CHIPS_CLAIMED), 1);
                transfer_to(&caller, buy_in);
                return_empty();
            }
        }
        i += 1;
    }

    // Bettor refund
    let bettor_count = load_u8(&key_table(tid, TF_BETTOR_COUNT));
    let mut j: u8 = 0;
    while j < bettor_count {
        if addr_eq(&load_addr(&key_bet(tid, j, BF_ADDR)), &caller) {
            if load_u8(&key_bet(tid, j, BF_CLAIMED)) == 0 {
                let amt = load_u128(&key_bet(tid, j, BF_AMOUNT));
                store_u8(&key_bet(tid, j, BF_CLAIMED), 1);
                transfer_to(&caller, amt);
                return_empty();
            }
        }
        j += 1;
    }
    revert();
}

// ============================================================================
// VIEW FUNCTIONS
// ============================================================================

fn handle_get_table_info() -> ! {
    let tid = read_u32_param(4);
    // ABI: (address creator, uint256 prizePool, uint256 buyIn, uint8 maxAgents,
    //       uint8 agentCount, uint32 sessionLen, uint32 currentHand,
    //       uint64 betDeadline, uint8 state) — 9 slots × 32 bytes
    let mut r = [0u8; 288];
    let c = load_addr(&key_table(tid, TF_CREATOR));
    r[12..32].copy_from_slice(&c);

    let pp = load_u128(&key_table(tid, TF_PRIZE_POOL));
    r[48..64].copy_from_slice(&pp.to_be_bytes());

    let bi = load_u128(&key_table(tid, TF_BUY_IN));
    r[80..96].copy_from_slice(&bi.to_be_bytes());

    r[127] = load_u8(&key_table(tid, TF_MAX_AGENTS));
    r[159] = load_u8(&key_table(tid, TF_AGENT_COUNT));

    let sl = load_u32(&key_table(tid, TF_SESSION_LEN));
    r[188..192].copy_from_slice(&sl.to_be_bytes());

    let ch = load_u32(&key_table(tid, TF_CURRENT_HAND));
    r[220..224].copy_from_slice(&ch.to_be_bytes());

    let bd = load_u64(&key_table(tid, TF_BET_DEADLINE));
    r[248..256].copy_from_slice(&bd.to_be_bytes());

    r[287] = load_u8(&key_table(tid, TF_STATE));
    api::return_value(ReturnFlags::empty(), &r);
}

fn handle_get_agent_info() -> ! {
    let tid  = read_u32_param(4);
    let seat = read_u8_param(36);
    // ABI: (address agent, uint256 chips, bool folded, bool kicked, uint8 missedTurns)
    let mut r = [0u8; 160];
    let a = load_addr(&key_agent(tid, seat, AF_ADDR));
    r[12..32].copy_from_slice(&a);
    let chips = load_u128(&key_agent(tid, seat, AF_CHIPS));
    r[48..64].copy_from_slice(&chips.to_be_bytes());
    r[95]  = load_u8(&key_agent(tid, seat, AF_FOLDED));
    r[127] = load_u8(&key_agent(tid, seat, AF_KICKED));
    r[159] = load_u8(&key_agent(tid, seat, AF_MISSED));
    api::return_value(ReturnFlags::empty(), &r);
}

fn handle_get_bet_info() -> ! {
    let tid  = read_u32_param(4);
    let addr = read_addr_param(36);
    let count = load_u8(&key_table(tid, TF_BETTOR_COUNT));
    let mut r = [0u8; 96];
    let mut i: u8 = 0;
    while i < count {
        if addr_eq(&load_addr(&key_bet(tid, i, BF_ADDR)), &addr) {
            r[31]    = load_u8(&key_bet(tid, i, BF_SEAT));
            let amt  = load_u128(&key_bet(tid, i, BF_AMOUNT));
            r[48..64].copy_from_slice(&amt.to_be_bytes());
            r[95]    = load_u8(&key_bet(tid, i, BF_CLAIMED));
            api::return_value(ReturnFlags::empty(), &r);
        }
        i += 1;
    }
    api::return_value(ReturnFlags::empty(), &r);
}

fn handle_get_agent_bet_total() -> ! {
    let tid  = read_u32_param(4);
    let seat = read_u8_param(36);
    let total = load_u128(&key_agent_bet_total(tid, seat));
    let mut r = [0u8;32]; r[16..].copy_from_slice(&total.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &r);
}

fn handle_get_total_bet_pool() -> ! {
    let tid   = read_u32_param(4);
    let total = load_u128(&key_table(tid, TF_TOTAL_BET_POOL));
    let mut r = [0u8;32]; r[16..].copy_from_slice(&total.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &r);
}

fn handle_get_current_pot() -> ! {
    let tid = read_u32_param(4);
    let pot = load_u128(&key_table(tid, TF_POT));
    let mut r = [0u8;32]; r[16..].copy_from_slice(&pot.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &r);
}
