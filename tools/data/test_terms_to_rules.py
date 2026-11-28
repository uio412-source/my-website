"""Regression checks for the generated-only reward fallback."""
import contextlib
import gzip
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import picking_audit as audit
import terms_to_rules as converter


def row(**kw):
    return {"label": "일반", "value": "1%", "valueType": "캐시백", **kw}


def terms(*benefits):
    return {"cardId": "sample", "name": "Sample", "cardType": "credit",
            "minimumSpend": 400000, "benefits": list(benefits)}


class ConversionTests(unittest.TestCase):
    def test_explicit_zero_and_null_are_different(self):
        self.assertEqual(converter.conversion_rates(terms(row(minimumSpend=0)))[0][0]["minimumSpend"], 0)
        self.assertEqual(converter.conversion_rates(terms(row(minimumSpend=None)))[0][0]["minimumSpend"], 400000)
        self.assertIsNone(converter.conversion_rates(terms(
            row(minimumSpend=0, tiers=[{"spend": 400000, "cap": 5000}])))[0])

    def test_point_rates_are_not_cash(self):
        self.assertIsNone(converter.conversion_rates(terms(
            row(label="M포인트 적립", value="1.2%", valueType="적립", minimumSpend=0)))[0])

    def test_prose_cannot_stand_in_for_transaction_terms(self):
        for condition in ["10만원 이상 단일 결제 시", "건당 3천원 한도", "매입일+5일 이내 즉시결제",
                          "1회 승인금액 USD 10 이상 시 캐시백", "KB Pay 포함 4개 중 택 1"]:
            with self.subTest(condition=condition):
                self.assertIsNone(converter.conversion_rates(terms(row(conditions=[condition])))[0])

    def test_discounted_spend_exclusion_changes_denominator(self):
        data = {**terms(row(value="10%", cap=15000)), "spendExclusions": ["서비스(할인) 받은 매출"]}
        rates, _ = converter.conversion_rates(data)
        self.assertTrue(rates[0]["spendExcluded"])
        option = audit.best(audit.picking_options({"rewardRates": rates, "rewardModelComplete": True}))
        self.assertAlmostEqual(option["value"], 100 * 15000 / 550000)

    def test_multiple_rows_do_not_prove_card_maximum(self):
        self.assertIsNone(converter.conversion_rates(terms(
            row(label="1% 캐시백"), row(label="바로내면 1% 캐시백")))[0])
        self.assertIsNone(converter.conversion_rates(terms(
            row(label="KB Pay", value="15%", monthlyCapValue=15000),
            row(label="해외", value="2%", minimumSpend=0)))[0])

    def test_rebuild_updates_and_removes_old_generated_rules_but_preserves_manual_ones(self):
        with tempfile.TemporaryDirectory() as d, patch.object(converter, "DATA", Path(d)), \
                patch.object(audit, "CARD_DATA", Path(d)), contextlib.redirect_stdout(io.StringIO()):
            def write(name, obj):
                path = Path(d) / name
                raw = json.dumps(obj).encode()
                path.write_bytes(gzip.compress(raw) if name.endswith(".gz") else raw)

            def read():
                return audit.load("terms-rules.json.gz")["patches"]

            old_rate = {"label": "old", "rewardUnits": 2, "rewardUnit": "원",
                        "spendUnit": 100, "unitValue": 1, "minimumSpend": 0,
                        "monthlyCapValue": None, "verified": True}
            cards = [{"id": i, "name": "Sample", "type": "credit", "minimumSpend": 0}
                     for i in ("sample", "manual", "plan")]
            corrected = terms(row(minimumSpend=0))
            write("catalog-snapshot.json", {"cards": cards})
            handmade = {"patches": {"manual": {"rewardRates": [old_rate]},
                                     "plan": {"spendingPlans": [{"label": "manual plan"}]}}}
            write("verified-card-rules.json.gz", handmade)
            write("picking-review.json", {})
            write("card-terms.json", {"cards": [corrected, {**corrected, "cardId": "manual"},
                                                {**corrected, "cardId": "plan"}]})
            write("terms-rules.json.gz", {"patches": {"sample": {"rewardRates": [old_rate]}}})
            converter.build(dry_run=True)
            self.assertEqual(read()["sample"]["rewardRates"][0]["rewardUnits"], 2)

            converter.build(dry_run=False)
            self.assertEqual(set(read()), {"sample"})
            self.assertEqual(read()["sample"]["rewardRates"][0]["rewardUnits"], 1)
            self.assertEqual(audit.load("verified-card-rules.json.gz"), handmade)
            self.assertEqual(audit.apply_verified_rules(cards)[1]["rewardRates"], [old_rate])
            previous_bytes = (Path(d) / "terms-rules.json.gz").read_bytes()
            converter.build(dry_run=False)
            self.assertEqual((Path(d) / "terms-rules.json.gz").read_bytes(), previous_bytes)

            write("card-terms.json", {"cards": []})
            converter.build(dry_run=False)
            self.assertEqual(read(), {})


if __name__ == "__main__":
    unittest.main()
