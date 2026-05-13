# Fixture 05 — LOW_IV_TREND with `style=income` → sell covered call instead of buying put

**STATUS: SCENARIO SPEC ONLY.** `inputs.json` to be authored in a follow-up
commit before the M1.24 PR flips from draft → ready-for-review. The replay
harness `test_master_decision_goldens.py::test_golden_decision_matches[05-low-iv-trend-income-overrides-buy-put]`
soft-skips while `inputs.json` is absent.

| | |
|---|---|
| **Regime** | `LOW_IV_TREND` |
| **Expected matched rule** | `high_iv_sell_call (income style overrides buy_put path)` (per `rules.yaml` + plan v1.2 §22.8) |
| **Expected emit** | `SELL_COVERED_CALL_PARTIAL` |
| **M1.11b path exercised** | not exercised |
| **M1.12 path exercised** | not exercised |

## Scenario

Same regime as fixture 04 but with the user's profile style set to `income`. The `infer_intent` table (§22.5) explicitly overrides the `LOW_IV_TREND` → `buy_put` mapping to `sell_call` when style is income. With `iv_rank ≥ 50` the `high_iv_sell_call` rule fires (regime ∈ `{HIGH_IV_EVENT, HIGH_IV_PIN, LOW_IV_RANGE}` is the explicit allowlist, but the rule's `iv_rank_gte: 50` + `has_short_call: false` predicates can match LOW_IV_TREND too depending on engine wiring — verify on first regen).

## Trigger conditions

`regime = LOW_IV_TREND`, `style = income`, `iv_rank = 55.0`, `has_short_call = False`. Note: the precise rule the pipeline picks depends on `rules.yaml` evaluation order — if `high_iv_sell_call` doesn't fire because `LOW_IV_TREND` isn't in its regime allowlist, this fixture may need a different rule (e.g. the income-style path may fall through to `hold_no_op`). Verify on first regen and update this README if the rule choice differs.

## TODO before authoring `inputs.json`

1. Pick a `spot` + 8-strike chain layout that places the rule's required
   strikes in plausible OTM/ITM zones.
2. Construct `MarketStateResult` with field values that produce the target
   regime (`regime_score` should dominate `all_scores` to make the choice
   unambiguous, even though the engine only reads `regime` directly).
3. Pick `PositionState` flags that satisfy this rule's predicates WITHOUT
   accidentally tripping a higher-priority rule's predicates.
4. Mirror the field shape from fixture 01 / 03 / 11 (already authored).
5. Run `uv run python scripts/regenerate_decision_goldens.py --fixture 05-low-iv-trend-income-overrides-buy-put`
   locally to produce `expected.json`. Verify the recommendation engine
   matched `high_iv_sell_call (income style overrides buy_put path)`. Commit both files.
