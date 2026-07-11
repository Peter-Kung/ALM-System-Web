import assert from "node:assert/strict";
import test from "node:test";

import {
  formatReadOnlyMoney,
  formatReadOnlyMoneyAmount,
} from "@/lib/read-only-money-format";

test("formatReadOnlyMoneyAmount keeps raw values below one thousand", () => {
  assert.equal(formatReadOnlyMoneyAmount("999.99"), "999.99");
  assert.equal(formatReadOnlyMoneyAmount("0"), "0");
  assert.equal(formatReadOnlyMoneyAmount(-12.5), "-12.5");
});

test("formatReadOnlyMoneyAmount compacts thousands with one decimal place at most", () => {
  assert.equal(formatReadOnlyMoneyAmount("1000"), "1K");
  assert.equal(formatReadOnlyMoneyAmount("1500"), "1.5K");
  assert.equal(formatReadOnlyMoneyAmount("12345"), "12.3K");
  assert.equal(formatReadOnlyMoneyAmount("12000"), "12K");
  assert.equal(formatReadOnlyMoneyAmount("1000000"), "1,000K");
  assert.equal(formatReadOnlyMoneyAmount("-1500"), "-1.5K");
});

test("formatReadOnlyMoney attaches currency labels without changing invalid raw values", () => {
  assert.equal(
    formatReadOnlyMoney("1234.50", { currency: "USD", currencyPosition: "prefix" }),
    "USD 1.2K",
  );
  assert.equal(formatReadOnlyMoney("999.99", { currency: "TWD" }), "999.99 TWD");
  assert.equal(
    formatReadOnlyMoney("1234.50", { currency: "INVALID!", currencyPosition: "prefix" }),
    "INVALID! 1.2K",
  );
  assert.equal(formatReadOnlyMoney("not-a-number", { currency: "USD" }), "not-a-number USD");
});
