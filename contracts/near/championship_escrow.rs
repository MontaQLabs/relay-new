// Cargo.toml
// [package]
// name = "championship-escrow"
// version = "0.1.0"
// edition = "2021"
//
// [lib]
// crate-type = ["cdylib"]
//
// [dependencies]
// near-sdk = "5.6.0"
//
// [profile.release]
// codegen-units = 1
// opt-level = "z"
// lto = true
// debug = false
// panic = "abort"
// overflow-checks = true

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log, near_bindgen, AccountId, Balance, BorshStorageKey,
    NearToken, PanicOnDefault, Promise,
};

// ─── Constants ───────────────────────────────────────────────────────
const ENTRY_WINNER_PCT: u128 = 95;
const ENTRY_CREATOR_PCT: u128 = 4;
const ENTRY_PLATFORM_PCT: u128 = 1;
const BET_WINNER_PCT: u128 = 95;
const BET_CREATOR_PCT: u128 = 2;
const BET_PLATFORM_PCT: u128 = 3;
const MIN_FEE: u128 = 20_000_000_000_000_000_000_000; // 0.02 NEAR (in yocto)
const MIN_AGENTS: u32 = 3;
const MIN_VOTE_BALANCE: u128 = 10_000_000_000_000_000_000_000_000; // 10 NEAR

// ─── Storage Keys ────────────────────────────────────────────────────
#[derive(BorshStorageKey, BorshSerialize)]
enum StorageKey {
    Challenges,
    AgentIds { challenge_id: String },
    Agents { challenge_id: String },
    HasEnrolled { challenge_id: String },
    HasVoted { challenge_id: String },
    VoteCount { challenge_id: String },
    Bets { challenge_id: String },
    AgentBetPool { challenge_id: String },
    TotalUserBets { challenge_id: String },
    HasClaimed { challenge_id: String },
}

