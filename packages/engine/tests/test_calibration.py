"""Confidence calibration scaffold (M1.25 — Phase-1 "calibration tests, scaffolded").

Per master plan v1.2 §19 — "Calibration tests (P3, but scaffolded in P1)":

    Run engine across 12 months of historical fixtures; bin by `confidence`;
    assert empirical success rate is monotonic across bins.

Phase 1 ships the **machinery + a representative scaffold**, not the full
historical validation. The plan classifies the P1 calibration signal as
*soft / warn*; the real `(decision, outcome)` corpus (12 months of labelled
outcomes) lands in **M3.10** (`Calibration test suite (rubric + CI
integration)`) once the Outcome Tracker (M1.23) has accumulated enough rows.

So this module:

1. Provides the binning + monotonicity primitives the M3.10 suite reuses.
2. Verifies them on a synthetic *calibrated* corpus (passes) and an
   *anti-calibrated* one (the checker has teeth — it returns ``False``).
3. Runs the binner over the **real** confidence values emitted by the 12
   M1.24 golden ``DailyDecision`` fixtures, proving the scaffold integrates
   with actual engine output. No outcome labels exist yet, so that case
   asserts binning well-formedness, not monotonic success.

When M3.10 lands, swap ``_CALIBRATED`` for real
``(confidence, decision_quality == "good")`` samples drawn from ``/outcomes``
and the monotonicity assertion becomes a live calibration gate.
"""

from __future__ import annotations

import json
from typing import NamedTuple

import pytest

from tests._golden_helpers import GOLDENS_DIR, list_fixtures


class CalibrationSample(NamedTuple):
    """One ``(predicted confidence, realized success)`` observation."""

    confidence: float
    success: bool


def bin_index(confidence: float, n_bins: int) -> int:
    """Map a confidence in ``[0, 1]`` to a bin index in ``[0, n_bins - 1]``.

    ``confidence == 1.0`` lands in the top bin (rather than overflowing to
    ``n_bins``); out-of-range inputs are clamped defensively.
    """
    if n_bins < 1:
        raise ValueError("n_bins must be >= 1")
    clamped = min(1.0, max(0.0, confidence))
    return min(int(clamped * n_bins), n_bins - 1)


def binned_success_rates(
    samples: list[CalibrationSample], n_bins: int
) -> list[float | None]:
    """Empirical success rate per confidence bin.

    Returns a list of length ``n_bins``; a bin with no samples is ``None``
    (it imposes no constraint on the monotonicity check).
    """
    totals = [0] * n_bins
    hits = [0] * n_bins
    for sample in samples:
        idx = bin_index(sample.confidence, n_bins)
        totals[idx] += 1
        if sample.success:
            hits[idx] += 1
    return [
        (hits[i] / totals[i]) if totals[i] > 0 else None for i in range(n_bins)
    ]


def is_monotonic_nondecreasing(rates: list[float | None]) -> bool:
    """True when non-empty bin rates never decrease as confidence rises.

    ``None`` (empty) bins are skipped — a well-calibrated model's success rate
    should be non-decreasing across populated confidence bins.
    """
    last: float | None = None
    for rate in rates:
        if rate is None:
            continue
        if last is not None and rate < last:
            return False
        last = rate
    return True


def _golden_confidences() -> list[float]:
    """Harvest the ``confidence`` field from each M1.24 golden ``expected.json``."""
    out: list[float] = []
    for name in list_fixtures():
        expected = GOLDENS_DIR / name / "expected.json"
        if not expected.exists():
            continue
        value = json.loads(expected.read_text()).get("confidence")
        if value is not None:
            out.append(float(value))
    return out


# A synthetic, well-calibrated corpus: success rate rises with confidence.
# Stand-in for the M3.10 real corpus; deterministic for CI. With n_bins=5 the
# per-bin rates are [0.0, 0.0, 0.5, 1.0, 1.0] — non-decreasing.
_CALIBRATED: list[CalibrationSample] = [
    CalibrationSample(0.05, False),
    CalibrationSample(0.10, False),
    CalibrationSample(0.15, False),
    CalibrationSample(0.25, False),
    CalibrationSample(0.30, False),
    CalibrationSample(0.45, False),
    CalibrationSample(0.55, True),
    CalibrationSample(0.65, True),
    CalibrationSample(0.78, True),
    CalibrationSample(0.85, True),
    CalibrationSample(0.95, True),
]

# Anti-calibrated: high-confidence calls fail, low-confidence ones succeed.
_ANTI_CALIBRATED: list[CalibrationSample] = [
    CalibrationSample(0.05, True),
    CalibrationSample(0.10, True),
    CalibrationSample(0.90, False),
    CalibrationSample(0.95, False),
]


def test_bin_index_edges() -> None:
    """``0.0`` → bin 0; ``1.0`` → top bin; out-of-range inputs clamp in-bounds."""
    assert bin_index(0.0, 5) == 0
    assert bin_index(1.0, 5) == 4
    assert bin_index(0.5, 5) == 2
    assert bin_index(0.99, 5) == 4
    assert bin_index(-0.2, 5) == 0
    assert bin_index(1.5, 5) == 4


def test_bin_index_rejects_zero_bins() -> None:
    """``n_bins < 1`` is a programmer error, not silently tolerated."""
    with pytest.raises(ValueError, match="n_bins"):
        bin_index(0.5, 0)


def test_calibrated_corpus_is_monotonic() -> None:
    """A well-calibrated corpus has non-decreasing per-bin success rates."""
    rates = binned_success_rates(_CALIBRATED, n_bins=5)
    assert rates == [0.0, 0.0, 0.5, 1.0, 1.0]
    assert is_monotonic_nondecreasing(rates)


def test_checker_flags_anticalibration() -> None:
    """The monotonicity check has teeth: an anti-calibrated corpus fails it."""
    rates = binned_success_rates(_ANTI_CALIBRATED, n_bins=5)
    assert not is_monotonic_nondecreasing(rates)


def test_empty_bins_do_not_break_monotonicity() -> None:
    """``None`` (empty) bins are skipped and impose no ordering constraint."""
    assert is_monotonic_nondecreasing([None, 0.2, None, 0.8, None])
    assert not is_monotonic_nondecreasing([0.9, None, 0.1])


def test_scaffold_runs_over_real_golden_confidences() -> None:
    """Integration smoke: the binner accepts the engine's real confidence output.

    No outcome labels exist yet (that's M3.10), so this asserts the harvested
    golden confidences are valid probabilities and bin without error — proving
    the scaffold integrates with actual ``DailyDecision`` output, not just
    synthetic data.
    """
    confidences = _golden_confidences()
    if not confidences:
        pytest.skip("no golden fixtures present (early-development checkout)")
    for confidence in confidences:
        assert 0.0 <= confidence <= 1.0
        assert 0 <= bin_index(confidence, 10) <= 9
