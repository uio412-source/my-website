import unittest

from inbox import Problems, check_card_products, check_card_terms


class IssuanceIntakeTests(unittest.TestCase):
    today = "2026-11-28"
    url = "https://www.shinhancard.com/pconts/html/helpdesk/dataRoom/MOBFM164N/2013455_1119.html"

    def issues(self, validator, collection, row):
        problems = Problems()
        validator({"type": collection, "issuer": "신한카드", "collectedAt": self.today,
                   "collector": "test", "changes" if collection == "card-products" else "cards": [row]},
                  "fixture", problems)
        return problems

    def product(self, **overrides):
        entry = {"change": "discontinued", "cardId": "shinhan-200506010001",
                 "name": "신한카드 아름다운", "cardType": "credit", "url": self.url, **overrides}
        return self.issues(check_card_products, "card-products", entry)

    def terms(self, **overrides):
        entry = {"status": "discontinued", "cardId": "shinhan-200506010001",
                 "name": "신한카드 아름다운", "cardType": "credit", "url": self.url,
                 "discontinuationSourceUrl": self.url, "termsUrl": None, "docDate": "2026-05-08",
                 "annualFee": [{"brand": "국내전용", "amount": 5000}], "brands": ["국내전용"],
                 "minimumSpend": None, "spendExclusions": [], "benefitExclusions": [],
                 "benefits": [{"label": "국내", "place": "국내 가맹점", "value": "1%", "valueType": "적립"}], **overrides}
        return self.issues(check_card_terms, "card-terms", entry)

    def test_queue_can_keep_future_date_but_never_embed_invalid_or_unofficial_evidence(self):
        self.assertFalse(self.product(discontinuedAt="2026-12-01"))
        self.assertFalse(self.product(discontinuedAt=None))
        self.assertTrue(self.product(discontinuedAt="2026-02-30"))
        self.assertTrue(self.product(change="changed", discontinuedAt="2026-06-25"))
        self.assertTrue(self.product(url="https://card-gorilla.com/not-official"))

    def test_display_terms_require_effective_official_stop_and_exact_card_id(self):
        self.assertFalse(self.terms(discontinuedAt="2026-06-25"))
        self.assertFalse(self.terms(discontinuedAt=None))
        self.assertTrue(self.terms(discontinuedAt="2026-12-01"))
        self.assertTrue(self.terms(discontinuedAt="2026-02-30"))
        self.assertTrue(self.terms(discontinuationSourceUrl=None))
        self.assertTrue(self.terms(discontinuationSourceUrl="https://shinhancard.com.example.net"))
        self.assertTrue(self.terms(cardId=None))
        self.assertTrue(self.terms(status="active", discontinuedAt="2026-06-25"))


if __name__ == "__main__":
    unittest.main()