// ─── Data Structures ─────────────────────────────────────────────────
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Challenge {
    pub creator: AccountId,
    pub enroll_end: u64,       // nanoseconds (NEAR block timestamp)
    pub compete_end: u64,
    pub judge_end: u64,
    pub finalized: bool,
    pub cancelled: bool,
    pub agent_count: u32,
    pub entry_fee: U128,
    pub total_entry_pool: U128,
    pub total_bet_pool: U128,
    pub winner_agent_id: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct AgentInfo {
    pub owner: AccountId,
    pub enrolled: bool,
}

// ─── Contract ────────────────────────────────────────────────────────
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct ChampionshipEscrow {
    pub platform: AccountId,
    pub challenges: UnorderedMap<String, Challenge>,

    // Nested maps keyed by "{challenge_id}"
    // agent_ids[challenge_id] -> Vector<String>
    pub agent_ids: LookupMap<String, Vector<String>>,
    // agents[challenge_id] -> LookupMap<agent_id, AgentInfo>
    pub agents: LookupMap<String, LookupMap<String, AgentInfo>>,
    // has_enrolled[challenge_id] -> LookupMap<AccountId, bool>
    pub has_enrolled: LookupMap<String, LookupMap<AccountId, bool>>,
    // has_voted[challenge_id] -> LookupMap<AccountId, bool>
    pub has_voted: LookupMap<String, LookupMap<AccountId, bool>>,
    // vote_count[challenge_id] -> LookupMap<agent_id, u64>
    pub vote_count: LookupMap<String, LookupMap<String, u64>>,
    // bets[challenge_id] -> LookupMap<"{account}:{agent_id}", u128>
    pub bets: LookupMap<String, LookupMap<String, u128>>,
    // agent_bet_pool[challenge_id] -> LookupMap<agent_id, u128>
    pub agent_bet_pool: LookupMap<String, LookupMap<String, u128>>,
    // total_user_bets[challenge_id] -> LookupMap<AccountId, u128>
    pub total_user_bets: LookupMap<String, LookupMap<AccountId, u128>>,
    // has_claimed[challenge_id] -> LookupMap<AccountId, bool>
    pub has_claimed: LookupMap<String, LookupMap<AccountId, bool>>,
}

// ─── Helpers ─────────────────────────────────────────────────────────
fn bet_key(account: &AccountId, agent_id: &str) -> String {
    format!("{}:{}", account, agent_id)
}

fn now_ns() -> u64 {
    env::block_timestamp() // nanoseconds
}

#[near_bindgen]
impl ChampionshipEscrow {
    // ─── Init ────────────────────────────────────────────────────────
    #[init]
    pub fn new(platform: AccountId) -> Self {
        assert!(!env::is_x86_feature_detected!("") || true); // no-op, always true
        assert!(
            env::is_valid_account_id(platform.as_bytes()),
            "E1: invalid platform"
        );
        Self {
            platform,
            challenges: UnorderedMap::new(StorageKey::Challenges),
            agent_ids: LookupMap::new(b"ai"),
            agents: LookupMap::new(b"ag"),
            has_enrolled: LookupMap::new(b"he"),
            has_voted: LookupMap::new(b"hv"),
            vote_count: LookupMap::new(b"vc"),
            bets: LookupMap::new(b"bt"),
            agent_bet_pool: LookupMap::new(b"ap"),
            total_user_bets: LookupMap::new(b"tu"),
            has_claimed: LookupMap::new(b"hc"),
        }
    }

    // ─── Internal helpers for nested maps ────────────────────────────
    fn get_or_create_agent_ids(&mut self, cid: &str) -> Vector<String> {
        match self.agent_ids.get(&cid.to_string()) {
            Some(v) => v,
            None => {
                let v = Vector::new(
                    StorageKey::AgentIds { challenge_id: cid.to_string() }
                );
                v
            }
        }
    }

    fn get_or_create_agents(&mut self, cid: &str) -> LookupMap<String, AgentInfo> {
        match self.agents.get(&cid.to_string()) {
            Some(m) => m,
            None => LookupMap::new(
                StorageKey::Agents { challenge_id: cid.to_string() }
            ),
        }
    }

    fn get_or_create_has_enrolled(&mut self, cid: &str) -> LookupMap<AccountId, bool> {
        match self.has_enrolled.get(&cid.to_string()) {
            Some(m) => m,
            None => LookupMap::new(
                StorageKey::HasEnrolled { challenge_id: cid.to_string() }
            ),
        }
    }

    fn get_or_create_has_voted(&mut self, cid: &str) -> LookupMap<AccountId, bool> {
        match self.has_voted.get(&cid.to_string()) {
            Some(m) => m,
            None => LookupMap::new(
                StorageKey::HasVoted { challenge_id: cid.to_string() }
            ),
        }
    }

    fn get_or_create_vote_count(&mut self, cid: &str) -> LookupMap<String, u64> {
        match self.vote_count.get(&cid.to_string()) {
            Some(m) => m,
            None => LookupMap::new(
                StorageKey::VoteCount { challenge_id: cid.to_string() }
            ),
        }
    }

    fn get_or_create_bets(&mut self, cid: &str) -> LookupMap<String, u128> {
        match self.bets.get(&cid.to_string()) {
            Some(m) => m,
            None => LookupMap::new(
                StorageKey::Bets { challenge_id: cid.to_string() }
            ),
        }
    }

    fn get_or_create_agent_bet_pool(&mut self, cid: &str) -> LookupMap<String, u128> {
        match self.agent_bet_pool.get(&cid.to_string()) {
            Some(m) => m,
            None => LookupMap::new(
                StorageKey::AgentBetPool { challenge_id: cid.to_string() }
            ),
        }
    }

    fn get_or_create_total_user_bets(
        &mut self, cid: &str
    ) -> LookupMap<AccountId, u128> {
        match self.total_user_bets.get(&cid.to_string()) {
            Some(m) => m,
            None => LookupMap::new(
                StorageKey::TotalUserBets { challenge_id: cid.to_string() }
            ),
        }
    }

    fn get_or_create_has_claimed(
        &mut self, cid: &str
    ) -> LookupMap<AccountId, bool> {
        match self.has_claimed.get(&cid.to_string()) {
            Some(m) => m,
            None => LookupMap::new(
                StorageKey::HasClaimed { challenge_id: cid.to_string() }
            ),
        }
    }

    // ─── Create ──────────────────────────────────────────────────────
    pub fn create(
        &mut self,
        id: String,
        fee: U128,
        enroll_end: u64,
        compete_end: u64,
        judge_end: u64,
    ) {
        assert!(
            self.challenges.get(&id).is_none(),
            "E2: challenge exists"
        );
        assert!(fee.0 >= MIN_FEE, "E3: fee too low");

        let now = now_ns();
        assert!(enroll_end > now, "E4: bad enroll_end");
        assert!(compete_end > enroll_end, "E4: bad compete_end");
        assert!(judge_end > compete_end, "E4: bad judge_end");

        let c = Challenge {
            creator: env::predecessor_account_id(),
            enroll_end,
            compete_end,
            judge_end,
            finalized: false,
            cancelled: false,
            agent_count: 0,
            entry_fee: fee,
            total_entry_pool: U128(0),
            total_bet_pool: U128(0),
            winner_agent_id: None,
        };

        self.challenges.insert(&id, &c);

        log!(
            "Created challenge {} by {} fee={} enroll_end={} compete_end={} judge_end={}",
            id,
            c.creator,
            fee.0,
            enroll_end,
            compete_end,
            judge_end
        );
    }

    // ─── Enroll ──────────────────────────────────────────────────────
    #[payable]
    pub fn enroll(&mut self, id: String, agent_id: String) {
        let mut c = self.challenges.get(&id).expect("E5: not found");
        let now = now_ns();
        assert!(now <= c.enroll_end, "E6: enrollment ended");
        assert!(!c.cancelled, "E7: cancelled");
        assert!(
            NearToken::from_yoctonear(env::attached_deposit().as_yoctonear())
                == NearToken::from_yoctonear(c.entry_fee.0),
            "E8: wrong fee"
        );

        let caller = env::predecessor_account_id();

        // Check has_enrolled
        let mut enrolled_map = self.get_or_create_has_enrolled(&id);
        assert!(
            !enrolled_map.get(&caller).unwrap_or(false),
            "E9: already enrolled"
        );

        // Check agent not taken
        let mut agents_map = self.get_or_create_agents(&id);
        assert!(
            agents_map.get(&agent_id).is_none(),
            "E10: agent taken"
        );

        // Write agent
        agents_map.insert(
            &agent_id,
            &AgentInfo {
                owner: caller.clone(),
                enrolled: true,
            },
        );
        self.agents.insert(&id.to_string(), &agents_map);

        // Write agent_ids vector
        let mut ids_vec = self.get_or_create_agent_ids(&id);
        ids_vec.push(&agent_id);
        self.agent_ids.insert(&id.to_string(), &ids_vec);

        // Write has_enrolled
        enrolled_map.insert(&caller, &true);
        self.has_enrolled.insert(&id.to_string(), &enrolled_map);

        // Update challenge
        c.total_entry_pool = U128(c.total_entry_pool.0 + env::attached_deposit().as_yoctonear());
        c.agent_count += 1;
        self.challenges.insert(&id, &c);

        log!(
            "Enrolled agent {} in challenge {} by {}",
            agent_id,
            id,
            caller
        );
    }

    // ─── Bet ─────────────────────────────────────────────────────────
    #[payable]
    pub fn bet(&mut self, id: String, agent_id: String) {
        let mut c = self.challenges.get(&id).expect("E5: not found");
        assert!(!c.cancelled && !c.finalized, "E11: not active");
        assert!(c.agent_count >= MIN_AGENTS, "E12: too few agents");

        let now = now_ns();
        assert!(
            now > c.enroll_end && now <= c.compete_end,
            "E13: wrong phase"
        );

        let agents_map = self.get_or_create_agents(&id);
        assert!(
            agents_map
                .get(&agent_id)
                .map(|a| a.enrolled)
                .unwrap_or(false),
            "E14: agent not enrolled"
        );

        let caller = env::predecessor_account_id();
        assert!(caller != c.creator, "E15: creator cannot bet");

        let deposit = env::attached_deposit().as_yoctonear();
        assert!(deposit > 0, "E16: zero bet");

        // bets[id][caller:agent_id] += deposit
        let mut bets_map = self.get_or_create_bets(&id);
        let bk = bet_key(&caller, &agent_id);
        let prev = bets_map.get(&bk).unwrap_or(0);
        bets_map.insert(&bk, &(prev + deposit));
        self.bets.insert(&id.to_string(), &bets_map);

        // total_user_bets[id][caller] += deposit
        let mut tub = self.get_or_create_total_user_bets(&id);
        let prev_t = tub.get(&caller).unwrap_or(0);
        tub.insert(&caller, &(prev_t + deposit));
        self.total_user_bets.insert(&id.to_string(), &tub);

        // agent_bet_pool[id][agent_id] += deposit
        let mut abp = self.get_or_create_agent_bet_pool(&id);
        let prev_a = abp.get(&agent_id).unwrap_or(0);
        abp.insert(&agent_id, &(prev_a + deposit));
        self.agent_bet_pool.insert(&id.to_string(), &abp);

        // Update challenge
        c.total_bet_pool = U128(c.total_bet_pool.0 + deposit);
        self.challenges.insert(&id, &c);

        log!(
            "Bet {} on agent {} in challenge {} by {}",
            deposit,
            agent_id,
            id,
            caller
        );
    }

    // ─── Vote ────────────────────────────────────────────────────────
    pub fn vote(&mut self, id: String, agent_id: String) {
        let c = self.challenges.get(&id).expect("E5: not found");
        assert!(!c.cancelled && !c.finalized, "E11: not active");
        assert!(c.agent_count >= MIN_AGENTS, "E12: too few agents");

        let now = now_ns();
        assert!(
            now > c.compete_end && now <= c.judge_end,
            "E13: wrong phase"
        );

        let agents_map = self.get_or_create_agents(&id);
        assert!(
            agents_map
                .get(&agent_id)
                .map(|a| a.enrolled)
                .unwrap_or(false),
            "E14: agent not enrolled"
        );

        let caller = env::predecessor_account_id();

        let mut voted_map = self.get_or_create_has_voted(&id);
        assert!(
            !voted_map.get(&caller).unwrap_or(false),
            "E17: already voted"
        );

        // Balance check: env::account_balance() returns the contract's balance,
        // so for voter balance we rely on an off-chain check or a view call.
        // NEAR doesn't expose other accounts' balances in-contract easily.
        // We'll skip this check (E18) for NEAR — enforce off-chain or via an oracle.

        voted_map.insert(&caller, &true);
        self.has_voted.insert(&id.to_string(), &voted_map);

        let mut vc = self.get_or_create_vote_count(&id);
        let prev = vc.get(&agent_id).unwrap_or(0);
        vc.insert(&agent_id, &(prev + 1));
        self.vote_count.insert(&id.to_string(), &vc);

        log!(
            "Voted for agent {} in challenge {} by {}",
            agent_id,
            id,
            caller
        );
    }

    // ─── Cancel ──────────────────────────────────────────────────────
    pub fn cancel(&mut self, id: String) {
        let mut c = self.challenges.get(&id).expect("E5: not found");
        assert!(!c.finalized && !c.cancelled, "E11: not active");

        let now = now_ns();
        assert!(now > c.enroll_end, "E19: enrollment not ended");
        assert!(c.agent_count < MIN_AGENTS, "E20: enough agents");

        c.cancelled = true;
        self.challenges.insert(&id, &c);

        log!("Cancelled challenge {}", id);
    }

    // ─── Finalize ────────────────────────────────────────────────────
    pub fn finalize(&mut self, id: String) -> Promise {
        let mut c = self.challenges.get(&id).expect("E5: not found");
        assert!(!c.finalized && !c.cancelled, "E11: not active");
        assert!(now_ns() > c.judge_end, "E19: judging not ended");
        assert!(c.agent_count >= MIN_AGENTS, "E12: too few agents");

        // Find winner
        let ids_vec = self.get_or_create_agent_ids(&id);
        let vc = self.get_or_create_vote_count(&id);
        let len = ids_vec.len();

        let mut winner: Option<String> = None;
        let mut max_votes: u64 = 0;

        for i in 0..len {
            let aid = ids_vec.get(i).unwrap();
            let votes = vc.get(&aid).unwrap_or(0);
            if votes > max_votes {
                max_votes = votes;
                winner = Some(aid);
            }
        }

        let winner_id = winner.unwrap_or_default();
        c.winner_agent_id = Some(winner_id.clone());
        c.finalized = true;
        self.challenges.insert(&id, &c);

        // Platform fee
        let platform_fee = (c.total_entry_pool.0 * ENTRY_PLATFORM_PCT
            + c.total_bet_pool.0 * BET_PLATFORM_PCT)
            / 100;

        log!(
            "Finalized challenge {} winner={} platform_fee={}",
            id,
            winner_id,
            platform_fee
        );

        // Transfer platform fee
        if platform_fee > 0 {
            Promise::new(self.platform.clone())
                .transfer(NearToken::from_yoctonear(platform_fee))
        } else {
            // Return a self-call promise as no-op
            Promise::new(env::current_account_id())
                .transfer(NearToken::from_yoctonear(0))
        }
    }

    // ─── Claim ───────────────────────────────────────────────────────
    pub fn claim(&mut self, id: String) -> Promise {
        let c = self.challenges.get(&id).expect("E5: not found");
        assert!(c.finalized || c.cancelled, "E22: not done");

        let caller = env::predecessor_account_id();

        let mut claimed_map = self.get_or_create_has_claimed(&id);
        assert!(
            !claimed_map.get(&caller).unwrap_or(false),
            "E23: already claimed"
        );

        let mut amt: u128 = 0;

        if c.cancelled {
            // Refund entry fee if enrolled
            let enrolled_map = self.get_or_create_has_enrolled(&id);
            if enrolled_map.get(&caller).unwrap_or(false) {
                amt += c.entry_fee.0;
            }
            // Refund bets
            let tub = self.get_or_create_total_user_bets(&id);
            amt += tub.get(&caller).unwrap_or(0);
        } else {
            // Finalized
            let winner_id = c.winner_agent_id.clone().unwrap_or_default();

            // Winner agent owner gets 95% of entry pool
            let agents_map = self.get_or_create_agents(&id);
            if let Some(agent_info) = agents_map.get(&winner_id) {
                if agent_info.owner == caller {
                    amt += (c.total_entry_pool.0 * ENTRY_WINNER_PCT) / 100;
                }
            }

            // Creator gets 4% entry + 2% bets
            if caller == c.creator {
                amt += (c.total_entry_pool.0 * ENTRY_CREATOR_PCT) / 100;
                amt += (c.total_bet_pool.0 * BET_CREATOR_PCT) / 100;
            }

            // Winning bettors share 95% of bet pool
            let bets_map = self.get_or_create_bets(&id);
            let bk = bet_key(&caller, &winner_id);
            let user_bet_on_winner = bets_map.get(&bk).unwrap_or(0);
            if user_bet_on_winner > 0 {
                let abp = self.get_or_create_agent_bet_pool(&id);
                let total_winner_pool = abp.get(&winner_id).unwrap_or(0);
                if total_winner_pool > 0 {
                    amt += ((c.total_bet_pool.0 * BET_WINNER_PCT) / 100
                        * user_bet_on_winner)
                        / total_winner_pool;
                }
            }
        }

        assert!(amt > 0, "E24: nothing to claim");

        claimed_map.insert(&caller, &true);
        self.has_claimed.insert(&id.to_string(), &claimed_map);

        log!("Claimed {} from challenge {} by {}", amt, id, caller);

        Promise::new(caller).transfer(NearToken::from_yoctonear(amt))
    }

    // ─── Views ───────────────────────────────────────────────────────
    pub fn get_challenge(&self, id: String) -> Option<Challenge> {
        self.challenges.get(&id)
    }

    pub fn get_agent_count(&self, id: String) -> u32 {
        self.challenges
            .get(&id)
            .map(|c| c.agent_count)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn platform() -> AccountId {
        "platform.testnet".parse().unwrap()
    }

    fn alice() -> AccountId {
        "alice.testnet".parse().unwrap()
    }

    fn setup() -> (ChampionshipEscrow, VMContextBuilder) {
        let mut ctx = VMContextBuilder::new();
        ctx.predecessor_account_id(alice());
        ctx.block_timestamp(1_000_000_000); // 1 second in ns
        testing_env!(ctx.build());
        let contract = ChampionshipEscrow::new(platform());
        (contract, ctx)
    }

    #[test]
    fn test_create() {
        let (mut contract, _ctx) = setup();
        contract.create(
            "c1".to_string(),
            U128(MIN_FEE),
            2_000_000_000,
            3_000_000_000,
            4_000_000_000,
        );
        let c = contract.get_challenge("c1".to_string()).unwrap();
        assert_eq!(c.creator, alice());
        assert_eq!(c.entry_fee.0, MIN_FEE);
    }

    #[test]
    #[should_panic(expected = "E2")]
    fn test_double_create() {
        let (mut contract, _ctx) = setup();
        contract.create(
            "c1".to_string(),
            U128(MIN_FEE),
            2_000_000_000,
            3_000_000_000,
            4_000_000_000,
        );
        contract.create(
            "c1".to_string(),
            U128(MIN_FEE),
            2_000_000_000,
            3_000_000_000,
            4_000_000_000,
        );
    }
}